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

/** 남는 폭을 맡는 열이 다른 열에 밀려도 남기는 폭 — 그 열의 글이 아예 사라지지 않게. */
const ABSORBER_KEEP = 80;

/** 좌우 배치(목록 | 상세)에서 한 열이 넓어질 수 있는 끝 — 칸 안에서 옆으로 넘겨 보므로 한없이 넓히지 않는다(#186). */
const SIDE_COLUMN_MAX = 480;

/**
 * 상하 배치에서 이 열을 넓힐 수 있는 끝(px) — **표 폭을 넓히지 않는 데까지**다(사용자 지시 2026-10-26 · #186 「표가 넘어가는 버그」·
 * 「좌우·상하 배치 동작은 같아야」). 넓힌 만큼 남는 폭을 맡는 열이 줄어들고, 그 열마다 `ABSORBER_KEEP` 은 남긴다.
 * 표 폭은 상자 폭과 지금 표 폭 가운데 큰 쪽이다 — 좁은 칸에서 이미 옆으로 넘기는 표도 더 넓어지지 않는다.
 * 잴 수 없으면(시험 환경) 끝이 없다.
 */
const widestOf = (cell: HTMLTableCellElement): number => {
  const table = cell.closest('table');
  const box = table?.parentElement;
  if (!table || !box || box.clientWidth === 0) return Infinity;

  const heads = Array.from(cell.parentElement?.children ?? []);
  let others = 0;
  Array.from(table.querySelectorAll('col')).forEach((col, index) => {
    if (index === cell.cellIndex) return;
    others +=
      col.style.width === '' ? ABSORBER_KEEP : (heads[index]?.getBoundingClientRect().width ?? 0);
  });

  return Math.max(box.clientWidth, table.getBoundingClientRect().width) - others;
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
      /*
       * 배치 고르기(`po-board.tsx` `usePaneLayout`)가 있는 화면만 끝을 둔다(#186 사용자 지시). 상하 배치는 표가 칸을
       * 넘지 않는 데까지, 좌우 배치는 한 열 480px 까지(표는 칸 안에서 옆으로 넘긴다). 그 밖의 화면은 종전 그대로다.
       */
      const split = cell.closest('.po-board-split');
      const widest = split?.classList.contains('is-stacked')
        ? Math.max(widestOf(cell), startWidth)
        : split?.classList.contains('is-side')
          ? Math.max(SIDE_COLUMN_MAX, startWidth)
          : Infinity;
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
