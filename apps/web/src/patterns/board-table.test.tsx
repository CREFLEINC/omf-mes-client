import type { Column } from '@crefle/web-ui';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { BoardTable, type BoardTablePick } from './board-table';

interface Row {
  id: number;
  name: string;
  qty: number;
}

const ROWS: Row[] = [
  { id: 1, name: '합성 가', qty: 10 },
  { id: 2, name: '합성 나', qty: 20 },
  { id: 3, name: '합성 다', qty: 30 },
];

const columns = (onAction: (id: number) => void = () => undefined): Column<Row>[] => [
  { key: 'name', header: '이름' },
  { key: 'qty', header: '수량', width: '64px', align: 'end' },
  {
    key: 'action',
    header: '일',
    width: '80px',
    render: (row) => (
      <button
        type="button"
        onClick={() => {
          onAction(row.id);
        }}
      >
        {`${row.name} 일`}
      </button>
    ),
  },
];

const renderTable = (
  pick: Partial<BoardTablePick<Row>> = {},
  extra: { minWidth?: string; onAction?: (id: number) => void } = {},
) => {
  const onPick = vi.fn();
  render(
    <BoardTable
      label="합성 표"
      columns={columns(extra.onAction)}
      rows={ROWS}
      getRowId={(row) => String(row.id)}
      pick={{
        columnKey: 'name',
        label: (row) => `${row.name} 선택`,
        currentId: null,
        onPick,
        ...pick,
      }}
      {...(extra.minWidth === undefined ? {} : { minWidth: extra.minWidth })}
    />,
  );

  return { onPick, user: userEvent.setup() };
};

const rowOf = (name: string): HTMLElement => {
  const row = screen.getByRole('button', { name: `${name} 선택` }).closest('tr');
  if (row === null) throw new Error(`${name} 줄이 없습니다`);

  return row;
};

describe('BoardTable — 줄 고르기', () => {
  it('고르는 열의 칸이 단추가 되고, 그 줄 어디를 눌러도 그 줄을 고른다', async () => {
    const { onPick, user } = renderTable();

    await user.click(within(rowOf('합성 나')).getByText('20'));
    expect(onPick).toHaveBeenLastCalledWith(ROWS[1]);

    await user.click(screen.getByRole('button', { name: '합성 다 선택' }));
    expect(onPick).toHaveBeenLastCalledWith(ROWS[2]);
  });

  it('키보드로도 고른다 — 단추가 초점을 받는다', async () => {
    const { onPick, user } = renderTable();

    screen.getByRole('button', { name: '합성 가 선택' }).focus();
    await user.keyboard('{Enter}');

    expect(onPick).toHaveBeenLastCalledWith(ROWS[0]);
  });

  it('줄 안의 다른 단추를 누른 것은 그쪽이 받는다 — 줄을 고르지 않는다', async () => {
    const onAction = vi.fn();
    const { onPick, user } = renderTable({}, { onAction });

    await user.click(screen.getByRole('button', { name: '합성 나 일' }));

    expect(onAction).toHaveBeenCalledWith(2);
    expect(onPick).not.toHaveBeenCalled();
  });

  it('고른 줄은 단추에 aria-current 가 서고, 다른 줄에는 없다', () => {
    renderTable({ currentId: '2' });

    expect(screen.getByRole('button', { name: '합성 나 선택' })).toHaveAttribute(
      'aria-current',
      'true',
    );
    expect(screen.getByRole('button', { name: '합성 가 선택' })).not.toHaveAttribute(
      'aria-current',
    );
  });

  it('고를 수 없는 줄은 단추를 세우지 않고, 눌러도 고르지 않는다', async () => {
    const { onPick, user } = renderTable({ canPick: (row) => row.id !== 3 });

    expect(screen.queryByRole('button', { name: '합성 다 선택' })).toBeNull();
    await user.click(screen.getByText('합성 다'));

    expect(onPick).not.toHaveBeenCalled();
  });
});

describe('BoardTable — 상자', () => {
  it('최소 폭을 상자에 싣고, 표 이름은 보이지 않는 caption 이다', () => {
    renderTable({}, { minWidth: '30rem' });

    const box = screen.getByRole('table', { name: '합성 표' }).closest('.board-table');
    expect(box).toHaveClass('wide-table', 'po-board-table', 'board-table-pickable');
    expect((box as HTMLElement).style.getPropertyValue('--board-table-min')).toBe('30rem');
  });

  it('고르기가 없으면 줄 누름도 단추도 없다', () => {
    render(
      <BoardTable
        label="합성 표"
        columns={columns()}
        rows={ROWS}
        getRowId={(row) => String(row.id)}
      />,
    );

    expect(screen.queryByRole('button', { name: /선택$/ })).toBeNull();
    expect(screen.getByRole('table').closest('.board-table')).not.toHaveClass(
      'board-table-pickable',
    );
  });
});
