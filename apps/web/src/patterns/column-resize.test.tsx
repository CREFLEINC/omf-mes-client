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

const Harness = ({ columns = COLUMNS }: { columns?: Column<Row>[] }) => {
  const resizable = useColumnWidths(STORAGE_KEY, columns);

  return (
    <div data-testid="box" style={resizable.style}>
      <Table
        columns={resizable.columns}
        rows={[{ id: 1, code: 'A-1', name: '품목', qty: 3 }]}
        getRowId={(row) => String(row.id)}
      />
    </div>
  );
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
    });
  });

  it('정한 폭의 열을 끌면 그 폭이 되고, 표의 최소 폭이 바뀐 만큼 따라간다', () => {
    expect(layoutColumns(COLUMNS, { code: 200, qty: 60 })).toEqual({
      widths: { code: '200px', name: undefined, qty: '60px' },
      grow: 52,
      floor: 260,
    });
  });

  it('흡수하는 열이 하나뿐이면 끌어도 흡수하고, 끈 폭은 그 열이 지킬 폭이 된다', () => {
    expect(layoutColumns(COLUMNS, { name: 300 })).toEqual({
      widths: { code: '120px', name: undefined, qty: '88px' },
      grow: 0,
      floor: 508,
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

  it('내용이 다 보이는 폭보다 넓게는 늘지 않는다 — 끝은 그 열의 가장 넓은 칸이다(#186)', () => {
    /* jsdom 은 글 폭을 재지 못해 범위가 돌려줄 폭을 정한다 — 칸마다 글 폭 130px(여백은 0). */
    vi.spyOn(document, 'createRange').mockImplementation(
      () =>
        ({
          selectNodeContents: () => undefined,
          getBoundingClientRect: () => ({ width: 130 }) as DOMRect,
        }) as unknown as Range,
    );
    render(<Harness />);

    drag('코드', 120, 200);

    /* 끈 만큼(320px)이 아니라 글 폭 130px 에 칸 안쪽 여백만 더한 폭에서 멈춘다. */
    const [code] = renderedColWidths();
    expect(Number.parseFloat(code ?? '')).toBeGreaterThanOrEqual(130);
    expect(Number.parseFloat(code ?? '')).toBeLessThan(160);
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
