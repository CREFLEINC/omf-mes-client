import { type Column, Table } from '@crefle/web-ui';
import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { layoutColumns, useColumnWidths } from './column-resize';

interface Row {
  id: number;
  code: string;
  name: string;
  qty: number;
}

const COLUMNS: Column<Row>[] = [
  { key: 'code', header: '코드', width: '120px' },
  { key: 'name', header: '이름' },
  { key: 'qty', header: '수량', width: '88px', align: 'end' },
];

const STORAGE_KEY = 'test:columns';

/** `split` — 배치 고르기가 있는 화면의 두 구획 상자 이름(`po-board.tsx` `usePaneLayout`). 없으면 그 밖의 화면이다. */
const Harness = ({
  columns = COLUMNS,
  split,
}: {
  columns?: Column<Row>[];
  split?: 'is-side' | 'is-stacked';
}) => {
  const resizable = useColumnWidths(STORAGE_KEY, columns);

  const box = (
    <div data-testid="box" style={resizable.style}>
      <Table
        columns={resizable.columns}
        rows={[{ id: 1, code: 'A-1', name: '품목', qty: 3 }]}
        getRowId={(row) => String(row.id)}
      />
    </div>
  );

  return split === undefined ? box : <div className={`po-board-split ${split}`}>{box}</div>;
};

const renderedColWidths = (): (string | undefined)[] =>
  Array.from(screen.getByRole('table').querySelectorAll('col')).map((col) => {
    const width = (col as HTMLElement).style.width;

    return width === '' ? undefined : width;
  });

const handleOf = (header: string): HTMLElement => {
  const handle = screen.getByRole('columnheader', { name: header }).querySelector('.col-resizer');
  if (!(handle instanceof HTMLElement)) throw new Error(`${header} 손잡이가 없다`);

  return handle;
};

/** 머리칸을 `startWidth` 로 재게 하고, 손잡이를 `dx` 만큼 끈다. */
const drag = (header: string, startWidth: number, dx: number): void => {
  const cell = screen.getByRole('columnheader', { name: header });
  vi.spyOn(cell, 'getBoundingClientRect').mockReturnValue({ width: startWidth } as DOMRect);
  fireEvent(handleOf(header), new MouseEvent('pointerdown', { bubbles: true, clientX: 500 }));
  fireEvent(window, new MouseEvent('pointermove', { clientX: 500 + dx }));
  fireEvent(window, new MouseEvent('pointerup'));
};

