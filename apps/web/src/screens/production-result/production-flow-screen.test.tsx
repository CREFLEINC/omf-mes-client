import { messages } from '@omf-mes/i18n';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StrictMode } from 'react';
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
const WORK_SESSION_ID = 8801;
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
  /*
   * 열린 작업 세션. **자동 종료의 대상이다** — 마지막 LOT 을 마감하면 이 세션을 닫는다.
   * 이 줄이 없으면 세션 조회가 스텁에 걸리지 않아 다른 시험까지 함께 넘어진다.
   */
  {
    match: (request) => request.method === 'GET' && pathOf(request) === '/production/work-sessions',
    respond: () =>
      jsonResponse({
        items: [
          {
            workSessionId: WORK_SESSION_ID,
            workOrderId: WORK_ORDER_ID,
            sessionNo: 1,
            terminalId: 10,
            startedAt: '2026-09-16T09:00:00+09:00',
            statusCode: 'RUNNING',
          },
        ],
        page: { page: 1, size: 20, total: 1 },
      }),
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

/** 서버가 그림을 내주지 못하는 상태. 클라이언트가 막던 시절과 달리 요청은 나가고 500 이 온다. */
const renderScreen = (
  writes: Request[],
  extraRoutes: StubRoute[] = [],
  options: { workerNo?: string | null; route?: string; strict?: boolean } = {},
) => {
  /*
   * ⚠ **`StrictMode` 는 선택으로 둔다.** POP 앱은 실제로 `StrictMode` 아래서 돌고
   *   (`app/pop-main.tsx`), 개발 모드의 이중 실행이 **효과로 쓰기를 내보내는 자리**를 정확히
   *   때린다. 되돌릴 수 없는 전이를 그렇게 내보내는 곳만 이 길로 잰다.
   */
  const tree = (
    <PopIdentityProvider
      value={{
        terminalId: 10,
        processes: [{ processId: 20 }],
        equipment: null,
        workerNo: options.workerNo === undefined ? '100029' : options.workerNo,
      }}
    >
      <ProductionFlowScreen />
    </PopIdentityProvider>
  );

  return renderWithProviders(options.strict === true ? <StrictMode>{tree}</StrictMode> : tree, {
    route:
      options.route ??
      `/pop/production-result?workOrderId=${String(WORK_ORDER_ID)}&workerNo=100029`,
    fetch: createStubFetch([...extraRoutes, ...routes(writes)]),
  });
};

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
   * 저장 → 발행 → 그림 → 인쇄 → 보고가 한 줄로 이어지고, 그 끝에서 스캔 칸이 열린다.
   * 한때 클라이언트가 생산 LOT 라벨의 그림 요청을 막아 여기서 멎었다(WIP-CHAIN-01 D1) —
   * 스캔이 열리지 않으면 `:complete` 로 가는 길이 없으므로, 그 이어짐을 여기서 고정한다.
   */
  it('실적을 한 번 저장한 뒤 발행·인쇄까지 이어지고 스캔 칸이 열린다', async () => {
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

    /* 인쇄까지 끝나면 스캔 칸이 열린다 — 여기서부터 LOT 마감으로 갈 수 있다. */
    await waitFor(() => {
      expect(screen.getByLabelText(t.flow.scan.label)).toBeEnabled();
    });
  });

  /*
   * ⛔ **라벨 수량은 수량 칸이 아니라 «실제로 올라간 실적»에서 온다**(리뷰 지적 2026-09-16).
   *    수량 칸은 LOT 이 서면 계획 수량(`initialQty`)으로 미리 채워진다 — 큐에 들어 있던 실적이
   *    적용되는 경로에서는 작업자가 그 칸을 손대지 않으므로, 칸을 읽으면 **실제 보고 수량이
   *    아니라 계획 수량이 라벨에 찍힌다.** 종이는 되돌릴 수 없다.
   *
   *    그래서 이 시험은 계획 수량(12)과 큐에 든 실적(7)을 **일부러 다르게** 둔다. 두 값이 같으면
   *    두 경로가 구분되지 않아 결함이 드러나지 않는다.
   */
  it('⛔ 대기 실적이 적용되면 계획 수량이 아니라 올라간 실적 수량을 라벨에 적는다', async () => {
    const writes: Request[] = [];
    globalThis.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify([
        {
          idempotencyKey: 'queued-result-key',
          workerNo: '100029',
          body: {
            workOrderId: WORK_ORDER_ID,
            goodQty: 7,
            uomId: 1,
            occurredAt: '2026-09-16T09:00:00+09:00',
            lotAllocations: [{ lotId: LOT_ID, allocatedQty: 7 }],
          },
        },
      ]),
    );
    const save = vi.fn().mockResolvedValue('/tmp/lot.prn');
    Object.defineProperty(window, 'pop', {
      configurable: true,
      value: { rendition: { save } },
    });
    renderScreen(writes);

    await waitFor(() => {
      expect(save).toHaveBeenCalledTimes(1);
    });

    const [bytes] = save.mock.calls[0] as [Uint8Array];
    const command = new TextDecoder().decode(bytes);

    expect(command).toContain('"QTY 7 EA"');
    expect(command).not.toContain('"QTY 12 EA"');
  });

  /*
   * ⛔ **라벨은 화면이 짜고 서버 그림은 받지 않는다**(사용자 지시 2026-09-16 · `label-tspl`).
   *    이 배선이 되돌려지면 100 × 60 mm 좌표로 그려진 판이 다시 나가 80 × 30 mm 라벨지에서
   *    잘린다 — 화면은 「인쇄 완료」로 보이므로 시험이 없으면 되돌림을 아무도 못 잡는다.
   */
  it('⛔ 발행하면 서버 그림을 받지 않고 화면이 짠 TSPL 을 그대로 셸에 넘긴다', async () => {
    const writes: Request[] = [];
    const renditionCalls: string[] = [];
    const renditionSpy: StubRoute = {
      match: (request) => pathOf(request).endsWith('/rendition'),
      respond: (request) => {
        renditionCalls.push(pathOf(request));

        return jsonResponse({ errors: [{ message: '부르면 안 되는 경로' }] }, { status: 500 });
      },
    };
    const save = vi.fn().mockResolvedValue('/tmp/lot.prn');
    Object.defineProperty(window, 'pop', {
      configurable: true,
      value: { rendition: { save } },
    });
    const user = userEvent.setup();
    renderScreen(writes, [renditionSpy]);

    const output = await screen.findByRole('button', { name: t.flow.output.issue });
    await waitFor(() => expect(output).toBeEnabled());
    await user.click(output);

    await waitFor(() => {
      expect(save).toHaveBeenCalledTimes(1);
    });
    expect(renditionCalls).toEqual([]);

    const [bytes, , , format] = save.mock.calls[0] as [Uint8Array, string, string, string];
    const command = new TextDecoder().decode(bytes);

    /* ⛔ 바이트가 TSPL 이면 형식도 TSPL 이다 — 셸 사정이 정하지 않는다. */
    expect(format).toBe('tspl');
    expect(command.startsWith('SIZE 80 mm,30 mm')).toBe(true);
    expect(command).toContain(`,M2,"${LOT_NO}"`);
    expect(command).toContain('"LOT ' + LOT_NO + '"');
  });

  /*
   * ⭐ **라벨은 화면이 직접 짠다**(사용자 지시 2026-09-16 · `label-tspl`). 서버에서 그림을 받는
   * 걸음이 사라져 이 시험의 옛 전제(`renditionFailed`)는 더 일어나지 않는다 — 같은 원칙을
   * **프린터로 보내다 실패한** 자리에서 잰다. 다시 눌러도 **같은 멱등 키로 같은 실패 사유만**
   * 다시 보고한다(둘 다 `outcome: FAILED` 라 슬롯이 같다).
   */
  it('인쇄에 실패하면 다시 눌러도 같은 실패 사유를 같은 멱등 키로 다시 보고한다', async () => {
    const writes: Request[] = [];
    const save = vi.fn().mockRejectedValue(new Error('프린터 없음'));
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
    expect(screen.getByText(t.flow.output.printFailed)).toBeVisible();
    expect(save).toHaveBeenCalledTimes(1);

    await user.click(retryPrint);

    await waitFor(() => {
      const reports = writes.filter(
        (request) => pathOf(request) === '/app/document-issues/44001:report-print',
      );
      expect(reports).toHaveLength(2);
    });
    expect(save).toHaveBeenCalledTimes(2);
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
     * 이 시험의 핵심은 **새 발행 기록을 만들지 않고 기존 이력으로 재인쇄만 한다**는 것이다.
     * 실적 저장 한 번 · 신규 발행 0회 · 재인쇄 결과 보고 한 번으로 잰다.
     */
    await waitFor(() => {
      expect(
        writes.filter((request) => pathOf(request) === '/app/document-issues/44001:report-print'),
      ).toHaveLength(1);
    });
    /* 인쇄까지 끝나면 스캔 칸이 열린다 — 여기서부터 LOT 마감으로 갈 수 있다. */
    await waitFor(() => {
      expect(screen.getByLabelText(t.flow.scan.label)).toBeEnabled();
    });
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
   * 인쇄가 끝나면 스캔 칸이 열리고, 라벨 번호를 읽으면 **버튼 없이 곧바로** 마감이 나간다.
   * 막힘을 걷기 전에는 이 갈래에 이를 수 없었다(WIP-CHAIN-01 D1).
   */
  it('인쇄가 끝나면 스캔이 열리고 라벨을 읽는 즉시 LOT 마감이 나간다', async () => {
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

    const scan = await screen.findByLabelText(t.flow.scan.label);
    await waitFor(() => expect(scan).toBeEnabled());
    await user.type(scan, LOT_NO);

    await waitFor(() => {
      expect(attempts).toBe(1);
    });
    /* 마감은 낙관적 잠금 토큰을 싣는다 — 없으면 요청 자체를 보내지 않는다. */
    const complete = writes.find((request) => pathOf(request).endsWith(':complete'));
    expect(complete?.headers.get('If-Match')).not.toBeNull();
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
     * ⚠ **멎는 자리는 스캔 칸이다.** 인쇄까지 끝나면 스캔이 열리고 거기서 멎는다 — 이 시험이
     *    재는 것은 **초과를 말하는 것과 저장이 그대로 나가는 것**이고 그 둘은 인쇄와 무관하다.
     */
    await waitFor(() => {
      expect(screen.getByLabelText(t.flow.scan.label)).toBeEnabled();
    });

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

  /* 공통 [화면 이동]으로 오면 작업지시가 없다 — 할 일까지 말해야 고장으로 읽히지 않는다(#1151). */
  it('작업지시 없이 들어오면 작업 시작 화면에서 고르라고 안내한다', async () => {
    renderScreen([], [], { route: '/pop/production-result' });

    expect(await screen.findByText(t.entry.missingWorkOrder)).toBeInTheDocument();
  });

  it('작업지시를 받고 들어오면 그 안내를 세우지 않는다', async () => {
    renderScreen([]);

    await screen.findByText(/WO-SYN-001/u);

    expect(screen.queryByText(t.entry.missingWorkOrder)).not.toBeInTheDocument();
  });
});

/* 긴급 W/O 에서 넘어오면 긴급 표식이 머리줄에 남는다(`P-02-12` §5-1 · #1147). */
describe('ProductionFlowScreen — 긴급 표식', () => {
  const emergencyWorkOrder: StubRoute = {
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
        workOrderTypeCode: 'EMERGENCY',
        statusCode: 'IN_PROGRESS',
        priorityNo: 1,
        progress: { goodQty: 0, varianceQty: 12 },
      }),
  };

  const header = (): HTMLElement => screen.getAllByRole('banner')[0] as HTMLElement;

  it('긴급 작업지시면 머리줄에 긴급을 세운다', async () => {
    renderScreen([], [emergencyWorkOrder]);

    expect(await within(header()).findByText(t.flow.header.emergency)).toBeInTheDocument();
  });

  it('긴급이 아니면 세우지 않는다', async () => {
    renderScreen([]);

    await within(header()).findByText(/WO-SYN-001/);

    expect(within(header()).queryByText(t.flow.header.emergency)).not.toBeInTheDocument();
  });
});

