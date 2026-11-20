import { messages } from '@omf-mes/i18n';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { createStubFetch, jsonResponse, renderWithProviders } from '../../test/api-harness';
import { EMPTY_FILTERS, type QueueFilters } from './filters';
import { QueueDetailFilters } from './queue-detail-filters';

/**
 * 검사 조회·판정 OQC 의 「조건 더보기」(C-6) — 품목 · 의뢰번호는 늘 접힌 채로 들어오고, 접힌 칸에 걸린 조건은 칩으로
 * 알린다. ⛔ 전부 지어낸 값이다.
 */

const t = messages.oqcInspection.filters;
const more = messages.common.filterMore;

const ITEM = { itemId: 3003, itemCode: 'SAMPLE-FG-01', itemName: '합성 제품 가', isActive: true };

const stubFetch = createStubFetch([
  {
    match: (request) =>
      request.method === 'GET' && new URL(request.url).pathname === '/mdm/items/3003',
    respond: () => jsonResponse({ item: ITEM, editability: {} }),
  },
]);

const APPLIED: QueueFilters = { ...EMPTY_FILTERS, itemId: 3003, keyword: 'IR-OQC' };

const renderFilters = (filters: QueueFilters = EMPTY_FILTERS) => {
  const onApply = vi.fn();
  renderWithProviders(<QueueDetailFilters filters={filters} onApply={onApply} />, {
    fetch: stubFetch,
  });
  return { onApply, user: userEvent.setup() };
};

describe('QueueDetailFilters — 조건 더보기(OQC)', () => {
  it('접힌 채로 들어오고, 걸린 품목 · 의뢰번호는 칩으로 보인다', async () => {
    const { user } = renderFilters(APPLIED);
    const toggle = screen.getByRole('button', { name: more.open });

    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('textbox', { name: t.keyword })).toBeNull();
    /* 칩 라벨은 대상 이름 — 칸 라벨의 「검색」은 싣지 않는다. */
    expect(screen.getByText('의뢰번호: IR-OQC')).toBeInTheDocument();
    expect(await screen.findByText('품목: SAMPLE-FG-01 · 합성 제품 가')).toBeInTheDocument();

    await user.click(toggle);

    expect(screen.getByRole('textbox', { name: t.keyword })).toBeVisible();
    expect(screen.queryByText('의뢰번호: IR-OQC')).toBeNull();
  });

  it('칩의 × 는 그 조건만 풀어 바로 조회한다', async () => {
    const { onApply, user } = renderFilters(APPLIED);

    await user.click(screen.getByRole('button', { name: more.remove('품목') }));

    expect(onApply).toHaveBeenCalledWith({ ...APPLIED, itemId: null });
  });
});
