import { messages } from '@omf-mes/i18n';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { salesOrderListFixtures } from './fixtures';
import { SourceListTable } from './source-list-table';
import { toSalesOrderView } from './types';

const t = messages.shipmentRequestCreate;

const rows = salesOrderListFixtures.map(toSalesOrderView);

const customerLookup = {
  entries: [
    { value: '8201', label: 'SAMPLE-CUST-01 · 합성 고객 가', isActive: true },
    { value: '8202', label: 'SAMPLE-CUST-02 · 합성 고객 나', isActive: true },
  ],
  isError: false,
  isLoading: false,
};

describe('SourceListTable', () => {
  it('불러오는 중에는 표 대신 자리표시를 낸다', () => {
    render(
      <SourceListTable
        rows={[]}
        isLoading
        isBeyondLast={false}
        selectedSalesOrderId={null}
        customerLookup={customerLookup}
        onSelect={vi.fn()}
        onFirstPage={vi.fn()}
      />,
    );

    expect(screen.getByRole('status', { name: t.loading.sourceList })).toBeInTheDocument();
  });

  it('지시서번호·고객·주문일·상태를 낸다', () => {
    render(
      <SourceListTable
        rows={rows}
        isLoading={false}
        isBeyondLast={false}
        selectedSalesOrderId={null}
        customerLookup={customerLookup}
        onSelect={vi.fn()}
        onFirstPage={vi.fn()}
      />,
    );

    expect(
      screen.getByRole('button', { name: t.table.selectRow('SAMPLE-SO-0001') }),
    ).toBeInTheDocument();
    expect(screen.getByText('SAMPLE-CUST-01 · 합성 고객 가')).toBeInTheDocument();
    expect(screen.getByText('2026-08-10')).toBeInTheDocument();
  });

  it('지시서번호를 누르면 그 번호로 onSelect를 부른다(완료 조건 C2)', async () => {
    const onSelect = vi.fn<(salesOrderId: number) => void>();
    const user = userEvent.setup();

    render(
      <SourceListTable
        rows={rows}
        isLoading={false}
        isBeyondLast={false}
        selectedSalesOrderId={null}
        customerLookup={customerLookup}
        onSelect={onSelect}
        onFirstPage={vi.fn()}
      />,
    );
    await user.click(screen.getByRole('button', { name: t.table.selectRow('SAMPLE-SO-0001') }));

    expect(onSelect).toHaveBeenCalledWith(8101);
  });

  it('결과가 없으면 빈 상태를 낸다', () => {
    render(
      <SourceListTable
        rows={[]}
        isLoading={false}
        isBeyondLast={false}
        selectedSalesOrderId={null}
        customerLookup={customerLookup}
        onSelect={vi.fn()}
        onFirstPage={vi.fn()}
      />,
    );

    expect(screen.getByText(t.empty.noResultTitle)).toBeInTheDocument();
  });

  it('쪽 밖이면 첫 쪽으로 이동하는 버튼을 낸다', async () => {
    const onFirstPage = vi.fn<() => void>();
    const user = userEvent.setup();

    render(
      <SourceListTable
        rows={[]}
        isLoading={false}
        isBeyondLast
        selectedSalesOrderId={null}
        customerLookup={customerLookup}
        onSelect={vi.fn()}
        onFirstPage={onFirstPage}
      />,
    );
    await user.click(screen.getByRole('button', { name: t.actions.goFirstPage }));

    expect(onFirstPage).toHaveBeenCalledTimes(1);
  });
});
