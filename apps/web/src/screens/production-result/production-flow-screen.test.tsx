import { messages } from '@omf-mes/i18n';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { PopIdentityProvider } from '../../patterns/pop-identity';
import {
  createStubFetch,
  jsonResponse,
  renderWithProviders,
  type StubRoute,
} from '../../test/api-harness';
import { ProductionFlowScreen } from './screen';
import { STORAGE_KEY } from './outbox';

const t = messages.productionResult;
const LOT_ID = 90101;
const LOT_NO = 'LOT-SYN-0001';
/** 상세 조회가 내려주는 판 번호. 마감이 `If-Match` 로 되돌려 보내야 하는 값이다(#1005). */
const LOT_ETAG = '"7"';
const WORK_ORDER_ID = 701;
const pathOf = (request: Request): string => new URL(request.url).pathname;

const routes = (writes: Request[]): StubRoute[] => [
  {
    match: (request) => pathOf(request) === '/mdm/terminals/10/processes',
    respond: () =>
      jsonResponse({
        items: [
          {
            processId: 20,
            canInputResult: true,
            canPrintLabel: true,
            canCompleteWork: true,
          },
        ],
      }),
  },
  {
    match: (request) => pathOf(request) === `/production/work-orders/${String(WORK_ORDER_ID)}`,
    respond: () =>
      jsonResponse({
        workOrderId: WORK_ORDER_ID,
        workOrderNo: 'WO-SYN-001',
        productionOrderId: 1,
        productionOrderNo: 'ERP-SYN-001',
        productionPlanId: 1,
        routingOperationId: 1,
        itemId: 101,
        itemCode: 'ITEM-SYN-01',
        orderQty: 12,
        uomId: 1,
        workOrderTypeCode: 'NORMAL',
        statusCode: 'IN_PROGRESS',
        priorityNo: 1,
        progress: { goodQty: 0, varianceQty: 12 },
      }),
  },
  {
    match: (request) => pathOf(request) === '/trace/lots',
    respond: (request) => {
      const url = new URL(request.url);
      if (url.searchParams.get('completed') === 'true') {
        return jsonResponse({ items: [], page: { page: 1, size: 100, total: 0 } });
      }

      return jsonResponse({
        items: [
          {
            lotId: LOT_ID,
            lotNo: LOT_NO,
            itemId: 101,
            lotTypeCode: 'PRODUCTION',
            plantId: 1,
            initialQty: 12,
            uomId: 1,
            sourceTypeCode: 'WORK_ORDER',
            sourceId: WORK_ORDER_ID,
            statusCode: 'NORMAL',
            workOrderSequenceNo: 1,
            workOrderLotCount: 3,
            progress: { goodQty: 0, varianceQty: 12 },
          },
        ],
        page: { page: 1, size: 20, total: 1 },
      });
    },
  },
  {
    match: (request) => pathOf(request) === '/quality/inspection-requests',
    respond: () => jsonResponse({ items: [], page: { page: 1, size: 20, total: 0 } }),
  },
  {
    match: (request) => pathOf(request) === '/mdm/items/101',
    respond: () =>
      jsonResponse({
        item: {
          itemId: 101,
          itemCode: 'ITEM-SYN-01',
          itemName: '합성 품목',
          itemTypeCode: 'FINISHED',
          baseUomId: 1,
          lotControlled: true,
          serialControlTypeCode: 'NONE',
          inspectionRequired: false,
          fifoPolicyCode: 'FIFO',
          negativeStockAllowed: false,
          isActive: true,
        },
      }),
  },
  {
    match: (request) => pathOf(request) === '/mdm/uoms',
    respond: () => jsonResponse({ items: [{ uomId: 1, uomCode: 'EA', uomName: '개' }] }),
  },
  {
    match: (request) => pathOf(request) === '/app/printers',
    respond: () =>
      jsonResponse({
        items: [
          {
            printerName: 'printer-syn',
            displayName: '합성 라벨 프린터',
            status: 'READY',
            isDefault: true,
          },
        ],
      }),
  },
  {
    match: (request) => request.method === 'GET' && pathOf(request) === '/app/document-issues',
    respond: () => jsonResponse({ items: [], page: { page: 1, size: 100, total: 0 } }),
  },
  {
    match: (request) =>
      request.method === 'POST' && pathOf(request) === '/production/production-results',
    respond: (request) => {
      writes.push(request.clone());
      return jsonResponse({ productionResultId: 501 }, { status: 201 });
    },
  },
  {
    match: (request) => request.method === 'POST' && pathOf(request) === '/app/document-issues',
    respond: (request) => {
      writes.push(request.clone());
      return jsonResponse(
        {
          items: [
            {
              documentIssueLogId: 44001,
              issueSeq: 1,
              printOutcome: 'PENDING',
              target: { targetTypeCode: 'LOT', targetId: LOT_ID, displayName: LOT_NO },
            },
          ],
          issuedCount: 1,
        },
        { status: 201 },
      );
    },
  },
  {
    match: (request) => pathOf(request) === '/app/document-issues/44001/rendition',
    respond: () => new Response(new Uint8Array([1, 2, 3])),
  },
  {
    match: (request) => pathOf(request) === '/app/document-issues/44001:report-print',
    respond: (request) => {
      writes.push(request.clone());
      return new Response(null, { status: 204 });
    },
  },
  /*
   * ⭐ **마감이 실을 낙관적 잠금 값의 출처다**(#1005). 이 줄이 없으면 `If-Match` 가 비고
   *    마감이 아예 나가지 않는다 — 전에는 헤더만 빠진 채 «성공»했다.
   */
  {
    match: (request) => pathOf(request) === `/trace/lots/${String(LOT_ID)}`,
    respond: () =>
      jsonResponse(
        { lot: { lotId: LOT_ID, lotNo: LOT_NO }, externalReferences: [] },
        { headers: { ETag: LOT_ETAG } },
      ),
  },
  {
    match: (request) => pathOf(request) === `/trace/lots/${String(LOT_ID)}:complete`,
    respond: (request) => {
      writes.push(request.clone());
      return jsonResponse({ lotId: LOT_ID, lotNo: LOT_NO, completedAt: new Date().toISOString() });
    },
  },
];

