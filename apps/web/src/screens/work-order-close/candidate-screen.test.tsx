import { messages } from '@omf-mes/i18n';
import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { jsonResponse, renderWithProviders, type StubFetch } from '../../test/api-harness';
import {
  toWorkOrderCloseCandidateSnapshot,
  toWorkOrderCloseDetailScreenState,
  WorkOrderCloseCandidateScreen,
} from './candidate-screen';
import { toWorkOrderCloseDetailFact } from './queries';

const t = messages.workOrderClose;
const paths = {
  status: '/mdm/code-values',
  orders: '/planning/production-orders',
  candidates: '/production/work-orders',
  detail: (workOrderId: number) => `/production/work-orders/${String(workOrderId)}`,
  uoms: '/mdm/uoms',
};
type LookupMode = 'ready' | 'pending' | 'error' | 'truncated';
const page = (total = 1, current = 1) => ({ page: current, size: 20, total });
const statusBody = (total = 1) => ({
  items: [{ code: 'COMPLETED', codeName: '마감 완료', displayOrder: 1, isActive: true }],
  page: { page: 1, size: 200, total },
});
const orderBody = (total = 1) => ({
  items: [{ productionOrderId: 501, productionOrderNo: 'SYN-PO-501' }],
  page: { page: 1, size: 200, total },
});
const workOrder = (id: number, itemId = 910001) => ({
  workOrderId: id,
  workOrderNo: `SYN-WO-${String(id)}`,
  productionPlanId: 501,
  routingOperationId: 601,
  itemId,
  orderQty: 12.5,
  uomId: 920001,
  workOrderTypeCode: 'NORMAL',
  priorityNo: 1,
  statusCode: 'COMPLETED',
});
const detailBody = (workOrderId: number) => ({
  ...workOrder(workOrderId),
  workOrderNo: `SYN-WO-DETAIL-${String(workOrderId)}`,
  orderQty: 99,
  progress: {
    goodQty: 1,
    defectQty: 2,
    achievementRate: 9.87,
    varianceQty: -432,
    completionJudgmentCode: 'OVER' as const,
  },
  preIssuedLots: { slotCount: 9, withResultCount: 6, withoutResultCount: 0 },
});
const itemBody = (itemId: number) => ({
  item: {
    itemId,
    itemCode: 'SYN-ITEM',
    itemName: 'Synthetic Item',
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
const uomBody = {
  items: [
    {
      uomId: 920001,
      uomCode: 'SYN-EA',
      uomName: 'Synthetic Each',
      decimalScale: 0,
      isActive: false,
    },
  ],
  page: { page: 1, size: 20, total: 1 },
};

const makeApi = (
  statusMode: LookupMode = 'ready',
  orderMode: LookupMode = 'ready',
  uoms = uomBody,
) => {
  const urls: URL[] = [];
  let releaseStatus: (() => void) | undefined;
  let releaseOrder: (() => void) | undefined;
  let candidateMode: 'ready' | 'pending' | 'error' = 'ready';
  let releaseCandidate: (() => void) | undefined;
  let detailMode: 'ready' | 'pending-ready' | 'pending-error' | 'error' = 'ready';
  let releaseDetail: (() => void) | undefined;
  const gate = (response: Response, assign: (release: () => void) => void) =>
    new Promise<Response>((resolve) => assign(() => resolve(response)));
  const lookup = (mode: LookupMode, body: unknown, setRelease: (release: () => void) => void) => {
    if (mode === 'pending') return gate(jsonResponse(body), setRelease);
    if (mode === 'error') return jsonResponse({ message: 'failure' }, { status: 500 });
    return jsonResponse(
      mode === 'truncated' ? { ...(body as object), page: { page: 1, size: 200, total: 2 } } : body,
    );
  };
  const fetch: StubFetch = async (request) => {
    const url = new URL(request.url);
    urls.push(url);
    if (url.pathname === paths.status)
      return lookup(statusMode, statusBody(), (release) => (releaseStatus = release));
    if (url.pathname === paths.orders)
      return lookup(orderMode, orderBody(), (release) => (releaseOrder = release));
    if (url.pathname === paths.candidates) {
      if (candidateMode === 'pending')
        return gate(
          jsonResponse({ message: 'failure' }, { status: 500 }),
          (release) => (releaseCandidate = release),
        );
      if (candidateMode === 'error') return jsonResponse({ message: 'failure' }, { status: 500 });
      const current = Number(url.searchParams.get('page') ?? 1);
      return jsonResponse({
        items: [workOrder(current === 1 ? 701 : 702, 910000 + current)],
        page: page(21, current),
      });
    }
    if (url.pathname.startsWith(`${paths.candidates}/`)) {
      const workOrderId = Number(url.pathname.split('/').at(-1));
      if (detailMode.startsWith('pending'))
        return gate(
          detailMode === 'pending-ready'
            ? jsonResponse(detailBody(workOrderId))
            : jsonResponse({ message: 'failure' }, { status: 500 }),
          (release) => (releaseDetail = release),
        );
      if (detailMode === 'error') return jsonResponse({ message: 'failure' }, { status: 500 });
      return jsonResponse(detailBody(workOrderId));
    }
    if (url.pathname.startsWith('/mdm/items/'))
      return jsonResponse(itemBody(Number(url.pathname.split('/').at(-1))));
    if (url.pathname === paths.uoms) return jsonResponse(uoms);
    throw new Error(`Unexpected request: ${url.pathname}`);
  };
  return {
    fetch,
    urls,
    releaseStatus: () => releaseStatus?.(),
    releaseOrder: () => releaseOrder?.(),
    releaseCandidate: () => releaseCandidate?.(),
    releaseDetail: () => releaseDetail?.(),
    setCandidateMode: (mode: typeof candidateMode) => (candidateMode = mode),
    setDetailMode: (mode: typeof detailMode) => (detailMode = mode),
  };
};
const candidateUrls = (urls: URL[]) => urls.filter((url) => url.pathname === paths.candidates);
const detailUrls = (urls: URL[]) =>
  urls.filter((url) => /^\/production\/work-orders\/\d+$/.test(url.pathname));

describe('WorkOrderCloseCandidateScreen', () => {
  it('maps disabled, fetching, error, absent and settled snapshots in strict priority', () => {
    const snapshot = (
      overrides: Partial<Parameters<typeof toWorkOrderCloseCandidateSnapshot>[0]>,
    ) =>
      toWorkOrderCloseCandidateSnapshot({
        enabled: true,
        isFetching: false,
        isError: false,
        candidateIds: [701],
        ...overrides,
      });
    expect(snapshot({ enabled: false, isFetching: true, isError: true })).toEqual({
      kind: 'ABSENT',
    });
    expect(snapshot({ isFetching: true, isError: true })).toEqual({ kind: 'PENDING' });
    expect(snapshot({ isError: true })).toEqual({ kind: 'FAILED' });
    expect(snapshot({ candidateIds: undefined })).toEqual({ kind: 'ABSENT' });
    expect(snapshot({})).toEqual({ kind: 'SETTLED', candidateIds: [701] });
  });

  it('maps no selection, fetching, error, absent and resolved detail in strict priority', () => {
    const detail = toWorkOrderCloseDetailFact(detailBody(701));
    const state = (
      overrides: Partial<Parameters<typeof toWorkOrderCloseDetailScreenState>[0]> = {},
    ) =>
      toWorkOrderCloseDetailScreenState({
        selectedWorkOrderId: 701,
        isFetching: false,
        isError: false,
        detail,
        unitLabel: 'SYN-EA · Synthetic Each',
        ...overrides,
      });
    expect(state({ selectedWorkOrderId: null, isFetching: true, isError: true })).toEqual({
      kind: 'NOT_SELECTED',
    });
    expect(state({ isFetching: true, isError: true })).toEqual({ kind: 'CHECKING' });
    expect(state({ isError: true })).toEqual({ kind: 'UNAVAILABLE' });
    expect(state({ detail: undefined })).toEqual({ kind: 'UNAVAILABLE' });
    expect(state({})).toEqual({ kind: 'RESOLVED', detail, unitLabel: 'SYN-EA · Synthetic Each' });
  });

  it('keeps detail idle until selection then reads exact server facts with a named unit', async () => {
    const user = userEvent.setup();
    const api = makeApi();
    api.setDetailMode('pending-ready');
    renderWithProviders(<WorkOrderCloseCandidateScreen />, { fetch: api.fetch });
    expect(screen.getByText('마감할 W/O를 선택하세요.')).toBeVisible();
    expect(
      screen.getByText('후보 목록에서 W/O를 선택하면 상세 집계를 확인할 수 있습니다.'),
    ).toBeVisible();
    const row = await screen.findByRole('button', { name: 'SYN-WO-701 선택' });
    expect(detailUrls(api.urls)).toHaveLength(0);
    await user.click(row);
    expect(screen.getByRole('status', { name: t.detailSummary.loading })).toBeVisible();
    const request = detailUrls(api.urls)[0]!;
    expect(request.pathname).toBe(paths.detail(701));
    expect(Array.from(request.searchParams.entries())).toEqual([
      ['withProgress', 'true'],
      ['withPreIssuedLots', 'true'],
    ]);
    expect(screen.queryByText('마감할 W/O를 선택하세요.')).not.toBeInTheDocument();
    api.releaseDetail();
    const pane = screen.getByRole('region', { name: t.detailSummary.pane });
    expect(await within(pane).findByText('SYN-WO-DETAIL-701')).toBeVisible();
    expect(pane).toHaveTextContent('99');
    expect(pane).toHaveTextContent('987');
    expect(pane).toHaveTextContent('-432');
    expect(pane).toHaveTextContent(t.detailSummary.judgments.OVER);
    expect(pane).toHaveTextContent('9');
    expect(pane).toHaveTextContent('6');
    expect(pane).toHaveTextContent('SYN-EA · Synthetic Each');
    expect(pane).not.toHaveTextContent('920001');
  });

  it('shows an unconfirmed unit without leaking an unknown detail UOM id', async () => {
    const user = userEvent.setup();
    const api = makeApi('ready', 'ready', {
      items: [],
      page: { page: 1, size: 20, total: 0 },
    });
    renderWithProviders(<WorkOrderCloseCandidateScreen />, { fetch: api.fetch });
    await user.click(await screen.findByRole('button', { name: 'SYN-WO-701 선택' }));
    const pane = screen.getByRole('region', { name: t.detailSummary.pane });
    expect(
      await within(pane).findAllByText(t.detailSummary.values.unitNotConfirmed),
    ).not.toHaveLength(0);
    expect(document.body).not.toHaveTextContent('920001');
  });

  it('hides stale detail through refetch failure and retries only its endpoint', async () => {
    const user = userEvent.setup();
    const api = makeApi();
    const { queryClient } = renderWithProviders(<WorkOrderCloseCandidateScreen />, {
      fetch: api.fetch,
    });
    await user.click(await screen.findByRole('button', { name: 'SYN-WO-701 선택' }));
    await screen.findByText('SYN-WO-DETAIL-701');
    api.setDetailMode('pending-error');
    void queryClient.invalidateQueries({ queryKey: ['work-order-close', 'detail', 701] });
    expect(await screen.findByRole('status', { name: t.detailSummary.loading })).toBeVisible();
    expect(screen.queryByText('SYN-WO-DETAIL-701')).not.toBeInTheDocument();
    api.releaseDetail();
    const pane = screen.getByRole('region', { name: t.detailSummary.pane });
    expect(await within(pane).findByRole('alert')).toHaveTextContent(messages.httpError.loadTitle);
    expect(within(pane).queryByText('SYN-WO-DETAIL-701')).not.toBeInTheDocument();
    const before = api.urls.length;
    api.setDetailMode('ready');
    await user.click(within(pane).getByRole('button', { name: messages.common.retry }));
    expect(await within(pane).findByText('SYN-WO-DETAIL-701')).toBeVisible();
    expect(api.urls.slice(before).map((url) => url.pathname)).toEqual([paths.detail(701)]);
  });

  it('holds candidates until exact COMPLETED is ready and resolves only current-page references', async () => {
    const api = makeApi('pending');
    renderWithProviders(<WorkOrderCloseCandidateScreen />, { fetch: api.fetch });
    const status = screen.getByRole('combobox', { name: t.filter.status });
    expect(status).toBeDisabled();
    expect(status).toHaveAccessibleDescription(t.filter.statusLookupLoading);
    expect(candidateUrls(api.urls)).toHaveLength(0);
    expect(screen.getByRole('status', { name: t.candidateList.loading })).toBeVisible();
    api.releaseStatus();
    expect(await screen.findByRole('button', { name: 'SYN-WO-701 선택' })).toBeVisible();
    const first = candidateUrls(api.urls)[0]!;
    expect(first.searchParams.get('statusCode')).toBe('COMPLETED');
    expect(first.searchParams.get('page')).toBe('1');
    expect(api.urls.filter((url) => url.pathname === '/mdm/items/910001')).toHaveLength(1);
    expect(
      api.urls.find((url) => url.pathname === paths.uoms)?.searchParams.get('includeInactive'),
    ).toBe('true');
    expect(await screen.findByText('SYN-ITEM · Synthetic Item')).toBeVisible();
    expect(screen.getByText('12.5 SYN-EA · Synthetic Each')).toBeVisible();
    expect(screen.queryByText('910001')).not.toBeInTheDocument();
    expect(screen.queryByText('920001')).not.toBeInTheDocument();
  });

  it.each([
    ['status', 'error', t.filter.statusLookupFailed],
    ['status', 'truncated', t.filter.statusLookupTruncated],
    ['orders', 'pending', messages.productionOrder.values.referenceLoading],
    ['orders', 'error', messages.productionOrder.values.referenceFailed],
    ['orders', 'truncated', messages.productionOrder.values.referenceTruncated],
  ] as const)('describes unavailable %s lookup in %s state', async (kind, mode, reason) => {
    const api = makeApi(kind === 'status' ? mode : 'ready', kind === 'orders' ? mode : 'ready');
    renderWithProviders(<WorkOrderCloseCandidateScreen />, { fetch: api.fetch });
    const select = await screen.findByRole('combobox', {
      name: kind === 'status' ? t.filter.status : t.filter.productionOrder,
    });
    await waitFor(() => expect(select).toHaveAccessibleDescription(reason));
    expect(select).toBeDisabled();
    if (kind === 'status') {
      expect(candidateUrls(api.urls)).toHaveLength(0);
      const pane = screen.getByRole('region', { name: t.candidateList.pane });
      expect(pane).toHaveTextContent(reason);
      expect(pane).not.toHaveTextContent(t.candidateList.empty.title);
    } else {
      expect(await screen.findByRole('button', { name: 'SYN-WO-701 선택' })).toBeVisible();
      const request = candidateUrls(api.urls)[0]!;
      expect(request.searchParams.get('statusCode')).toBe('COMPLETED');
    }
  });

  it('applies search, page, selection and reset through recorded candidate requests', async () => {
    const user = userEvent.setup();
    const api = makeApi();
    renderWithProviders(<WorkOrderCloseCandidateScreen />, { fetch: api.fetch });
    let row = await screen.findByRole('button', { name: 'SYN-WO-701 선택' });
    await user.click(row);
    expect(row).toHaveAttribute('aria-current', 'true');
    await screen.findByText('SYN-WO-DETAIL-701');
    await user.click(screen.getByRole('combobox', { name: t.filter.productionOrder }));
    await user.click(screen.getByRole('option', { name: 'SYN-PO-501' }));
    await user.click(screen.getByRole('button', { name: t.filter.search }));
    await waitFor(() =>
      expect(candidateUrls(api.urls).at(-1)?.searchParams.get('productionOrderId')).toBe('501'),
    );
    expect(screen.getByText('마감할 W/O를 선택하세요.')).toBeVisible();
    expect(screen.queryByText('SYN-WO-DETAIL-701')).not.toBeInTheDocument();
    row = screen.getByRole('button', { name: 'SYN-WO-701 선택' });
    expect(row).not.toHaveAttribute('aria-current');
    await user.click(row);
    await user.click(screen.getByRole('button', { name: messages.workOrder.pageNav.next }));
    expect(await screen.findByRole('button', { name: 'SYN-WO-702 선택' })).not.toHaveAttribute(
      'aria-current',
    );
    expect(screen.getByText('마감할 W/O를 선택하세요.')).toBeVisible();
    expect(candidateUrls(api.urls).at(-1)?.searchParams.get('page')).toBe('2');
    await user.click(screen.getByRole('button', { name: t.filter.reset }));
    await screen.findByRole('button', { name: 'SYN-WO-701 선택' });
    expect(screen.getByText('마감할 W/O를 선택하세요.')).toBeVisible();
    expect(candidateUrls(api.urls).at(-1)?.searchParams.has('productionOrderId')).toBe(false);
    expect(candidateUrls(api.urls).at(-1)?.searchParams.get('page')).toBe('1');
  });

  it('hides stale rows on refetch failure and retries only the candidate request', async () => {
    const user = userEvent.setup();
    const api = makeApi();
    const { queryClient } = renderWithProviders(<WorkOrderCloseCandidateScreen />, {
      fetch: api.fetch,
    });
    const row = await screen.findByRole('button', { name: 'SYN-WO-701 선택' });
    await user.click(row);
    await screen.findByText('SYN-WO-DETAIL-701');
    const detailRequestCount = detailUrls(api.urls).length;
    api.setCandidateMode('pending');
    void queryClient.invalidateQueries({ queryKey: ['work-order-close', 'candidates'] });
    expect(await screen.findByRole('status', { name: t.candidateList.loading })).toBeVisible();
    api.releaseCandidate();
    expect(await screen.findByRole('alert')).toHaveTextContent(messages.httpError.loadTitle);
    expect(detailUrls(api.urls)).toHaveLength(detailRequestCount);
    expect(screen.queryByRole('button', { name: 'SYN-WO-701 선택' })).not.toBeInTheDocument();
    const before = api.urls.map((url) => url.pathname);
    api.setCandidateMode('ready');
    await user.click(screen.getByRole('button', { name: messages.common.retry }));
    expect(await screen.findByRole('button', { name: 'SYN-WO-701 선택' })).toHaveAttribute(
      'aria-current',
      'true',
    );
    expect(api.urls.slice(before.length).map((url) => url.pathname)).toEqual([paths.candidates]);
  });
});
