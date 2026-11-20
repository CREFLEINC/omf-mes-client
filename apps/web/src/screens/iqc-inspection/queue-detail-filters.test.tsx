import { messages } from '@omf-mes/i18n';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { createStubFetch, jsonResponse, renderWithProviders } from '../../test/api-harness';
import { EMPTY_FILTERS, type QueueFilters } from './filters';
import { QueueDetailFilters } from './queue-detail-filters';

/**
 * 검사 조회·판정 IQC 의 「조건 더보기」(C-6) — 품목 · 공급사 · 의뢰번호는 늘 접힌 채로 들어오고, 접힌 칸에 걸린 조건은
 * 칩으로 알린다. ⛔ 전부 지어낸 값이다.
 */

const t = messages.iqcInspection.filters;
const more = messages.common.filterMore;

const isGet = (request: Request, pathname: string): boolean =>
  request.method === 'GET' && new URL(request.url).pathname === pathname;

const ITEM = { itemId: 1001, itemCode: 'SAMPLE-ITEM-01', itemName: '합성 품목 가', isActive: true };
const PARTNER = {
  partnerId: 2002,
  partnerCode: 'SAMPLE-SUP-01',
  partnerName: '합성 공급사 가',
  isActive: true,
};

const stubFetch = createStubFetch([
  {
    match: (request) => isGet(request, '/mdm/items/1001'),
    respond: () => jsonResponse({ item: ITEM, editability: {} }),
  },
  {
    match: (request) => isGet(request, '/mdm/partners/2002'),
    respond: () => jsonResponse(PARTNER),
  },
  {
    match: (request) => isGet(request, '/mdm/code-values'),
    respond: () => jsonResponse({ items: [], page: { page: 1, size: 100, total: 0 } }),
  },
]);

const renderFilters = (filters: QueueFilters = EMPTY_FILTERS) => {
  const onApply = vi.fn();
  renderWithProviders(<QueueDetailFilters filters={filters} onApply={onApply} />, {
    fetch: stubFetch,
  });
  return { onApply, user: userEvent.setup() };
};

const APPLIED: QueueFilters = {
  ...EMPTY_FILTERS,
  itemId: 1001,
  supplierId: 2002,
  keyword: 'IR-1',
};

describe('QueueDetailFilters — 조건 더보기', () => {
  it('품목 · 공급사 · 의뢰번호는 접힌 채로 들어온다 — 주소에 조건이 걸려 있어도', async () => {
    const { user } = renderFilters(APPLIED);
    const toggle = screen.getByRole('button', { name: more.open });

    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('textbox', { name: t.keyword })).toBeNull();

    await user.click(toggle);

    expect(screen.getByRole('textbox', { name: t.keyword })).toBeVisible();
    expect(screen.getByRole('button', { name: more.close })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
  });

  it('접힌 칸에 걸린 조건마다 「대상 이름: 값」 칩 하나 — 칸 라벨의 「검색」은 싣지 않는다', async () => {
    renderFilters(APPLIED);

    expect(screen.getByText('의뢰번호: IR-1')).toBeInTheDocument();
    expect(await screen.findByText('품목: SAMPLE-ITEM-01 · 합성 품목 가')).toBeInTheDocument();
    expect(await screen.findByText('공급사: SAMPLE-SUP-01 · 합성 공급사 가')).toBeInTheDocument();
  });

  it('칩의 × 는 그 조건만 풀어 바로 조회한다', async () => {
    const { onApply, user } = renderFilters(APPLIED);

    await user.click(screen.getByRole('button', { name: more.remove('공급사') }));

    expect(onApply).toHaveBeenCalledWith({ ...APPLIED, supplierId: null });
  });

  it('펼치면 칸에 값이 보이므로 칩을 거둔다', async () => {
    const { user } = renderFilters(APPLIED);

    await user.click(screen.getByRole('button', { name: more.open }));

    expect(screen.queryByText('의뢰번호: IR-1')).toBeNull();
  });

  it('조건이 없으면 칩도 없다', () => {
    renderFilters();

    expect(screen.getByRole('button', { name: more.open })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: more.remove('의뢰번호') })).toBeNull();
  });
});