const renderScreen = (
  writes: Request[],
  extraRoutes: StubRoute[] = [],
  options: { workerNo?: string | null; route?: string } = {},
) =>
  renderWithProviders(
    <PopIdentityProvider
      value={{
        terminalId: 10,
        processes: [{ processId: 20 }],
        equipment: null,

        workerNo: options.workerNo === undefined ? '100029' : options.workerNo,
      }}
    >
      <ProductionFlowScreen />
    </PopIdentityProvider>,
    {
      route:
        options.route ??
        `/pop/production-result?workOrderId=${String(WORK_ORDER_ID)}&workerNo=100029`,
      fetch: createStubFetch([...extraRoutes, ...routes(writes)]),
    },
  );

describe('ProductionFlowScreen', () => {
  beforeEach(() => {
    globalThis.localStorage.clear();
    Object.defineProperty(window, 'pop', {
      configurable: true,
      value: { rendition: { save: vi.fn().mockResolvedValue('/tmp/lot.prn') } },
    });
  });

  afterEach(() => {
    globalThis.localStorage.clear();
    Reflect.deleteProperty(window, 'pop');
  });

  /*
   * ⛔⛔ **서버에 `GET /app/document-issues/{id}/rendition` 경로가 없다**(`patterns/
   * pop-label-rendition` 머리말 · 대응표 P1 「미구현 5건」). 라벨 인쇄가 이 경로로 그림을
   * 받아야 끝나는데, 이제 그 걸음이 항상 막혀 있어 **인쇄가 성공할 수 없고**, 이 화면의
   * 스캔 칸은 `outputPhase === 'scanReady'`(=인쇄까지 성공)에서만 열린다 — 그 결과 LOT
   * 마감(스캔)도 함께 막힌다. 이것은 이번 서버 기준선의 파생 영향이며, 그 게이팅을 완화하는
   * 것은 업무 규칙을 새로 정하는 일이라 임의로 손대지 않는다(추측 금지 · 보고 대상).
   * **실적 저장 → 발행까지는 그대로 된다**는 성질만 남기고, 그 뒤로는 스캔이 열리지 않는다는
   * 사실로 다시 잰다.
   */
  it('실적을 한 번 저장한 뒤에만 발행하지만, 그림을 받지 못해 인쇄가 끝나지 않아 스캔이 열리지 않는다', async () => {
    const writes: Request[] = [];
    const user = userEvent.setup();
    renderScreen(writes);

    const output = await screen.findByRole('button', { name: t.flow.output.issue });
    await waitFor(() => expect(output).toBeEnabled());
    await user.click(output);
    await user.click(output);

    await waitFor(() => {
      expect(
        writes.some((request) => pathOf(request) === '/app/document-issues/44001:report-print'),
      ).toBe(true);
    });

    const appliedPaths = writes.map(pathOf);
    expect(appliedPaths.filter((path) => path === '/production/production-results')).toHaveLength(
      1,
    );
    expect(appliedPaths.indexOf('/production/production-results')).toBeLessThan(
      appliedPaths.indexOf('/app/document-issues'),
    );
    expect(appliedPaths.indexOf('/app/document-issues')).toBeLessThan(
      appliedPaths.indexOf('/app/document-issues/44001:report-print'),
    );

    /* 그림을 받지 못해 인쇄가 끝나지 않는다 — 스캔 칸이 열리지 않고 LOT 마감도 나가지 않는다. */
    expect(screen.getByLabelText(t.flow.scan.label)).toBeDisabled();
    expect(writes.some((request) => pathOf(request).endsWith(':complete'))).toBe(false);
  });

  /*
   * ⛔⛔ **서버에 이 경로가 없다**(위와 같음). 원래 이 시험은 «물리 인쇄까지는 됐는데 성공
   * 보고만 실패한» 상태(`reportFailed`)에서 재시도가 «종이를 다시 뽑지 않고 보고만» 다시
   * 보내는 것을 쟀다 — 그림을 받는 걸음이 항상 막혀 있어 물리 인쇄 자체가 없고, 그 상태에
   * 이를 수 없다. 대신 **다시 눌러도 셸을 다시 부르지 않고(종이가 늘지 않고) 같은 실패
   * 사유의 보고만 다시 나간다**는, 지금 실제로 일어나는 같은 원칙을 `renditionFailed` 자리
   * («다시 인쇄» 재시도)에서 잰다 — 재시도의 실패 보고도 같은 멱등 키를 쓴다(둘 다
   * `outcome: FAILED` 라 슬롯이 같다).
   */
  it('그림을 받지 못하면 다시 눌러도 셸을 부르지 않고 같은 실패 사유로만 다시 보고한다', async () => {
    const writes: Request[] = [];
    const save = vi.fn().mockResolvedValue('/tmp/lot.prn');
    Object.defineProperty(window, 'pop', {
      configurable: true,
      value: { rendition: { save } },
    });
    const user = userEvent.setup();
    renderScreen(writes);

    const output = await screen.findByRole('button', { name: t.flow.output.issue });
    await waitFor(() => expect(output).toBeEnabled());
    await user.click(output);

    const retryPrint = await screen.findByRole('button', { name: t.flow.output.retryPrint });
    expect(screen.getByText(t.flow.output.renditionFailed)).toBeVisible();
    expect(save).not.toHaveBeenCalled();

    await user.click(retryPrint);

    await waitFor(() => {
      const reports = writes.filter(
        (request) => pathOf(request) === '/app/document-issues/44001:report-print',
      );
      expect(reports).toHaveLength(2);
    });
    expect(save).not.toHaveBeenCalled();
    expect(screen.getByLabelText(t.flow.scan.label)).toBeDisabled();

    const reports = writes.filter(
      (request) => pathOf(request) === '/app/document-issues/44001:report-print',
    );
    expect(reports[0]?.headers.get('Idempotency-Key')).toBe(
      reports[1]?.headers.get('Idempotency-Key'),
    );
  });

  /**
   * ⛔ **상세가 늦게 닿아도 이미 적용된 실적을 덮지 않는다**(#1095).
   *
   * 양품 누계의 출처가 목록에서 상세로 옮겨졌다. 목록만 먼저 닿은 순간에는 초기수량이 서지만,
   * 상세가 늦게 닿아도 **끝내 서버의 누계로 되돌아와야 한다.** 그러지 않으면 작업자가 초기수량을
   * 그대로 저장해 실적이 두 번 올라간다 — 되돌릴 수 없는 쓰기다.
   */
  it('상세가 늦게 닿아도 이미 적용된 양품 누계가 초기수량에 덮이지 않는다', async () => {
    const writes: Request[] = [];
    let releaseDetail = (): void => {
      /* 아래 Promise 가 곧바로 덮어쓴다 — 실행기는 동기이므로 이 몸통은 불리지 않는다. */
    };
    const detailArrived = new Promise<void>((resolve) => {
      releaseDetail = (): void => {
        resolve();
      };
    });
    const slowDetail: StubRoute = {
      match: (request) => pathOf(request) === `/trace/lots/${String(LOT_ID)}`,
      respond: async () => {
        await detailArrived;

        return jsonResponse(
          {
            lot: { lotId: LOT_ID, lotNo: LOT_NO, progress: { goodQty: 8, varianceQty: -4 } },
            externalReferences: [],
          },
          { headers: { ETag: LOT_ETAG } },
        );
      },
    };
    renderScreen(writes, [slowDetail]);

    const quantity = await screen.findByLabelText(t.flow.quantity.actual);
    releaseDetail();

    await waitFor(() => {
      expect(quantity).toHaveValue('8');
    });
  });

  it('서버 적용 실적으로 재진입하면 수량을 잠그고 생산 실적 없이 라벨 단계만 재개한다', async () => {
    const writes: Request[] = [];
    const user = userEvent.setup();
    /*
     * ⚠ **현재 LOT 은 `completed=false` 로 좁힌다**(#1095). 서버 구현 기준선에 `currentOnly`
     *    축이 없다 — 옛 질의를 흉내 내면 시험만 통과하고 실서버에서는 전체 목록이 온다.
     */
    const appliedLot: StubRoute = {
      match: (request) => pathOf(request) === '/trace/lots',
      respond: (request) => {
        const url = new URL(request.url);
        if (url.searchParams.get('completed') === 'true') {
          return jsonResponse({ items: [], page: { page: 1, size: 20, total: 0 } });
        }

        return jsonResponse({
          items: [
            {
              lotId: LOT_ID,
              lotNo: LOT_NO,
              itemId: 101,
              lotTypeCode: 'PRODUCTION',
              plantId: 1,
              initialQty: 12,
              uomId: 1,
              sourceTypeCode: 'WORK_ORDER',
              sourceId: WORK_ORDER_ID,
              statusCode: 'NORMAL',
            },
          ],
          page: { page: 1, size: 20, total: 1 },
        });
      },
    };
    /* 양품 누계는 상세에만 실린다(#1095) — 목록에 얹으면 화면이 읽지 못한다. */
    const appliedLotDetail: StubRoute = {
      match: (request) => pathOf(request) === `/trace/lots/${String(LOT_ID)}`,
      respond: () =>
        jsonResponse(
          {
            lot: { lotId: LOT_ID, lotNo: LOT_NO, progress: { goodQty: 8, varianceQty: -4 } },
            externalReferences: [],
          },
          { headers: { ETag: LOT_ETAG } },
        ),
    };
    renderScreen(writes, [appliedLot, appliedLotDetail]);

    const quantity = await screen.findByLabelText(t.flow.quantity.actual);
    await waitFor(() => expect(quantity).toHaveValue('8'));
    expect(quantity).toBeDisabled();

    const retryIssue = await screen.findByRole('button', { name: t.flow.output.retryIssue });
    await user.click(retryIssue);
    await waitFor(() =>
      expect(writes.filter((request) => pathOf(request) === '/app/document-issues')).toHaveLength(
        1,
      ),
    );
    expect(writes.some((request) => pathOf(request) === '/production/production-results')).toBe(
      false,
    );
  });

  it('구 라벨 이력만 있고 서버 적용 실적이 없으면 스캔과 LOT 마감을 차단한다', async () => {
    const writes: Request[] = [];
    const legacyIssue: StubRoute = {
      match: (request) => request.method === 'GET' && pathOf(request) === '/app/document-issues',
      respond: () =>
        jsonResponse({
          items: [
            {
              documentIssueLogId: 44001,
              documentTypeCode: 'PRODUCTION_LOT_LABEL',
              target: { targetTypeCode: 'LOT', targetId: LOT_ID, displayName: LOT_NO },
              lotId: LOT_ID,
              lotNo: LOT_NO,
              issueSeq: 1,
              issuedBy: 1001,
              issuedByName: '합성 작업자',
              issuedAt: '2026-09-08T09:00:00+09:00',
              printOutcome: 'SUCCEEDED',
            },
          ],
          page: { page: 1, size: 100, total: 1 },
        }),
    };
    const user = userEvent.setup();
    renderScreen(writes, [legacyIssue]);

    expect(await screen.findByText(t.flow.output.legacyMismatch)).toBeVisible();
    expect(screen.getByRole('button', { name: t.flow.output.mismatchBlocked })).toBeDisabled();
    const scan = screen.getByLabelText(t.flow.scan.label);
    expect(scan).toBeDisabled();
    await user.type(scan, LOT_NO);

    expect(writes.some((request) => pathOf(request) === '/production/production-results')).toBe(
      false,
    );
    expect(writes.some((request) => pathOf(request).endsWith(':complete'))).toBe(false);
  });

  it('구 라벨 이력과 대기 실적이 함께 있으면 서버 적용 뒤 기존 이력만 재인쇄한다', async () => {
    const writes: Request[] = [];
    globalThis.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify([
        {
          idempotencyKey: 'legacy-result-key',
          workerNo: '100029',
          body: {
            workOrderId: WORK_ORDER_ID,
            goodQty: 12,
            uomId: 1,
            occurredAt: '2026-09-08T09:00:00+09:00',
            lotAllocations: [{ lotId: LOT_ID, allocatedQty: 12 }],
          },
        },
      ]),
    );
    const legacyIssue: StubRoute = {
      match: (request) => request.method === 'GET' && pathOf(request) === '/app/document-issues',
      respond: () =>
        jsonResponse({
          items: [
            {
              documentIssueLogId: 44001,
              documentTypeCode: 'PRODUCTION_LOT_LABEL',
              target: { targetTypeCode: 'LOT', targetId: LOT_ID, displayName: LOT_NO },
              lotId: LOT_ID,
              lotNo: LOT_NO,
              issueSeq: 1,
              issuedBy: 1001,
              issuedByName: '합성 작업자',
              issuedAt: '2026-09-08T09:00:00+09:00',
              printOutcome: 'SUCCEEDED',
            },
          ],
          page: { page: 1, size: 100, total: 1 },
        }),
    };
    renderScreen(writes, [legacyIssue]);

    /*
     * ⛔⛔ **서버에 이 경로가 없다**(`patterns/pop-label-rendition` 머리말 · 대응표 P1
     * 「미구현 5건」). 서버 적용 뒤 «기존 이력만 재인쇄»하는 이 재개 경로도 같은 그리기
     * 걸음을 타므로, 이제는 항상 `renderFailed` 로 멈춘다 — 스캔 칸은 열리지 않는다. 그래도
     * **새 발행 기록을 만들지 않고 기존 이력으로 재인쇄만 시도한다**는(이 시험의 핵심)
     * 성질은 실적 저장 한 번 · 신규 발행 0회 · 재인쇄 결과 보고 한 번(이번엔 실패로)으로
     * 그대로 확인된다.
     */
    await waitFor(() => {
      expect(
        writes.filter((request) => pathOf(request) === '/app/document-issues/44001:report-print'),
      ).toHaveLength(1);
    });
    expect(screen.getByLabelText(t.flow.scan.label)).toBeDisabled();
    expect(
      writes.filter((request) => pathOf(request) === '/production/production-results'),
    ).toHaveLength(1);
    expect(
      writes.filter(
        (request) => request.method === 'POST' && pathOf(request) === '/app/document-issues',
      ),
    ).toHaveLength(0);
  });

  /*
   * ⛔⛔ **서버에 `GET /app/document-issues/{id}/rendition` 경로가 없다**(대응표 P1
   * 「미구현 5건」). 이 시험이 재려던 것(마감 실패 뒤 스캔 값을 비워 다시 스캔하는 것)은
   * 스캔 칸이 열려 있어야(`outputPhase === 'scanReady'`, 즉 인쇄까지 성공해야) 일어날 수
   * 있는데, 그리기 걸음이 항상 막혀 있어 스캔 칸 자체가 결코 열리지 않는다 — 이 시험이
   * 재려던 갈래에 이제 이를 수 없다. 대신 **스캔이 열리지 않으니 마감 시도 자체가 전혀
   * 나가지 않는다**는, 지금 실제로 성립하는 사실을 잰다 — 다시 인쇄를 여러 번 눌러도
   * 마찬가지다.
   */
  it('그림을 받지 못해 스캔이 열리지 않으므로 LOT 마감 시도 자체가 나가지 않는다', async () => {
    const writes: Request[] = [];
    let attempts = 0;
    const completeRoute: StubRoute = {
      match: (request) => pathOf(request) === `/trace/lots/${String(LOT_ID)}:complete`,
      respond: (request) => {
        writes.push(request.clone());
        attempts += 1;

        return jsonResponse({
          lotId: LOT_ID,
          lotNo: LOT_NO,
          completedAt: new Date().toISOString(),
        });
      },
    };
    const user = userEvent.setup();
    renderScreen(writes, [completeRoute]);

    const output = await screen.findByRole('button', { name: t.flow.output.issue });
    await waitFor(() => expect(output).toBeEnabled());
    await user.click(output);

    const retryPrint = await screen.findByRole('button', { name: t.flow.output.retryPrint });
    await user.click(retryPrint);
    await user.click(await screen.findByRole('button', { name: t.flow.output.retryPrint }));

    expect(screen.getByLabelText(t.flow.scan.label)).toBeDisabled();
    expect(attempts).toBe(0);
  });

  it('마감 LOT 팝업은 서버 페이지 경계에서 페이지 위·아래를 이동한다', async () => {
    const writes: Request[] = [];
    const requestedPages: number[] = [];
    const completedRoute: StubRoute = {
      match: (request) => {
        const url = new URL(request.url);
        return pathOf(request) === '/trace/lots' && url.searchParams.get('completed') === 'true';
      },
      respond: (request) => {
        const page = Number(new URL(request.url).searchParams.get('page'));
        requestedPages.push(page);

        return jsonResponse({
          items: [
            {
              lotId: page,
              lotNo: `LOT-CLOSED-${String(page)}`,
              itemId: 101,
              lotTypeCode: 'PRODUCTION',
              plantId: 1,
              initialQty: 12,
              uomId: 1,
              sourceTypeCode: 'WORK_ORDER',
              sourceId: WORK_ORDER_ID,
              statusCode: 'NORMAL',
              workOrderSequenceNo: page,
              workOrderLotCount: 21,
            },
          ],
          page: { page, size: 20, total: 21 },
        });
      },
    };
    const user = userEvent.setup();
    renderScreen(writes, [completedRoute]);

    await user.click(await screen.findByRole('button', { name: t.flow.currentLot.completed }));
    expect(await screen.findByText('LOT-CLOSED-1')).toBeVisible();
    expect(screen.getByRole('button', { name: t.flow.currentLot.pageUp })).toBeDisabled();
    const pageDown = screen.getByRole('button', { name: t.flow.currentLot.pageDown });
    expect(pageDown).toBeEnabled();

    await user.click(pageDown);
    expect(await screen.findByText('LOT-CLOSED-2')).toBeVisible();
    expect(screen.getByRole('button', { name: t.flow.currentLot.pageUp })).toBeEnabled();
    expect(screen.getByRole('button', { name: t.flow.currentLot.pageDown })).toBeDisabled();
    expect(requestedPages).toEqual([1, 2]);
  });

  it('인식표 부족분 1001장은 1000장과 1장 발번으로 나눠 연속 처리한다', async () => {
    const writes: Request[] = [];
    const createdSerials: Array<{
      serialNumberId: number;
      serialNo: string;
      itemId: number;
      lotId: number;
      statusCode: string;
    }> = [];
    const extraRoutes: StubRoute[] = [
      {
        match: (request) => pathOf(request) === '/trace/lots',
        respond: (request) => {
          const url = new URL(request.url);
          if (url.searchParams.get('completed') === 'true') {
            return jsonResponse({ items: [], page: { page: 1, size: 20, total: 0 } });
          }

          return jsonResponse({
            items: [
              {
                lotId: LOT_ID,
                lotNo: LOT_NO,
                itemId: 101,
                lotTypeCode: 'PRODUCTION',
                plantId: 1,
                initialQty: 1001,
                uomId: 1,
                sourceTypeCode: 'WORK_ORDER',
                sourceId: WORK_ORDER_ID,
                statusCode: 'NORMAL',
                workOrderSequenceNo: 1,
                workOrderLotCount: 1,
                progress: { goodQty: 0, varianceQty: -1001 },
              },
            ],
            page: { page: 1, size: 20, total: 1 },
          });
        },
      },
      {
        match: (request) => pathOf(request) === '/mdm/items/101',
        respond: () =>
          jsonResponse({
            item: {
              itemId: 101,
              itemCode: 'ITEM-SYN-01',
              itemName: '합성 품목',
              itemTypeCode: 'FINISHED',
              baseUomId: 1,
              lotControlled: true,
              serialControlTypeCode: 'EACH',
              inspectionRequired: false,
              fifoPolicyCode: 'FIFO',
              negativeStockAllowed: false,
              isActive: true,
            },
          }),
      },
      {
        match: (request) => request.method === 'GET' && pathOf(request) === '/trace/serial-numbers',
        respond: (request) => {
          const page = Number(new URL(request.url).searchParams.get('page'));
          const start = (page - 1) * 1000;

          return jsonResponse({
            items: createdSerials.slice(start, start + 1000),
            page: { page, size: 1000, total: createdSerials.length },
          });
        },
      },
      {
        match: (request) =>
          request.method === 'POST' && pathOf(request) === '/trace/serial-numbers',
        respond: (request) => {
          writes.push(request.clone());
          const quantity = createdSerials.length === 0 ? 1000 : 1;
          const firstId = createdSerials.length + 1;
          const items = Array.from({ length: quantity }, (_, index) => ({
            serialNumberId: firstId + index,
            serialNo: `SN-${String(firstId + index)}`,
            itemId: 101,
            lotId: LOT_ID,
            statusCode: 'ACTIVE',
          }));
          createdSerials.push(...items);

          return jsonResponse({ items, issuedCount: quantity }, { status: 201 });
        },
      },
      {
        match: (request) => pathOf(request) === '/app/document-issues/summary',
        respond: (request) => {
          const ids = (new URL(request.url).searchParams.get('targetIds') ?? '')
            .split(',')
            .filter(Boolean)
            .map(Number);
          return jsonResponse({
            items: ids.map((targetId) => ({
              targetTypeCode: 'SERIAL_NUMBER',
              targetId,
              issueCount: 1,
              lastPrintOutcome: 'SUCCEEDED',
            })),
          });
        },
      },
    ];
    renderScreen(writes, extraRoutes);

    /*
     * ⛔⛔ **`IDENTIFICATION_TAG` 발행은 서버가 항상 422 `STATE_LOCKED` 로 거부한다**
     * (대응표 P1 「공용 문서 발행」 · I-27 마감 결정 · `screen.tsx` 의
     * `IDENTIFICATION_TAG_ISSUE_LOCKED`). 원래 이 시험은 부족분 1001장을 1000장·1장으로
     * 나눠 두 번의 개체 생성으로 잇는 것을 쟀다 — 그 발행 동작 자체를 잠갔으므로 단추는
     * 계속 비활성이고, 개체 생성(`POST /trace/serial-numbers`)도 그 뒤(`POST
     * /app/document-issues`)도 나가지 않는다.
     */
    const issue = await screen.findByRole('button', { name: t.flow.tag.issueMissing(1001) });
    expect(issue).toBeDisabled();
    expect(writes.some((request) => pathOf(request) === '/trace/serial-numbers')).toBe(false);
  });

  it('개체만 생성된 중간 상태는 인식표 발행 기록만 복구하고 개체를 다시 만들지 않는다', async () => {
    const writes: Request[] = [];
    let summaryReads = 0;
    const serials = [
      { serialNumberId: 31, serialNo: 'SN-31', itemId: 101, lotId: LOT_ID, statusCode: 'ACTIVE' },
      { serialNumberId: 32, serialNo: 'SN-32', itemId: 101, lotId: LOT_ID, statusCode: 'ACTIVE' },
    ];
    const extraRoutes: StubRoute[] = [
      {
        match: (request) => pathOf(request) === '/mdm/items/101',
        respond: () =>
          jsonResponse({
            item: {
              itemId: 101,
              itemCode: 'ITEM-SYN-01',
              itemName: '합성 품목',
              itemTypeCode: 'FINISHED',
              baseUomId: 1,
              lotControlled: true,
              serialControlTypeCode: 'EACH',
              inspectionRequired: false,
              fifoPolicyCode: 'FIFO',
              negativeStockAllowed: false,
              isActive: true,
            },
          }),
      },
      {
        match: (request) => request.method === 'GET' && pathOf(request) === '/trace/serial-numbers',
        respond: () => jsonResponse({ items: serials, page: { page: 1, size: 1000, total: 2 } }),
      },
      {
        match: (request) => pathOf(request) === '/app/printers',
        respond: (request) => {
          const documentType = new URL(request.url).searchParams.get('documentTypeCode');
          return jsonResponse({
            items: [
              {
                printerName: documentType === 'IDENTIFICATION_TAG' ? 'tag-printer' : 'lot-printer',
                displayName: '합성 프린터',
                status: 'READY',
                isDefault: true,
              },
            ],
          });
        },
      },
      {
        match: (request) => pathOf(request) === '/app/document-issues/summary',
        respond: () => {
          summaryReads += 1;
          return jsonResponse({
            items: [
              {
                targetTypeCode: 'SERIAL_NUMBER',
                targetId: 31,
                issueCount: 1,
                lastPrintOutcome: 'FAILED',
              },
              {
                targetTypeCode: 'SERIAL_NUMBER',
                targetId: 32,
                issueCount: 0,
                lastPrintOutcome: null,
              },
            ],
          });
        },
      },
    ];
    const user = userEvent.setup();
    renderScreen(writes, extraRoutes);

    /*
     * ⛔⛔ **`IDENTIFICATION_TAG` 발행은 서버가 항상 422 `STATE_LOCKED` 로 거부한다**
     * (대응표 P1 「공용 문서 발행」· I-27 마감 결정 · `screen.tsx` 의
     * `IDENTIFICATION_TAG_ISSUE_LOCKED`). 원래 이 시험은 「복구」 단추가 미발행 개체만 골라
     * `POST /app/document-issues` 로 인식표 발행 기록을 복구하는 것을 쟀다 — 그 발행 동작을
     * 잠갔으므로 단추는 계속 비활성이고, 눌러도(막혀 있어 실제로는 반응하지 않지만) 그
     * 요청은 나가지 않는다.
     */
    const failedTag = await screen.findByRole('checkbox', {
      name: `SN-31 · ${t.flow.tag.printOutcome.FAILED}`,
    });
    await user.click(failedTag);
    expect(screen.getByRole('button', { name: t.flow.tag.reissue })).toBeDisabled();

    const restore = await screen.findByRole('button', { name: t.flow.tag.restoreDocuments(1) });
    expect(restore).toBeDisabled();
    expect(writes.some((request) => pathOf(request) === '/app/document-issues')).toBe(false);
    expect(writes.some((request) => pathOf(request) === '/trace/serial-numbers')).toBe(false);
  });
});

