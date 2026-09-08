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
import { ProductionFlowScreen } from './production-flow-screen';

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

  it('개체만 생성된 중간 상태는 인식표 발행 기록만 복구하고 개체를 다시 만들지 않는다', async () => {
    const writes: Request[] = [];
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
        match: (request) => pathOf(request) === '/app/document-issues/summary',
        respond: () =>
          jsonResponse({
            items: [
              { targetTypeCode: 'SERIAL_NUMBER', targetId: 31, issueCount: 1 },
              { targetTypeCode: 'SERIAL_NUMBER', targetId: 32, issueCount: 0 },
            ],
          }),
      },
    ];
    const user = userEvent.setup();
    renderScreen(writes, extraRoutes);

    await user.click(await screen.findByRole('button', { name: t.flow.tag.restoreDocuments(1) }));

    await waitFor(() =>
      expect(writes.filter((request) => pathOf(request) === '/app/document-issues')).toHaveLength(
        1,
      ),
    );
    expect(writes.some((request) => pathOf(request) === '/trace/serial-numbers')).toBe(false);
    await expect(
      writes.find((request) => pathOf(request) === '/app/document-issues')?.json(),
    ).resolves.toMatchObject({
      documentTypeCode: 'IDENTIFICATION_TAG',
      targets: [{ targetTypeCode: 'SERIAL_NUMBER', targetId: 32, lotId: LOT_ID }],
    });
  });
});
