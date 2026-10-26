import { type Column, Table } from '@crefle/web-ui';
import { createEvent, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';

import { moveColumn, orderColumns, useColumnOrder } from './column-order';
import { useColumnWidths } from './column-resize';

interface Row {
  id: number;
  code: string;
  name: string;
  qty: number;
}

const COLUMNS: Column<Row>[] = [
  { key: 'code', header: '코드', width: '120px', render: (row) => row.code },
  { key: 'name', header: '이름', render: (row) => row.name },
  { key: 'qty', header: '수량', width: '88px', render: (row) => String(row.qty) },
];

const STORAGE_KEY = 'test:column-order';

const Harness = ({ columns = COLUMNS }: { columns?: Column<Row>[] }) => {
  const ordered = useColumnOrder(STORAGE_KEY, columns);
  const resizable = useColumnWidths('test:column-order-widths', ordered);

  return (
    <Table
      columns={resizable.columns}
      rows={[{ id: 1, code: 'A-1', name: '품목', qty: 3 }]}
      getRowId={(row) => String(row.id)}
    />
  );
};

const headers = (): string[] =>
  screen.getAllByRole('columnheader').map((cell) => cell.textContent ?? '');

const cells = (): string[] => screen.getAllByRole('cell').map((cell) => cell.textContent ?? '');

const dragHandleOf = (header: string): HTMLElement => {
  const handle = screen.getByRole('columnheader', { name: header }).querySelector('.col-drag');
  if (!(handle instanceof HTMLElement)) throw new Error(`${header} 끌기 자리가 없다`);
  return handle;
};

/** jsdom 의 끌기 사건에는 `dataTransfer` 가 없다 — 부품이 쓰는 만큼만 채운다. */
const dataTransfer = () => ({ effectAllowed: '', dropEffect: '', setData: () => undefined });

const fire = (target: HTMLElement, type: 'dragStart' | 'dragOver' | 'drop' | 'dragEnd'): void => {
  const event = createEvent[type](target);
  Object.defineProperty(event, 'dataTransfer', { value: dataTransfer() });
  fireEvent(target, event);
};

/** `from` 머리칸을 잡아 `to` 머리칸 위에 놓는다. */
const dragColumn = (from: string, to: string): void => {
  fire(dragHandleOf(from), 'dragStart');
  fire(dragHandleOf(to), 'dragOver');
  fire(dragHandleOf(to), 'drop');
  fire(dragHandleOf(from), 'dragEnd');
};

beforeEach(() => {
  globalThis.localStorage.clear();
});

describe('orderColumns · moveColumn', () => {
  it('저장된 순서로 늘어놓고, 순서에 없는 열은 뒤에 기본 차례대로 붙인다', () => {
    const keys = (order: string[]) => orderColumns(COLUMNS, order).map(({ key }) => key);

    expect(keys([])).toEqual(['code', 'name', 'qty']);
    expect(keys(['qty', 'code'])).toEqual(['qty', 'code', 'name']);
    expect(keys(['gone', 'name', 'name'])).toEqual(['name', 'code', 'qty']);
  });

  it('오른쪽으로 옮기면 놓은 열 뒤, 왼쪽으로 옮기면 앞에 선다', () => {
    expect(moveColumn(['a', 'b', 'c'], 'a', 'b')).toEqual(['b', 'a', 'c']);
    expect(moveColumn(['a', 'b', 'c'], 'a', 'c')).toEqual(['b', 'c', 'a']);
    expect(moveColumn(['a', 'b', 'c'], 'c', 'a')).toEqual(['c', 'a', 'b']);
    expect(moveColumn(['a', 'b', 'c'], 'b', 'b')).toEqual(['a', 'b', 'c']);
    expect(moveColumn(['a', 'b', 'c'], 'x', 'b')).toEqual(['a', 'b', 'c']);
  });
});

describe('useColumnOrder', () => {
  it('머리칸을 끌어 놓으면 머리칸과 칸이 함께 옮겨지고, 다시 열어도 그 순서다', () => {
    const { unmount } = render(<Harness />);
    expect(headers()).toEqual(['코드', '이름', '수량']);

    dragColumn('수량', '코드');

    expect(headers()).toEqual(['수량', '코드', '이름']);
    expect(cells()).toEqual(['3', 'A-1', '품목']);
    expect(JSON.parse(globalThis.localStorage.getItem(STORAGE_KEY) ?? '[]')).toEqual([
      'qty',
      'code',
      'name',
    ]);

    unmount();
    render(<Harness />);

    expect(headers()).toEqual(['수량', '코드', '이름']);
  });

  it('끌지 않고 놓기만 하면(다른 곳에서 끌어 온 것) 순서는 그대로다', () => {
    render(<Harness />);

    fire(dragHandleOf('코드'), 'drop');

    expect(headers()).toEqual(['코드', '이름', '수량']);
    expect(globalThis.localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('저장값이 깨져 있으면 기본 순서다', () => {
    globalThis.localStorage.setItem(STORAGE_KEY, '{not json');
    render(<Harness />);

    expect(headers()).toEqual(['코드', '이름', '수량']);
  });

  it('폭 손잡이는 끌기 자리 밖에 선다 — 폭을 끌어도 순서 끌기가 시작되지 않는다', () => {
    render(<Harness />);
    const cell = screen.getByRole('columnheader', { name: '코드' });

    expect(cell.querySelector('.col-drag .col-resizer')).toBeNull();
    expect(cell.querySelector(':scope > .col-resizer')).not.toBeNull();
  });
});
