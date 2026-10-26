import type { Column } from '@crefle/web-ui';
import { useState, type CSSProperties } from 'react';

/**
 * 표 열 폭 조절(사용자 지시 2026-10-22). 머리칸 오른쪽 끝을 끌면 그 열의 폭이 바뀌고, 두 번 누르면 원래 폭으로
 * 돌아간다. 폭은 표마다 브라우저에 남긴다 — 다시 들어와도 고른 폭이 유지된다. 저장소가 막혀 있으면 기본 폭이다.
 *
 * 폭을 정하지 않은 열(이름 열)은 지금처럼 남는 폭을 흡수한다. 그 열을 끌면 흡수하면서 「적어도 이만큼」이 된다.
 * 흡수하는 열이 여럿이면 끈 열은 고정 폭이 되고 나머지가 흡수한다.
 *
 * 표의 최소 폭(app.css)은 열을 넓힌 만큼 늘고 줄인 만큼 준다 — 이 조각이 감싼 상자에 `--col-grow`(기본 폭과의
 * 차이) · `--col-floor`(고정 폭의 합 + 흡수하는 열이 지킬 폭)를 싣는다.
 */

const COLUMN_MIN = 40;
const COLUMN_MAX = 960;

export type ColumnWidths = Readonly<Record<string, number>>;

const clampWidth = (value: number): number =>
  Math.round(Math.min(COLUMN_MAX, Math.max(COLUMN_MIN, value)));

/** `'96px'` → 96. 폭이 없거나 px 가 아니면 남는 폭을 흡수하는 열이다. */
const pxOf = (width: string | undefined): number | null => {
  if (width === undefined || !width.endsWith('px')) return null;
  const value = Number.parseFloat(width);

  return Number.isFinite(value) ? value : null;
};

const readWidths = (storageKey: string): ColumnWidths => {
  try {
    const raw: unknown = JSON.parse(window.localStorage.getItem(storageKey) ?? '{}');
    if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return {};

    return Object.fromEntries(
      Object.entries(raw)
        .filter((entry): entry is [string, number] => Number.isFinite(entry[1]))
        .map(([key, value]) => [key, clampWidth(value)]),
    );
  } catch {
    return {};
  }
};

export interface ColumnLayout {
  /** 열마다 colgroup 에 줄 폭. 없으면 남는 폭을 흡수한다. */
  widths: Readonly<Record<string, string | undefined>>;
  /** 기본 폭을 가진 열들이 기본보다 넓어진(음수면 좁아진) 합(px). */
  grow: number;
  /** 표가 이보다 좁아지지 않는다(px). */
  floor: number;
}

/** 끈 폭(`overrides`)을 열에 얹는다. 흡수하는 열은 늘 하나 이상 남긴다 — 다 정해지면 첫째 열이 흡수한다. */
export const layoutColumns = (
  columns: readonly { key: string; width?: string }[],
  overrides: ColumnWidths,
): ColumnLayout => {
  const flexKeys = columns.filter((column) => pxOf(column.width) === null).map(({ key }) => key);
  const free = flexKeys.filter((key) => overrides[key] === undefined);
  const absorbers = new Set(free.length > 0 ? free : flexKeys.slice(0, 1));

  const widths: Record<string, string | undefined> = {};
  let grow = 0;
  let floor = 0;
  for (const column of columns) {
    const base = pxOf(column.width);
    const override = overrides[column.key];
    if (absorbers.has(column.key)) {
      widths[column.key] = undefined;
      floor += override ?? 0;
      continue;
    }
    const width = override ?? base ?? COLUMN_MIN;
    widths[column.key] = `${String(width)}px`;
    floor += width;
    if (base !== null) grow += width - base;
  }

  return { widths, grow, floor };
};

/** 머리글 옆 순서 손잡이(`column-order.tsx`)가 차지하는 폭 — 머리글이 다 보이는 폭에 더한다. */
const HEADER_HANDLE_ROOM = 20;

/**
 * 이 열의 칸들이 줄임 없이 다 보이는 폭(px) — 끌어서 넓힐 수 있는 끝이다(사용자 지시 2026-10-26 · #186 「무제한이 아니라
 * 데이터의 최대 너비」). 칸마다 글의 실제 폭에 안쪽 여백을 더해 가장 넓은 값을 쓴다. 잴 수 없으면(시험 환경) 끝이 없다.
 */
