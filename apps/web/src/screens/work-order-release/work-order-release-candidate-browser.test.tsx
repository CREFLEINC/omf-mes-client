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
import { WorkOrderReleaseCandidateBrowser } from './work-order-release-candidate-browser';

const t = messages.workOrderRelease;
const workOrder = (workOrderId: number, itemId: number) => ({
  workOrderId,
  workOrderNo: `SYN-WO-${String(workOrderId)}`,
  productionPlanId: 501,
  routingOperationId: 601,
  itemId,
  orderQty: 12.5,
  uomId: 920001,
  workOrderTypeCode: 'SYN-NORMAL',
  priorityNo: 2,
  statusCode: 'SYN-READY',
});
const item = (itemId: number) => ({
  item: {
    itemId,
    itemCode: `SYN-ITEM-${String(itemId)}`,
    itemName: `Synthetic Item ${String(itemId)}`,
    itemTypeCode: 'MATERIAL',
    baseUomId: 920001,
    lotControlTypeCode: 'NONE',
    serialControlTypeCode: 'NONE',
    inspectionRequired: false,
    fifoPolicyCode: 'FIFO',
    negativeStockAllowed: false,
    isActive: true,
  },
  editability: { codeEditable: false, reason: 'RECEIVED_FROM_ERP', referenceCount: null },
});
const route = (pathname: string, respond: StubRoute['respond'], method = 'GET'): StubRoute => ({
  match: (request) => request.method === method && new URL(request.url).pathname === pathname,
  respond,
});
const lookupRoutes = (total = 1): StubRoute[] => [
  route('/mdm/code-values', () =>
    jsonResponse({
      items: [
        {
          codeValueId: 1,
          codeGroupId: 2,
          code: 'SYN-READY',
          codeName: 'Synthetic Ready',
          displayOrder: 1,
          isActive: true,
        },
      ],
      page: { page: 1, size: 200, total },
    }),
  ),
  route('/mdm/production-lines', () =>
    jsonResponse({
      items: [
        {
          productionLineId: 301,
          plantId: 101,
          lineCode: 'SYN-LINE',
          lineName: 'Synthetic Line',
          lineTypeCode: 'LINE',
          isActive: true,
        },
      ],
      page: { page: 1, size: 200, total },
    }),
  ),
  route('/mdm/uoms', () =>
    jsonResponse({
      items: [
        {
          uomId: 920001,
          uomCode: 'SYN-EA',
          uomName: 'Synthetic Each',
          decimalScale: 0,
          isActive: true,
        },
      ],
      page: { page: 1, size: 20, total: 1 },
    }),
  ),
];

