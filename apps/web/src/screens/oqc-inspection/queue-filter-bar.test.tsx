import { messages } from '@omf-mes/i18n';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { renderWithProviders } from '../../test/api-harness';
import { EMPTY_FILTERS } from './filters';
import { QueueFilterBar } from './queue-filter-bar';

const t = messages.oqcInspection.filters;

const renderBar = (appliedFilters = EMPTY_FILTERS) => {
  const onSearch = vi.fn();
  const onReset = vi.fn();
  const onTogglePendingOnly = vi.fn();

  renderWithProviders(
    <QueueFilterBar
      appliedFilters={appliedFilters}
      onSearch={onSearch}
      onTogglePendingOnly={onTogglePendingOnly}
      onReset={onReset}
    />,
  );

  return { onSearch, onReset, onTogglePendingOnly };
};

describe('QueueFilterBar', () => {
  it('품목·의뢰번호·「대기·진행만 보기」 셋만 둔다 — 기간 칸을 만들지 않는다', () => {
    renderBar();

    expect(screen.getByLabelText(t.item)).toBeInTheDocument();
    expect(screen.getByLabelText(t.keyword)).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: t.pendingOnly })).toBeChecked();
    expect(screen.queryByLabelText(/기간/)).not.toBeInTheDocument();
  });

  it('토글을 끄면 조회를 누르지 않아도 바로 조건으로 나간다(#185)', async () => {
    const { onSearch, onTogglePendingOnly } = renderBar();

    await userEvent.click(screen.getByRole('checkbox', { name: t.pendingOnly }));

    expect(onTogglePendingOnly).toHaveBeenCalledWith(false);
    expect(onSearch).not.toHaveBeenCalled();
  });

  it('품목은 번호를 치지 않고 검색 창에서 고른다 — 칸에 글자를 넣을 수 없다(#136)', async () => {
    const { onSearch } = renderBar();

    expect(screen.getByLabelText(t.item)).toHaveAttribute('readonly');

    await userEvent.click(screen.getByRole('button', { name: t.apply }));

    expect(onSearch).toHaveBeenCalledWith({ itemId: null, keyword: '', pendingOnly: true });
  });

  it('주소가 담은 토글 상태를 그대로 보인다 — 목록과 다른 조건을 보이지 않게', () => {
    renderBar({ ...EMPTY_FILTERS, pendingOnly: false });

    expect(screen.getByRole('checkbox', { name: t.pendingOnly })).not.toBeChecked();
  });
});