const contentWidthOf = (cell: HTMLTableCellElement): number => {
  const table = cell.closest('table');
  if (table === null || typeof document.createRange !== 'function') return Infinity;

  let widest = 0;
  for (const row of Array.from(table.rows)) {
    const target = row.cells[cell.cellIndex];
    /* 빈 목록 안내처럼 여러 칸을 덮는 줄은 이 열의 내용이 아니다. */
    if (target === undefined || target.colSpan > 1) continue;
    const label = target.tagName === 'TH' ? target.querySelector('.col-drag-label') : null;
    const range = document.createRange();
    /* 시험 환경(jsdom)의 범위에는 잴 수단이 없다 — 그때는 끝을 두지 않는다. */
    if (typeof range.getBoundingClientRect !== 'function') return Infinity;
    range.selectNodeContents(label ?? target);
    const rect = range.getBoundingClientRect();
    const style = getComputedStyle(target);
    const padding = Number.parseFloat(style.paddingLeft) + Number.parseFloat(style.paddingRight);
    widest = Math.max(widest, rect.width + padding + (label === null ? 0 : HEADER_HANDLE_ROOM));
  }

  return widest > 0 ? Math.ceil(widest) : Infinity;
};

/**
 * 끌기 손잡이 — 머리칸 오른쪽 끝의 세로 막대. 마우스·터치로 끈다. 읽기 도구에는 감춘다 — 머리칸 이름에
 * 섞이지 않게.
 */
const ColumnResizer = ({
  onResize,
  onReset,
}: {
  onResize: (width: number) => void;
  onReset: () => void;
}) => (
  <span
    className="col-resizer"
    aria-hidden="true"
    onPointerDown={(event) => {
      const cell = event.currentTarget.closest('th');
      if (cell === null || event.button !== 0) return;
      event.preventDefault();
      const startX = event.clientX;
      const startWidth = cell.getBoundingClientRect().width;
      /* 내용보다 넓게는 늘리지 않는다. 이미 그보다 넓으면(남는 폭을 흡수한 열) 지금 폭이 끝이다. */
      const widest = Math.max(contentWidthOf(cell), startWidth);
      const move = (moveEvent: PointerEvent): void => {
        onResize(Math.min(widest, startWidth + moveEvent.clientX - startX));
      };
      const up = (): void => {
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', up);
        document.body.classList.remove('po-board-resizing');
      };
      document.body.classList.add('po-board-resizing');
      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', up);
    }}
    onDoubleClick={onReset}
  />
);

/**
 * 열마다 끌기 손잡이를 단 열과, 표를 감싼 상자에 줄 `style` 을 낸다.
 * `storageKey` 는 표마다 다르게 — 같은 열 이름이 다른 표에서 다른 폭이어도 섞이지 않게.
 */
export const useColumnWidths = <T,>(storageKey: string, columns: Column<T>[]) => {
  const [overrides, setOverrides] = useState<ColumnWidths>(() => readWidths(storageKey));

  /* 끄는 동안 다른 열은 바뀌지 않는다 — 끌기 시작할 때의 값에 그 열만 얹어도 된다. */
  const commit = (next: ColumnWidths): void => {
    setOverrides(next);
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(next));
    } catch {
      /* 저장하지 못해도 이번 화면에서는 그대로 쓴다. */
    }
  };

  const layout = layoutColumns(columns, overrides);

  return {
    columns: columns.map((column): Column<T> => ({
      ...column,
      width: layout.widths[column.key],
      header: (
        <>
          {column.header}
          <ColumnResizer
            onResize={(value) => {
              commit({ ...overrides, [column.key]: clampWidth(value) });
            }}
            onReset={() => {
              commit(
                Object.fromEntries(Object.entries(overrides).filter(([key]) => key !== column.key)),
              );
            }}
          />
        </>
      ),
    })),
    style: {
      '--col-grow': `${String(layout.grow)}px`,
      '--col-floor': `${String(layout.floor)}px`,
    } as CSSProperties,
  };
};