/**
 * 잔여수량 초과 — **막지도 되묻지도 않고 «말한다»**(✓확정 QA #27 「초과 달성」 · 사용자 결정
 * 2026-09-11 · #1040).
 *
 * ⛔ **저장 단추를 끄는 것으로 재지 않는다.** 끄면 현장이 초과분을 등록할 길이 없어져, 설계가
 * 허용한 동작을 화면이 막는 것이 된다.
 * ⛔ **확인 팝업이 서지 않는 것도 함께 잰다** — 되묻는 형태로 되돌아가면 이 시험이 문다.
 */
describe('ProductionFlowScreen — 잔여수량 초과', () => {
  beforeEach(() => {
    globalThis.localStorage.clear();
    Object.defineProperty(window, 'pop', {
      configurable: true,
      value: { rendition: { save: vi.fn().mockResolvedValue('/tmp/lot.prn') } },
    });
  });

  afterEach(() => {
    globalThis.localStorage.clear();
    Reflect.deleteProperty(window, 'pop');
  });

  /** 잔여를 바꿔 끼운다 — 화면의 기본 수량(LOT 초기수량 12)이 잔여를 넘게 만든다. */
  const workOrderWith = (progress: Record<string, number> | undefined): StubRoute => ({
    match: (request) => pathOf(request) === `/production/work-orders/${String(WORK_ORDER_ID)}`,
    respond: () =>
      jsonResponse({
        workOrderId: WORK_ORDER_ID,
        workOrderNo: 'WO-SYN-001',
        productionOrderId: 1,
        productionOrderNo: 'ERP-SYN-001',
        productionPlanId: 1,
        routingOperationId: 1,
        itemId: 101,
        itemCode: 'ITEM-SYN-01',
        orderQty: 12,
        uomId: 1,
        workOrderTypeCode: 'NORMAL',
        statusCode: 'IN_PROGRESS',
        priorityNo: 1,
        ...(progress === undefined ? {} : { progress }),
      }),
  });

  const savedCount = (writes: Request[]): number =>
    writes.filter((request) => pathOf(request) === '/production/production-results').length;

  it('잔여를 넘으면 수량 칸 아래에서 말하고, 저장은 그대로 나간다', async () => {
    const writes: Request[] = [];
    const user = userEvent.setup();
    /* 잔여 2 인데 기본 수량이 12 다 — 10 을 넘는다. */
    renderScreen(writes, [workOrderWith({ goodQty: 10, varianceQty: 2 })]);

    expect(await screen.findByText(t.overrun.notice('10 EA', '2 EA'))).toBeInTheDocument();

    const output = await screen.findByRole('button', { name: t.flow.output.issue });
    await waitFor(() => expect(output).toBeEnabled());
    await user.click(output);

    /*
     * ⛔ 손짓 한 번으로 끝난다 — 되묻는 팝업이 끼어들지 않는다.
     *
     * ⚠ 건수는 **흐름이 멎은 뒤에** 센다. `waitFor` 로 1 에 닿는 순간 재면 뒤따라 오는 둘째
     *    요청을 놓친다 — 되돌릴 수 없는 쓰기라 멎은 자리에서 센다(이 파일 맨 앞 시험과 같다).
     *
     * ⚠ **멎는 자리가 스캔 칸에서 렌디션 실패로 옮겨졌다.** 서버 구현 기준선에서
     *    `GET /app/document-issues/{id}/rendition` 은 미구현이라 부르지 않는다(대응표 P1) —
     *    그림을 못 받으니 인쇄가 끝나지 않고, 스캔 칸은 `outputPhase === 'scanReady'`
     *    에서만 열리므로 영영 열리지 않는다. 이 시험이 재는 것은 **초과를 말하는 것과 저장이
     *    그대로 나가는 것**이고 그 둘은 인쇄와 무관하다 — 기준점만 옮기고 재는 것은 그대로 둔다.
     */
    expect(await screen.findByText(t.flow.output.renditionFailed)).toBeVisible();

    expect(savedCount(writes)).toBe(1);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  /* 경계 — 잔여와 «같은» 수량은 초과가 아니다. 여기서 말하면 정상 작업마다 경고가 선다. */
  it('잔여와 같은 수량에는 아무 말도 하지 않는다', async () => {
    const writes: Request[] = [];
    const user = userEvent.setup();
    renderScreen(writes, [workOrderWith({ goodQty: 0, varianceQty: 12 })]);

    const output = await screen.findByRole('button', { name: t.flow.output.issue });
    await waitFor(() => expect(output).toBeEnabled());

    expect(screen.queryByText(/초과 달성/u)).not.toBeInTheDocument();

    await user.click(output);
    await waitFor(() => expect(savedCount(writes)).toBe(1));
  });

  /*
   * 이미 지시를 넘겨 만든 지시는 `varianceQty` 가 **음수**로 온다(「지시 − 양품 누계」).
   * ⛔ 그 수를 그대로 적으면 「잔여 -4 EA」가 되어 음수를 수량으로 읽게 된다.
   */
  it('잔여가 이미 0 아래면 0 으로 세우고, 뺄셈을 보이지 않는다', async () => {
    const writes: Request[] = [];
    renderScreen(writes, [workOrderWith({ goodQty: 16, varianceQty: -4 })]);

    const output = await screen.findByRole('button', { name: t.flow.output.issue });
    await waitFor(() => expect(output).toBeEnabled());

    expect(screen.getByText(`0 ${t.quantity.orderedSuffix('12', 'EA')}`)).toBeInTheDocument();
    expect(await screen.findByText(t.overrun.noticeNoRemaining)).toBeInTheDocument();
    expect(screen.queryByText(/-4/u)).not.toBeInTheDocument();
  });

  /*
   * ⚠ 진척이 없으면 잔여는 **0 이 아니라 «모른다»**다. 모르는 것으로 막지도, 경고하지도
   * 않는다 — 대신 모른다는 사실을 화면이 적는다.
   */
  it('잔여를 받지 못하면 경고하지 않고, 잔여 자리에 모른다고 적는다', async () => {
    const writes: Request[] = [];
    const user = userEvent.setup();
    renderScreen(writes, [workOrderWith(undefined)]);

    const output = await screen.findByRole('button', { name: t.flow.output.issue });
    await waitFor(() => expect(output).toBeEnabled());
    expect(screen.getByText(t.quantity.remainingUnknown)).toBeInTheDocument();
    expect(screen.queryByText(/초과 달성/u)).not.toBeInTheDocument();

    await user.click(output);
    await waitFor(() => expect(savedCount(writes)).toBe(1));
  });

  /**
   * ⛔ **「모른다」의 이유 셋을 한 문장으로 덮지 않는다**(#1094). 작업지시가 없는 것 · 아직
   * 안 물어본 것 · 물어봤는데 실패한 것은 작업자가 할 일이 다르다.
   */
  it('작업지시를 못 받았으면 잔여수량이 왜 없는지 그 사유로 말한다', async () => {
    renderScreen([], [], { route: '/pop/production-result' });

    expect(await screen.findByText(t.quantity.remainingNoWorkOrder)).toBeInTheDocument();
    expect(screen.queryByText(t.quantity.remainingUnknown)).not.toBeInTheDocument();
  });
});
