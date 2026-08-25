import { messages } from '@omf-mes/i18n';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import {
  createStubFetch,
  jsonResponse,
  renderWithProviders,
  type StubFetch,
  type StubRoute,
} from '../../test/api-harness';
import { ProductionOrderScreen } from './screen';

const t = messages.productionOrder;
const exact = (request: Request, path: string): boolean => new URL(request.url).pathname === path;
const page = (items: unknown[]) => ({ items, page: { page: 1, size: 25, total: items.length } });
const order = {
  productionOrderId: 701,
  productionOrderNo: 'SYN-PO-701',
  erpOrderNo: 'SYN-ERP-701',
  parentProductionOrderId: null,
  bomLevel: 0,
  businessUnitId: 2101,
  plantId: 3101,
  itemId: 7101,
  orderQty: 12.5,
  uomId: 8101,
  dueDate: '2026-08-31',
  statusCode: 'SYN-READY',
  expandedWorkOrderCount: 1,
  plannedWorkOrderCount: 1,
};
const references: StubRoute[] = [
  {
    match: (request) => exact(request, '/mdm/business-units'),
    respond: () =>
      jsonResponse(
        page([
          {
            businessUnitId: 2101,
            legalEntityId: 1101,
            businessUnitCode: 'SYN-BU',
            businessUnitName: 'Synthetic unit',
            isActive: true,
          },
        ]),
      ),
  },
  {
    match: (request) => exact(request, '/mdm/plants'),
    respond: () =>
      jsonResponse(
        page([
          {
            plantId: 3101,
            legalEntityId: 1101,
            businessUnitId: 2101,
            plantCode: 'SYN-PLANT',
            plantName: 'Synthetic plant',
            timezoneCode: 'Asia/Seoul',
            isActive: true,
          },
        ]),
      ),
  },
  {
    match: (request) => exact(request, '/mdm/uoms'),
    respond: () =>
      jsonResponse(
        page([
          {
            uomId: 8101,
            uomCode: 'SYN-EA',
            uomName: 'Synthetic each',
            decimalScale: 0,
            isActive: true,
          },
        ]),
      ),
  },
];
const normalRoutes: StubRoute[] = [
  ...references,
  {
    match: (request) => exact(request, '/planning/production-orders'),
    respond: () => jsonResponse({ items: [order], page: { page: 2, size: 25, total: 26 } }),
  },
  {
    match: (request) => exact(request, '/mdm/items/7101'),
    respond: () =>
      jsonResponse({
        item: {
          itemId: 7101,
          itemCode: 'SYN-ITEM',
          itemName: 'Synthetic item',
          itemTypeCode: 'MATERIAL',
          baseUomId: 8101,
          lotControlTypeCode: 'NONE',
          serialControlTypeCode: 'NONE',
          inspectionRequired: false,
          fifoPolicyCode: 'FIFO',
          negativeStockAllowed: false,
          isActive: true,
        },
        editability: { codeEditable: false, reason: 'RECEIVED_FROM_ERP', referenceCount: null },
      }),
  },
  {
    match: (request) => exact(request, '/planning/production-orders/701'),
    respond: () => jsonResponse({ ...order, remarks: 'Synthetic note' }),
  },
  {
    match: (request) => exact(request, '/planning/production-plans'),
    respond: () =>
      jsonResponse(
        page([
          {
            productionPlanId: 501,
            productionOrderId: 701,
            planNo: 'SYN-PLAN-501',
            planDate: '2026-08-25',
            plannedQty: 12.5,
            uomId: 8101,
            bomId: 8201,
            routingId: 8301,
            statusCode: 'SYN-DRAFT',
          },
        ]),
      ),
  },
  {
    match: (request) => exact(request, '/production/work-orders'),
    respond: () =>
      jsonResponse(
        page([
          {
            workOrderId: 601,
            workOrderNo: 'SYN-WO-601',
            productionPlanId: 501,
            routingOperationId: 6101,
            itemId: 7101,
            orderQty: 12.5,
            uomId: 8101,
            workOrderTypeCode: 'SYN-NORMAL',
            priorityNo: 1,
            statusCode: 'SYN-READY',
          },
        ]),
      ),
  },
];

const recordingFetch = (routes: StubRoute[]): { fetch: StubFetch; requests: URL[] } => {
  const requests: URL[] = [];
  const stub = createStubFetch(routes);
  return {
    requests,
    fetch: async (request) => {
      requests.push(new URL(request.url));
      return stub(request);
    },
  };
};

describe('ProductionOrderScreen', () => {
  it('URL 목록 조건을 조회하고 선택 뒤에만 exact 기본·계획·W/O를 연결한다', async () => {
    const { fetch, requests } = recordingFetch(normalRoutes);
    renderWithProviders(<ProductionOrderScreen />, {
      fetch,
      route: '/?businessUnit=2101&page=2',
    });
    const user = userEvent.setup();
    const select = await screen.findByRole('button', { name: t.actions.select('SYN-PO-701') });
    const listRequest = requests.find((url) => url.pathname === '/planning/production-orders');
    expect(listRequest?.searchParams.get('businessUnitId')).toBe('2101');
    expect(listRequest?.searchParams.get('includeChildren')).toBe('true');
    expect(listRequest?.searchParams.get('page')).toBe('2');
    expect(requests.some((url) => url.pathname === '/planning/production-orders/701')).toBe(false);

    await user.click(select);
    expect(await screen.findByText('SYN-PLAN-501')).toBeInTheDocument();
    expect(await screen.findByText('SYN-WO-601')).toBeInTheDocument();
    expect(screen.getAllByText('SYN-ERP-701').length).toBeGreaterThan(0);
    await waitFor(() =>
      expect(
        requests
          .filter((url) =>
            ['/planning/production-plans', '/production/work-orders'].includes(url.pathname),
          )
          .map((url) => url.search),
      ).toEqual(['?productionOrderId=701', '?productionOrderId=701']),
    );
    expect(screen.queryByRole('button', { name: /재동기/ })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: t.actions.integrationSync })).toHaveAttribute(
      'href',
      '/master-data/integration-sync',
    );
  });

  it('목록 실패를 빈 성공으로 바꾸지 않고 상세 요청도 시작하지 않는다', async () => {
    const { fetch, requests } = recordingFetch([
      ...references,
      {
        match: (request) => exact(request, '/planning/production-orders'),
        respond: () => jsonResponse({ message: 'synthetic failure' }, { status: 500 }),
      },
    ]);
    renderWithProviders(<ProductionOrderScreen />, { fetch });

    expect(await screen.findByRole('alert')).toHaveTextContent(t.listLoadFailedTitle);
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(requests.some((url) => url.pathname.includes('/planning/production-orders/'))).toBe(
      false,
    );
  });
});
