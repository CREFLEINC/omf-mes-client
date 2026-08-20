import { messages } from '@omf-mes/i18n';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { renderWithProviders } from '../../test/api-harness';
import { EMPTY_FILTERS, type QueueFilters } from './filters';
import { QueueFilterBar } from './queue-filter-bar';

const t = messages.iqcInspection.filters;

const renderBar = (appliedFilters: QueueFilters = EMPTY_FILTERS) => {
  const onSearch = vi.fn();
  const onReset = vi.fn();

  const view = renderWithProviders(
    <QueueFilterBar appliedFilters={appliedFilters} onSearch={onSearch} onReset={onReset} />,
  );

  return { onSearch, onReset, view };
};

const itemBox = () => screen.getByLabelText(t.item);
const supplierBox = () => screen.getByLabelText(t.supplier);
const apply = () => screen.getByRole('button', { name: t.apply });

describe('QueueFilterBar', () => {
  it('주소가 담은 조건을 편집 칸에 되돌린다', () => {
    renderBar({ itemId: 1001, supplierId: 2002, keyword: 'IR-1' });

    expect(itemBox()).toHaveValue('1001');
    expect(supplierBox()).toHaveValue('2002');
    expect(screen.getByLabelText(t.keyword)).toHaveValue('IR-1');
  });

  it('조회하면 채운 조건만 올린다', async () => {
    const { onSearch } = renderBar();

    await userEvent.type(itemBox(), '1001');
    await userEvent.click(apply());

    expect(onSearch).toHaveBeenCalledWith({ itemId: 1001, supplierId: null, keyword: '' });
  });

  it('번호가 아닌 값을 조용히 무시하지 않는다 — 조회를 막고 어느 칸인지 보인다', async () => {
    const { onSearch } = renderBar();

    await userEvent.type(itemBox(), 'abc');
    await userEvent.click(apply());

    expect(onSearch).not.toHaveBeenCalled();
    expect(screen.getByText(t.identifierInvalid)).toBeInTheDocument();
  });

  it('한 칸이 틀렸다고 멀쩡한 칸까지 고치라고 하지 않는다', async () => {
    renderBar();

    await userEvent.type(itemBox(), '0');
    await userEvent.type(supplierBox(), '2002');
    await userEvent.click(apply());

    expect(screen.getAllByText(t.identifierInvalid)).toHaveLength(1);
  });

  it('고치면 다시 조회된다', async () => {
    const { onSearch } = renderBar();

    await userEvent.type(itemBox(), 'x');
    await userEvent.click(apply());
    await userEvent.clear(itemBox());
    await userEvent.type(itemBox(), '5');
    await userEvent.click(apply());

    expect(onSearch).toHaveBeenCalledWith({ itemId: 5, supplierId: null, keyword: '' });
  });

  it('초기화는 자기 편집 상태도 비운다 — 아직 조회하지 않은 값은 주소가 바뀌지 않는다', async () => {
    const { onReset } = renderBar();

    await userEvent.type(itemBox(), '1001');
    await userEvent.click(screen.getByRole('button', { name: t.reset }));

    expect(onReset).toHaveBeenCalledTimes(1);
    expect(itemBox()).toHaveValue('');
  });

  it('주소가 바뀌면 편집 중이던 값이 그 값으로 되돌아간다', async () => {
    const { view } = renderBar();

    await userEvent.type(itemBox(), '9999');
    view.rerender(
      <QueueFilterBar
        appliedFilters={{ itemId: 1001, supplierId: null, keyword: '' }}
        onSearch={vi.fn()}
        onReset={vi.fn()}
      />,
    );

    expect(itemBox()).toHaveValue('1001');
  });
});
