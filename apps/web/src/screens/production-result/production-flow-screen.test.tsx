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
  {
    match: (request) => pathOf(request) === `/trace/lots/${String(LOT_ID)}:complete`,
    respond: (request) => {
      writes.push(request.clone());
      return jsonResponse({ lotId: LOT_ID, lotNo: LOT_NO, completedAt: new Date().toISOString() });
    },
  },
];

const renderScreen = (writes: Request[], extraRoutes: StubRoute[] = []) =>
  renderWithProviders(
    <PopIdentityProvider value={{ terminalId: 10, processId: 20, workerNo: '100029' }}>
      <ProductionFlowScreen />
    </PopIdentityProvider>,
    {
      route: `/pop/production-result?workOrderId=${String(WORK_ORDER_ID)}&workerNo=100029`,
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

  it('실적을 한 번 저장한 뒤에만 발행·인쇄하고, 일치 스캔으로 LOT을 마감한다', async () => {
    const writes: Request[] = [];
    const user = userEvent.setup();
    renderScreen(writes);

    const output = await screen.findByRole('button', { name: t.flow.output.issue });
    await waitFor(() => expect(output).toBeEnabled());
    await user.click(output);
    await user.click(output);

    const scan = await screen.findByLabelText(t.flow.scan.label);
    await waitFor(() => expect(scan).toBeEnabled());

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

    await user.type(scan, 'WRONG');
    expect(writes.some((request) => pathOf(request).endsWith(':complete'))).toBe(false);

    await user.clear(scan);
    await user.type(scan, LOT_NO);

    await waitFor(() =>
      expect(
        writes.filter((request) => pathOf(request) === `/trace/lots/${String(LOT_ID)}:complete`),
      ).toHaveLength(1),
    );
  });

  it('물리 인쇄 뒤 보고만 실패하면 종이를 다시 뽑지 않고 같은 결과 보고만 재시도한다', async () => {
    const writes: Request[] = [];
    const save = vi.fn().mockResolvedValue('/tmp/lot.prn');
    let renditionCalls = 0;
    let reportAttempts = 0;
    const reportOnlyFailureRoutes: StubRoute[] = [
      {
        match: (request) => pathOf(request) === '/app/document-issues/44001/rendition',
        respond: () => {
          renditionCalls += 1;
          return new Response(new Uint8Array([1, 2, 3]));
        },
      },
      {
        match: (request) => pathOf(request) === '/app/document-issues/44001:report-print',
        respond: (request) => {
          writes.push(request.clone());
          reportAttempts += 1;

          return reportAttempts === 1
            ? jsonResponse({ errors: [{ message: '보고 실패' }] }, { status: 500 })
            : new Response(null, { status: 204 });
        },
      },
    ];
    Object.defineProperty(window, 'pop', {
      configurable: true,
      value: { rendition: { save } },
    });
    const user = userEvent.setup();
    renderScreen(writes, reportOnlyFailureRoutes);

    const output = await screen.findByRole('button', { name: t.flow.output.issue });
    await waitFor(() => expect(output).toBeEnabled());
    await user.click(output);

    const retryReport = await screen.findByRole('button', { name: t.flow.output.retryReport });
    expect(screen.getByText(t.flow.output.reportFailed)).toBeVisible();
    expect(save).toHaveBeenCalledTimes(1);
    expect(renditionCalls).toBe(1);

    await user.click(retryReport);

    const scan = await screen.findByLabelText(t.flow.scan.label);
    await waitFor(() => expect(scan).toBeEnabled());
    expect(save).toHaveBeenCalledTimes(1);
    expect(renditionCalls).toBe(1);

    const reports = writes.filter(
      (request) => pathOf(request) === '/app/document-issues/44001:report-print',
    );
    expect(reports).toHaveLength(2);
    expect(reports[0]?.headers.get('Idempotency-Key')).toBe(
      reports[1]?.headers.get('Idempotency-Key'),
    );
  });

  it('서버 적용 실적으로 재진입하면 수량을 잠그고 생산 실적 없이 라벨 단계만 재개한다', async () => {
    const writes: Request[] = [];
    const user = userEvent.setup();
    const appliedLot: StubRoute = {
      match: (request) => pathOf(request) === '/trace/lots',
      respond: (request) => {
        const url = new URL(request.url);
        if (url.searchParams.get('currentOnly') !== 'true') {
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
              workOrderLotCount: 3,
              progress: { goodQty: 8, varianceQty: -4 },
            },
          ],
          page: { page: 1, size: 20, total: 1 },
        });
      },
    };
    renderScreen(writes, [appliedLot]);

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
            resultSourceCode: 'MANUAL',
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

    const scan = await screen.findByLabelText(t.flow.scan.label);
    await waitFor(() => expect(scan).toBeEnabled());
    expect(
      writes.filter((request) => pathOf(request) === '/production/production-results'),
    ).toHaveLength(1);
    expect(
      writes.filter(
        (request) => request.method === 'POST' && pathOf(request) === '/app/document-issues',
      ),
    ).toHaveLength(0);
    expect(
      writes.filter((request) => pathOf(request) === '/app/document-issues/44001:report-print'),
    ).toHaveLength(1);
  });

  it('LOT 마감 실패 뒤 스캔값을 비워 같은 라벨을 다시 스캔할 수 있다', async () => {
    const writes: Request[] = [];
    let attempts = 0;
    const completeRoute: StubRoute = {
      match: (request) => pathOf(request) === `/trace/lots/${String(LOT_ID)}:complete`,
      respond: (request) => {
        writes.push(request.clone());
        attempts += 1;

        return attempts === 1
          ? jsonResponse({ errors: [{ message: 'temporary' }] }, { status: 500 })
          : jsonResponse({ lotId: LOT_ID, lotNo: LOT_NO, completedAt: new Date().toISOString() });
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
    await waitFor(() => expect(scan).toHaveValue(''));
    await user.type(scan, LOT_NO);

    await waitFor(() => expect(attempts).toBe(2));
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
          if (url.searchParams.get('currentOnly') !== 'true') {
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
    const user = userEvent.setup();
    renderScreen(writes, extraRoutes);

    const issue = await screen.findByRole('button', { name: t.flow.tag.issueMissing(1001) });
    await waitFor(() => expect(issue).toBeEnabled());
    await user.click(issue);

    await waitFor(() =>
      expect(writes.filter((request) => pathOf(request) === '/trace/serial-numbers')).toHaveLength(
        2,
      ),
    );
    const quantities = await Promise.all(
      writes
        .filter((request) => pathOf(request) === '/trace/serial-numbers')
        .map(async (request) => ((await request.json()) as { quantity: number }).quantity),
    );
    expect(quantities).toEqual([1000, 1]);
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

    const failedTag = await screen.findByRole('checkbox', {
      name: `SN-31 · ${t.flow.tag.printOutcome.FAILED}`,
    });
    await user.click(failedTag);
    expect(screen.getByRole('button', { name: t.flow.tag.reissue })).toBeEnabled();
    await user.click(await screen.findByRole('button', { name: t.flow.tag.restoreDocuments(1) }));

    await waitFor(() =>
      expect(writes.filter((request) => pathOf(request) === '/app/document-issues')).toHaveLength(
        1,
      ),
    );
    expect(writes.some((request) => pathOf(request) === '/trace/serial-numbers')).toBe(false);
    await waitFor(() => expect(summaryReads).toBeGreaterThan(1));
    await expect(
      writes.find((request) => pathOf(request) === '/app/document-issues')?.json(),
    ).resolves.toMatchObject({
      documentTypeCode: 'IDENTIFICATION_TAG',
      targets: [{ targetTypeCode: 'SERIAL_NUMBER', targetId: 32, lotId: LOT_ID }],
      printerName: 'tag-printer',
    });
  });
});
