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

  renderWithProviders(
    <QueueFilterBar appliedFilters={appliedFilters} onSearch={onSearch} onReset={onReset} />,
  );

  return { onSearch, onReset };
};

describe('QueueFilterBar', () => {
  it('품목·의뢰번호·「대기·진행만 보기」 셋만 둔다 — 기간 칸을 만들지 않는다', () => {
    renderBar();

    expect(screen.getByLabelText(t.item)).toBeInTheDocument();
    expect(screen.getByLabelText(t.keyword)).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: t.pendingOnly })).toBeChecked();
    expect(screen.queryByLabelText(/기간/)).not.toBeInTheDocument();
  });

  it('토글을 끄고 조회하면 그 값이 조건으로 나간다', async () => {
    const { onSearch } = renderBar();

    await userEvent.click(screen.getByRole('checkbox', { name: t.pendingOnly }));
    await userEvent.click(screen.getByRole('button', { name: t.apply }));

    expect(onSearch).toHaveBeenCalledWith({ itemId: null, keyword: '', pendingOnly: false });
  });

  it('번호가 아닌 값은 조용히 무시하지 않고 그 칸에 사유를 낸다', async () => {
    const { onSearch } = renderBar();

    await userEvent.type(screen.getByLabelText(t.item), 'abc');
    await userEvent.click(screen.getByRole('button', { name: t.apply }));

    expect(screen.getByText(t.identifierInvalid)).toBeInTheDocument();
    expect(onSearch).not.toHaveBeenCalled();
  });

  it('주소가 담은 토글 상태를 그대로 보인다 — 목록과 다른 조건을 보이지 않게', () => {
    renderBar({ ...EMPTY_FILTERS, pendingOnly: false });

    expect(screen.getByRole('checkbox', { name: t.pendingOnly })).not.toBeChecked();
  });
});