describe('WorkOrderReleaseCandidateBrowser', () => {
  it('connects lookup, search, candidate rows, selection, page, and clear lifetimes', async () => {
    const requests: URL[] = [];
    let candidateMode: 'normal' | 'failed' | 'missing' = 'normal';
    const stub = createStubFetch([
      ...lookupRoutes(),
      route('/production/work-orders', (request) => {
        if (candidateMode === 'failed') {
          return jsonResponse({ message: 'Synthetic unavailable' }, { status: 503 });
        }
        const page = Number(new URL(request.url).searchParams.get('page'));
        const id = page === 2 || candidateMode === 'missing' ? 702 : 701;
        return jsonResponse({
          items: [workOrder(id, id + 910000)],
          page: { page, size: 1, total: candidateMode === 'missing' ? 1 : 2 },
        });
      }),
      route('/mdm/items/910701', () => jsonResponse(item(910701))),
      route('/mdm/items/910702', () => jsonResponse(item(910702))),
    ]);
    const fetch: StubFetch = async (request) => {
      requests.push(new URL(request.url));
      return stub(request);
    };
    const user = userEvent.setup();
    const { queryClient } = renderWithProviders(
      <WorkOrderReleaseCandidateBrowser
        renderSelection={({ selectedWorkOrderId, clearSelection }) => (
          <div>
            <p>SELECTION:{selectedWorkOrderId === null ? 'NONE' : String(selectedWorkOrderId)}</p>
            <button type="button" onClick={clearSelection}>
              CLEAR SELECTION
            </button>
          </div>
        )}
      />,
      { fetch },
    );

    await waitFor(() =>
      expect(requests.filter((url) => url.pathname === '/mdm/uoms')).toHaveLength(1),
    );
    expect(requests.some((url) => url.pathname === '/production/work-orders')).toBe(false);
    await user.click(screen.getByRole('combobox', { name: t.filter.status }));
    await user.click(screen.getByRole('option', { name: 'Synthetic Ready' }));
    await user.click(screen.getByRole('combobox', { name: t.filter.productionLine }));
    await user.click(screen.getByRole('option', { name: /SYN-LINE/ }));
    await user.type(screen.getByLabelText(t.filter.plannedStartFrom), '2026-08-26');
    await user.click(screen.getByRole('button', { name: t.filter.search }));
    expect(
      await screen.findByRole('button', { name: t.candidateList.actions.select('SYN-WO-701') }),
    ).toBeVisible();
    const firstRequest = requests.find((url) => url.pathname === '/production/work-orders');
    expect(Array.from(firstRequest?.searchParams.entries() ?? [])).toEqual([
      ['statusCode', 'SYN-READY'],
      ['productionLineId', '301'],
      ['plannedStartFrom', '2026-08-26'],
      ['page', '1'],
    ]);

    await user.click(
      screen.getByRole('button', { name: t.candidateList.actions.select('SYN-WO-701') }),
    );
    expect(screen.getByText('SELECTION:701')).toBeVisible();
    await user.click(screen.getByRole('button', { name: messages.workOrder.pageNav.next }));
    expect(
      await screen.findByRole('button', { name: t.candidateList.actions.select('SYN-WO-702') }),
    ).toBeVisible();
    expect(screen.getByText('SELECTION:NONE')).toBeVisible();
    await user.click(screen.getByRole('button', { name: messages.workOrder.pageNav.previous }));
    await user.click(
      await screen.findByRole('button', { name: t.candidateList.actions.select('SYN-WO-701') }),
    );
    candidateMode = 'failed';
    void queryClient.refetchQueries({ queryKey: ['work-order-release', 'candidates'] });
    expect(await screen.findByText(messages.httpError.loadTitle)).toBeVisible();
    expect(screen.queryByRole('table')).toBeNull();
    expect(screen.getByText('SELECTION:701')).toBeVisible();
    candidateMode = 'missing';
    await user.click(screen.getByRole('button', { name: messages.common.retry }));
    const replacement = await screen.findByRole('button', {
      name: t.candidateList.actions.select('SYN-WO-702'),
    });
    await waitFor(() => expect(screen.getByText('SELECTION:NONE')).toBeVisible());
    await user.click(replacement);
    await user.click(screen.getByRole('button', { name: 'CLEAR SELECTION' }));
    expect(screen.getByText('SELECTION:NONE')).toBeVisible();
  });

  it('disables partial status and line lookups without starting candidate reads', async () => {
    const requests: URL[] = [];
    const stub = createStubFetch(lookupRoutes(2));
    renderWithProviders(<WorkOrderReleaseCandidateBrowser />, {
      fetch: async (request) => {
        requests.push(new URL(request.url));
        return stub(request);
      },
    });

    const status = await screen.findByRole('combobox', { name: t.filter.status });
    const line = screen.getByRole('combobox', { name: t.filter.productionLine });
    await waitFor(() => {
      expect(status).toBeDisabled();
      expect(status).toHaveAccessibleDescription(t.filter.statusLookupTruncated);
      expect(line).toBeDisabled();
      expect(line).toHaveAccessibleDescription(t.filter.productionLineLookupTruncated);
    });
    expect(requests.some((url) => url.pathname === '/production/work-orders')).toBe(false);
  });

  it('shows candidate failure above stale rows and retries the exact applied query', async () => {
    let attempts = 0;
    const stub = createStubFetch([
      ...lookupRoutes(),
      route('/production/work-orders', () => {
        attempts += 1;
        return attempts === 1
          ? jsonResponse({ message: 'Synthetic unavailable' }, { status: 503 })
          : jsonResponse({ items: [], page: { page: 1, size: 20, total: 0 } });
      }),
    ]);
    const user = userEvent.setup();
    renderWithProviders(<WorkOrderReleaseCandidateBrowser />, { fetch: stub });
    await user.click(await screen.findByRole('combobox', { name: t.filter.status }));
    await user.click(screen.getByRole('option', { name: 'Synthetic Ready' }));
    await user.click(screen.getByRole('button', { name: t.filter.search }));

    expect(await screen.findByText(messages.httpError.loadTitle)).toBeVisible();
    expect(screen.queryByRole('table')).toBeNull();
    await user.click(screen.getByRole('button', { name: messages.common.retry }));
    await waitFor(() => expect(attempts).toBe(2));
    expect(await screen.findByText(t.candidateList.empty.title)).toBeVisible();
  });
});
