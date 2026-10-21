import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { renderWithProviders } from '../../test/api-harness';
import { SelectableTable } from './selectable-table';

const rows = [
  { id: 'a', name: '가' },
  { id: 'b', name: '나' },
];
const columns = [{ key: 'name', header: '이름', render: (row: { name: string }) => row.name }];

describe('SelectableTable(C-1)', () => {
  it('행 전체를 눌러 고르고 선택 행을 표시한다', async () => {
    const user = userEvent.setup();
    const onActivate = vi.fn();
    renderWithProviders(
      <SelectableTable
        columns={columns}
        rows={rows}
        getRowId={(row) => row.id}
        activeId="b"
        rowLabel={(row) => `${row.name} 열기`}
        onActivate={onActivate}
      />,
    );
    await user.click(screen.getByText('가'));
    expect(onActivate).toHaveBeenCalledWith(rows[0]);
    expect(screen.getByRole('row', { name: '나 열기' })).toHaveAttribute('aria-selected', 'true');
  });

  it('위아래 방향키로 옮기고 Enter로 고른다', async () => {
    const user = userEvent.setup();
    const onActivate = vi.fn();
    renderWithProviders(
      <SelectableTable
        columns={columns}
        rows={rows}
        getRowId={(row) => row.id}
        rowLabel={(row) => `${row.name} 열기`}
        onActivate={onActivate}
      />,
    );
    screen.getByRole('row', { name: '가 열기' }).focus();
    await user.keyboard('{ArrowDown}{Enter}');
    expect(onActivate).toHaveBeenCalledWith(rows[1]);
  });

  it('체크박스 칸을 눌러도 행 동작이 일어나지 않는다', async () => {
    const user = userEvent.setup();
    const onActivate = vi.fn();
    const onCheckedChange = vi.fn();
    renderWithProviders(
      <SelectableTable
        columns={columns}
        rows={rows}
        getRowId={(row) => row.id}
        rowLabel={(row) => `${row.name} 열기`}
        onActivate={onActivate}
        checkedIds={[]}
        onCheckedChange={onCheckedChange}
      />,
    );
    await user.click(within(screen.getByRole('row', { name: '가 열기' })).getByRole('checkbox'));
    expect(onCheckedChange).toHaveBeenCalledWith(['a']);
    expect(onActivate).not.toHaveBeenCalled();
  });
});