/*
 * ## 작업 세션 자동 종료
 *
 * 마지막 LOT 을 마감하면 세션이 닫힌다. 안 닫히면 관리웹의 W/O 마감이 `409
 * OPEN_SESSION_EXISTS` 로 막혀, 현장은 다 끝냈는데 지시가 영영 열려 있다.
 *
 * ⛔ **사람이 누르는 [세션 종료]는 이 화면 것이 아니다** — `P-02-10`(작업 중단) 소관이다.
 *    여기서 재는 것은 «저절로 닫히는가»뿐이다.
 */
describe('ProductionFlowScreen · 작업 세션 자동 종료', () => {
  const END_PATH = `/production/work-sessions/${String(WORK_SESSION_ID)}:end`;

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

  /**
   * 마감 전에는 LOT 한 건을 주고, **마감이 나간 뒤부터는 빈 목록**을 준다 — 「선발행 LOT 이
   * 더 없다」가 그 모양이다.
   */
  const lotsDrainedAfterComplete = (state: { completed: boolean }): StubRoute => ({
    match: (request) => pathOf(request) === '/trace/lots',
    respond: (request) => {
      const url = new URL(request.url);
      if (url.searchParams.get('completed') === 'true') {
        return jsonResponse({ items: [], page: { page: 1, size: 100, total: 0 } });
      }
      if (state.completed) {
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
            workOrderSequenceNo: 1,
            workOrderLotCount: 1,
            progress: { goodQty: 0, varianceQty: 12 },
          },
        ],
        page: { page: 1, size: 20, total: 1 },
      });
    },
  });

  const completeDrains = (state: { completed: boolean }, writes: Request[]): StubRoute => ({
    match: (request) => pathOf(request) === `/trace/lots/${String(LOT_ID)}:complete`,
    respond: (request) => {
      writes.push(request.clone());
      state.completed = true;

      return jsonResponse({
        lotId: LOT_ID,
        lotNo: LOT_NO,
        completedAt: '2026-09-16T10:00:00+09:00',
      });
    },
  });

  /** 발행 → 인쇄 → 스캔까지 몰고 가 LOT 하나를 마감시킨다. */
  const completeCurrentLot = async (user: ReturnType<typeof userEvent.setup>): Promise<void> => {
    const output = await screen.findByRole('button', { name: t.flow.output.issue });
    await waitFor(() => expect(output).toBeEnabled());
    await user.click(output);

    const scan = await screen.findByLabelText(t.flow.scan.label);
    await waitFor(() => expect(scan).toBeEnabled());
    await user.type(scan, LOT_NO);
  };

  it('마지막 LOT 을 마감하면 세션 종료가 나간다 — 본문은 끝 시각 하나다', async () => {
    const writes: Request[] = [];
    const state = { completed: false };
    const endRoute: StubRoute = {
      match: (request) => request.method === 'POST' && pathOf(request) === END_PATH,
      respond: (request) => {
        writes.push(request.clone());
        return jsonResponse({
          workSessionId: WORK_SESSION_ID,
          workOrderId: WORK_ORDER_ID,
          sessionNo: 1,
          terminalId: 10,
          startedAt: '2026-09-16T09:00:00+09:00',
          endedAt: '2026-09-16T10:00:00+09:00',
          statusCode: 'ENDED',
        });
      },
    };
    const user = userEvent.setup();
    renderScreen(writes, [
      endRoute,
      completeDrains(state, writes),
      lotsDrainedAfterComplete(state),
    ]);

    await completeCurrentLot(user);

    const end = await waitFor(() => {
      const found = writes.find((request) => pathOf(request) === END_PATH);
      expect(found).toBeDefined();
      return found as Request;
    });

    /* 귀속 사번과 멱등 키는 계약이 «필수»로 둔 헤더다 — 없으면 서버가 거부한다. */
    expect(end.headers.get('X-Worker-No')).toBe('100029');
    expect(end.headers.get('Idempotency-Key')).not.toBeNull();

    /*
     * ⛔ **`stopReasonCode` 를 싣지 않는다** — 계약이 「비우기로 정했다」로 못박은 칸이다
     *    (A-21 · A-25). 자리가 있다고 채우면 정한 것을 화면이 되돌린다.
     */
    const body = (await end.json()) as Record<string, unknown>;
    expect(Object.keys(body)).toEqual(['endedAt']);

    /*
     * ⛔ **잘 닫힌 것은 말하지 않는다**(사용자 지시 2026-09-16). 「생산할 LOT이 없습니다」가
     *    이미 서 있으므로 성공 안내를 얹지 않는다 — 요청이 나갔다는 사실로 잰다.
     */
    expect(screen.queryByRole('button', { name: t.flow.session.retry })).not.toBeInTheDocument();
  });

  it('생산할 LOT 이 남아 있으면 세션을 닫지 않는다', async () => {
    const writes: Request[] = [];
    /* 마감해도 목록이 마르지 않는다 — 이 작업지시에 선발행 LOT 이 더 달려 있는 경우다. */
    const state = { completed: false };
    const user = userEvent.setup();
    renderScreen(writes, [
      completeDrains({ completed: false }, writes),
      lotsDrainedAfterComplete(state),
    ]);

    await completeCurrentLot(user);

    await waitFor(() => {
      expect(writes.some((request) => pathOf(request).endsWith(':complete'))).toBe(true);
    });
    expect(writes.some((request) => pathOf(request) === END_PATH)).toBe(false);
  });

  it('작업 완료 권한이 없으면 마감도 세션 종료도 일어나지 않는다', async () => {
    const writes: Request[] = [];
    const deniedGate: StubRoute = {
      match: (request) => pathOf(request) === '/mdm/terminals/10/processes',
      respond: () =>
        jsonResponse({
          items: [
            { processId: 20, canInputResult: true, canPrintLabel: true, canCompleteWork: false },
          ],
        }),
    };
    const state = { completed: false };
    const user = userEvent.setup();
    renderScreen(writes, [
      deniedGate,
      completeDrains(state, writes),
      lotsDrainedAfterComplete(state),
    ]);

    const output = await screen.findByRole('button', { name: t.flow.output.issue });
    await waitFor(() => expect(output).toBeEnabled());
    await user.click(output);

    /* 권한이 없으면 스캔 칸 자체가 잠긴다 — 마감에 이를 길이 없고, 따라서 세션도 닫히지 않는다. */
    const scan = await screen.findByLabelText(t.flow.scan.label);
    await waitFor(() => expect(scan).toBeDisabled());
    expect(writes.some((request) => pathOf(request) === END_PATH)).toBe(false);
  });

  it('종료가 실패하면 다시 시도를 내고 같은 멱등 키로 다시 보낸다', async () => {
    const writes: Request[] = [];
    const state = { completed: false };
    let attempts = 0;
    const endRoute: StubRoute = {
      match: (request) => request.method === 'POST' && pathOf(request) === END_PATH,
      respond: (request) => {
        writes.push(request.clone());
        attempts += 1;
        if (attempts === 1) return jsonResponse({ message: '일시 장애' }, { status: 500 });

        return jsonResponse({
          workSessionId: WORK_SESSION_ID,
          workOrderId: WORK_ORDER_ID,
          sessionNo: 1,
          terminalId: 10,
          startedAt: '2026-09-16T09:00:00+09:00',
          endedAt: '2026-09-16T10:00:00+09:00',
          statusCode: 'ENDED',
        });
      },
    };
    const user = userEvent.setup();
    renderScreen(writes, [
      endRoute,
      completeDrains(state, writes),
      lotsDrainedAfterComplete(state),
    ]);

    await completeCurrentLot(user);

    const retry = await screen.findByRole('button', { name: t.flow.session.retry });
    await user.click(retry);

    await waitFor(() => {
      expect(attempts).toBe(2);
    });

    /*
     * ⭐ **같은 키로 다시 보낸다.** 앞 시도가 서버에 닿았는지 모르는 채 새 키로 보내면 서버가
     *    두 요청을 묶어 주지 못해, 되돌릴 수 없는 전이가 두 번 실행될 여지가 생긴다(C-1 #5).
     */
    const ends = writes.filter((request) => pathOf(request) === END_PATH);
    expect(ends).toHaveLength(2);
    expect(ends[0]?.headers.get('Idempotency-Key')).toBe(ends[1]?.headers.get('Idempotency-Key'));

    /* 닫히고 나면 안내가 사라진다 — 잘 된 것은 말하지 않는다. */
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: t.flow.session.retry })).not.toBeInTheDocument();
    });
  });

  it('이미 종료된 세션이면 실패가 아니라 「이미 종료」로 말한다', async () => {
    const writes: Request[] = [];
    const state = { completed: false };
    const endRoute: StubRoute = {
      match: (request) => request.method === 'POST' && pathOf(request) === END_PATH,
      respond: (request) => {
        writes.push(request.clone());
        return jsonResponse(
          { errors: [{ scope: 'screen', code: 'STATE_LOCKED', message: '이미 종료된 세션' }] },
          { status: 400 },
        );
      },
    };
    const user = userEvent.setup();
    renderScreen(writes, [
      endRoute,
      completeDrains(state, writes),
      lotsDrainedAfterComplete(state),
    ]);

    await completeCurrentLot(user);

    await waitFor(() => {
      expect(writes.some((request) => pathOf(request) === END_PATH)).toBe(true);
    });
    /* 이미 닫혀 있으면 원하던 상태가 이미 섰다 — 실패로 말하지 않으므로 재시도도 권하지 않는다. */
    expect(screen.queryByRole('button', { name: t.flow.session.retry })).not.toBeInTheDocument();
  });
});