beforeEach(() => {
  globalThis.localStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('layoutColumns', () => {
  it('끈 적이 없으면 정한 폭 그대로이고, 폭 없는 열이 남는 폭을 흡수한다', () => {
    expect(layoutColumns(COLUMNS, {})).toEqual({
      widths: { code: '120px', name: undefined, qty: '88px' },
      grow: 0,
      floor: 208,
      fixed: 208,
    });
  });

  it('정한 폭의 열을 끌면 그 폭이 되고, 표의 최소 폭이 바뀐 만큼 따라간다', () => {
    expect(layoutColumns(COLUMNS, { code: 200, qty: 60 })).toEqual({
      widths: { code: '200px', name: undefined, qty: '60px' },
      grow: 52,
      floor: 260,
      fixed: 260,
    });
  });

  it('흡수하는 열이 하나뿐이면 끌어도 흡수하고, 끈 폭은 그 열이 지킬 폭이 된다', () => {
    expect(layoutColumns(COLUMNS, { name: 300 })).toEqual({
      widths: { code: '120px', name: undefined, qty: '88px' },
      grow: 0,
      floor: 508,
      fixed: 208,
    });
  });

  it('흡수하는 열이 여럿이면 끈 열은 고정 폭이 되고 나머지가 흡수한다', () => {
    const columns = [{ key: 'a', width: '100px' }, { key: 'b' }, { key: 'c' }];

    expect(layoutColumns(columns, { b: 150 }).widths).toEqual({
      a: '100px',
      b: '150px',
      c: undefined,
    });
    /* 다 끌었으면 첫째 열이 흡수한다 — 표가 칸을 채우지 못하는 일이 없게. */
    expect(layoutColumns(columns, { b: 150, c: 90 })).toEqual({
      widths: { a: '100px', b: undefined, c: '90px' },
      grow: 0,
      floor: 340,
      fixed: 190,
    });
  });
});

describe('useColumnWidths', () => {
  it('머리칸 이름은 그대로다 — 손잡이는 읽기 도구에 감춘다', () => {
    render(<Harness />);

    expect(screen.getAllByRole('columnheader').map((cell) => cell.textContent)).toEqual([
      '코드',
      '이름',
      '수량',
    ]);
    expect(handleOf('코드')).toHaveAttribute('aria-hidden', 'true');
  });

  it('손잡이를 끌면 그 열의 폭이 바뀌고 브라우저에 남는다', () => {
    render(<Harness />);

    drag('코드', 120, 60);

    expect(renderedColWidths()).toEqual(['180px', undefined, '88px']);
    expect(screen.getByTestId('box').style.getPropertyValue('--col-grow')).toBe('60px');
    expect(JSON.parse(globalThis.localStorage.getItem(STORAGE_KEY) ?? '')).toEqual({ code: 180 });
  });

  it('상하 배치에서는 넓혀도 표 폭은 그대로다 — 남는 폭을 맡는 열이 줄고 80px 은 남긴다(#186)', () => {
    render(<Harness split="is-stacked" />);
    const table = screen.getByRole('table');
    /* jsdom 은 폭을 재지 못한다 — 상자 400px, 표 500px(이미 옆으로 넘기는 좁은 칸), 수량 열 88px 로 둔다. */
    Object.defineProperty(table.parentElement, 'clientWidth', { configurable: true, value: 400 });
    vi.spyOn(table, 'getBoundingClientRect').mockReturnValue({ width: 500 } as DOMRect);
    vi.spyOn(
      screen.getByRole('columnheader', { name: '수량' }),
      'getBoundingClientRect',
    ).mockReturnValue({ width: 88 } as DOMRect);

    drag('코드', 120, 300);

    /* 500 − 이름(남는 폭 · 80) − 수량(88) = 332. 끈 만큼(420px)이 아니다. */
    expect(renderedColWidths()).toEqual(['332px', undefined, '88px']);
  });

  it('좌우 배치에서는 한 열이 480px 까지 넓어진다 — 표는 칸 안에서 옆으로 넘긴다(#186)', () => {
    render(<Harness split="is-side" />);

    drag('코드', 120, 1000);

    expect(renderedColWidths()).toEqual(['480px', undefined, '88px']);
  });

  it('너무 좁게는 줄지 않는다', () => {
    render(<Harness />);

    drag('수량', 88, -200);

    expect(renderedColWidths()).toEqual(['120px', undefined, '40px']);
  });

  it('손잡이를 두 번 누르면 그 열만 원래 폭으로 돌아간다', () => {
    globalThis.localStorage.setItem(STORAGE_KEY, JSON.stringify({ code: 180, qty: 60 }));
    render(<Harness />);

    expect(renderedColWidths()).toEqual(['180px', undefined, '60px']);

    fireEvent.doubleClick(handleOf('코드'));

    expect(renderedColWidths()).toEqual(['120px', undefined, '60px']);
    expect(JSON.parse(globalThis.localStorage.getItem(STORAGE_KEY) ?? '')).toEqual({ qty: 60 });
  });

  it('남긴 값이 망가져 있으면 기본 폭으로 연다', () => {
    globalThis.localStorage.setItem(STORAGE_KEY, '{');
    render(<Harness />);

    expect(renderedColWidths()).toEqual(['120px', undefined, '88px']);
  });

  it('흡수하는 열을 끌면 흡수하는 채로 지킬 폭만 늘고, 놓으면 끌기 표시가 풀린다', () => {
    render(<Harness />);

    drag('이름', 200, 40);

    expect(renderedColWidths()).toEqual(['120px', undefined, '88px']);
    expect(screen.getByTestId('box').style.getPropertyValue('--col-floor')).toBe('448px');
    expect(document.body).not.toHaveClass('po-board-resizing');
  });
});
