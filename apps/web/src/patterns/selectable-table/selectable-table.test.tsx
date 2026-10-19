import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { SelectableTable } from './selectable-table';

interface Row {
  id: number;
  name: string;
  blocked?: boolean;
}

const ROWS: Row[] = [
  { id: 1, name: '하나' },
  { id: 2, name: '둘', blocked: true },
  { id: 3, name: '셋' },
];

const renderTable = (selectedId: number | null = null) => {
  const onRowActivate = vi.fn();

  render(
    <SelectableTable
      columns={[{ key: 'name', header: '이름' }]}
      rows={ROWS}
      getRowId={(row) => String(row.id)}
      getRowLabel={(row) => `${row.name} 행`}
      isRowSelected={(row) => row.id === selectedId}
      isRowDisabled={(row) => row.blocked === true}
      onRowActivate={onRowActivate}
    />,
  );

  return { onRowActivate, user: userEvent.setup() };
};

describe('SelectableTable (C-1)', () => {
  it('행 어디를 눌러도 그 행을 고른다', async () => {
    const { onRowActivate, user } = renderTable();

    await user.click(screen.getByText('셋'));

    expect(onRowActivate).toHaveBeenCalledWith(ROWS[2]);
  });

  it('고를 수 없는 행은 눌러도 반응하지 않고 aria-disabled를 단다', async () => {
    const { onRowActivate, user } = renderTable();

    await user.click(screen.getByText('둘'));

    expect(onRowActivate).not.toHaveBeenCalled();
    expect(screen.getByRole('row', { name: '둘 행' })).toHaveAttribute('aria-disabled', 'true');
  });

  it('고른 행을 aria-selected로 표시한다', () => {
    renderTable(1);

    expect(screen.getByRole('row', { name: '하나 행' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('row', { name: '셋 행' })).toHaveAttribute('aria-selected', 'false');
  });

  it('방향키로 고를 수 있는 행 사이를 옮기고 Enter로 고른다', async () => {
    const { onRowActivate, user } = renderTable();

    screen.getByRole('row', { name: '하나 행' }).focus();
    await user.keyboard('{ArrowDown}');

    expect(screen.getByRole('row', { name: '셋 행' })).toHaveFocus();

    await user.keyboard('{Enter}');

    expect(onRowActivate).toHaveBeenCalledWith(ROWS[2]);
  });
});