/*
 * ⭐ **세션 종료가 두 번 나가면 안 된다.** 되돌릴 수 없는 전이라, 방아쇠가 두 번 당겨지면
 *    서버가 같은 세션을 두 번 닫으려 든다. POP 은 실제로 `StrictMode` 아래서 돌고
 *    (`app/pop-main.tsx`), 그 이중 실행이 **효과로 쓰기를 내보내는 이 자리**를 정확히 때린다.
 */
describe('ProductionFlowScreen · 자동 종료는 한 번만 나간다', () => {
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

  it('StrictMode 이중 실행에도 세션 종료는 한 번만 나간다', async () => {
    const writes: Request[] = [];
    const state = { completed: false };
    const END_PATH = `/production/work-sessions/${String(WORK_SESSION_ID)}:end`;
    let ends = 0;

    const lotsRoute: StubRoute = {
      match: (request) => pathOf(request) === '/trace/lots',
      respond: (request) => {
        const url = new URL(request.url);
        if (url.searchParams.get('completed') === 'true') {
          return jsonResponse({ items: [], page: { page: 1, size: 100, total: 0 } });
        }
        if (state.completed) {
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
              workOrderSequenceNo: 1,
              workOrderLotCount: 1,
              progress: { goodQty: 0, varianceQty: 12 },
            },
          ],
          page: { page: 1, size: 20, total: 1 },
        });
      },
    };
    const completeRoute: StubRoute = {
      match: (request) => pathOf(request) === `/trace/lots/${String(LOT_ID)}:complete`,
      respond: (request) => {
        writes.push(request.clone());
        state.completed = true;

        return jsonResponse({
          lotId: LOT_ID,
          lotNo: LOT_NO,
          completedAt: '2026-09-16T10:00:00+09:00',
        });
      },
    };
    const endRoute: StubRoute = {
      match: (request) => request.method === 'POST' && pathOf(request) === END_PATH,
      respond: (request) => {
        writes.push(request.clone());
        ends += 1;

        return jsonResponse({
          workSessionId: WORK_SESSION_ID,
          workOrderId: WORK_ORDER_ID,
          sessionNo: 1,
          terminalId: 10,
          startedAt: '2026-09-16T09:00:00+09:00',
          endedAt: '2026-09-16T10:00:00+09:00',
          statusCode: 'ENDED',
        });
      },
    };

    const user = userEvent.setup();
    renderScreen(writes, [endRoute, completeRoute, lotsRoute], { strict: true });

    const output = await screen.findByRole('button', { name: t.flow.output.issue });
    await waitFor(() => expect(output).toBeEnabled());
    await user.click(output);

    const scan = await screen.findByLabelText(t.flow.scan.label);
    await waitFor(() => expect(scan).toBeEnabled());
    await user.type(scan, LOT_NO);

    await waitFor(() => {
      expect(ends).toBe(1);
    });
  });

  /*
   * ⛔ **열어 보기만 해서는 닫히지 않는다.** 이미 다 돌린 작업지시를 열면 「생산할 LOT 이
   *    없습니다」가 처음부터 떠 있는데, 그 상태만 보고 닫으면 남이 돌리던 세션을 구경하던
   *    단말이 끊는다. 닫는 근거는 «이 단말이 마지막 LOT 을 마감했다»는 사실이다.
   */
  it('LOT 이 처음부터 없는 작업지시를 열기만 하면 세션을 닫지 않는다', async () => {
    const writes: Request[] = [];
    const END_PATH = `/production/work-sessions/${String(WORK_SESSION_ID)}:end`;
    const emptyLots: StubRoute = {
      match: (request) => pathOf(request) === '/trace/lots',
      respond: () => jsonResponse({ items: [], page: { page: 1, size: 20, total: 0 } }),
    };

    renderScreen(writes, [emptyLots]);

    expect(await screen.findByText(t.flow.currentLot.none)).toBeInTheDocument();
    expect(writes.some((request) => pathOf(request) === END_PATH)).toBe(false);
  });
});
