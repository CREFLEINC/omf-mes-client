import { type Column, type SortState, Table } from '@crefle/web-ui';
import type { CSSProperties, MouseEvent, ReactNode, Ref } from 'react';

import { useColumnWidths } from './column-resize';

/**
 * 줄 고르기 — 한 열의 칸을 **고르는 단추**로 감싸고, 줄 어디를 눌러도 그 줄을 고른다. 고른 줄은 바탕을 칠한다.
 *
 * 표 부품에 줄 누름이 없어 표를 감싼 상자가 누름을 받는다 — 누른 줄 안의 단추(`data-board-row`)로 어느 줄인지 안다.
 * 키보드는 그 단추가 받는다(Enter · Space 가 단추의 click 을 내어 상자로 올라온다). 줄 안의 다른 단추 · 체크 · 입력칸 ·
 * 링크를 누른 것은 그쪽이 받는다.
 */
export interface BoardTablePick<T> {
  /** 고르는 단추를 세울 열. 그 칸 내용을 단추가 감싼다. */
  columnKey: string;
  /** 단추의 접근 이름 — 줄마다 어느 것인지 담는다(「PO-001 선택」). */
  label: (row: T) => string;
  /** 지금 고른 줄(`getRowId` 값). 없으면 `null`. */
  currentId: string | null;
  onPick: (row: T) => void;
  /** 고를 수 없는 줄 — 단추를 세우지 않는다. 없으면 다 고른다. */
  canPick?: (row: T) => boolean;
}

export interface BoardTableProps<T> {
  /** 표 이름 — 보이지 않는 caption 이다(구획 제목이 위에 보인다). */
  label: string;
  columns: Column<T>[];
  rows: T[];
  getRowId: (row: T) => string;
  /**
   * 열 폭을 브라우저에 남기는 열쇠 — **표마다 다르게.** 주면 머리칸 오른쪽 끝을 끌어 폭을 바꾸고, 두 번 누르면 원래
   * 폭으로 돌아간다(`column-resize.tsx`). 없으면 폭이 고정이다.
   */
  widthKey?: string;
  pick?: BoardTablePick<T>;
  /** 제어 정렬 — 부품은 받은 순서대로 그린다(정렬은 부르는 쪽이나 서버가 한다). */
  sort?: SortState | null;
  onSortChange?: (next: SortState | null) => void;
  /** 첫 열의 선택 체크(여럿 고르기). 줄 고르기(`pick`)와 따로 논다. */
  selectable?: boolean;
  selectedIds?: readonly string[];
  onSelectionChange?: (nextIds: string[]) => void;
  /** 줄이 없을 때 그 자리에 낸다(불러오는 중 · 빈 상태). */
  empty?: ReactNode;
  /** 표가 이보다 좁아지지 않는다 — 열을 넓힌 만큼 함께 는다. 구획이 더 좁으면 구획 안에서 가로로 넘긴다. */
  minWidth?: string;
  className?: string;
  /** 그린 뒤 표를 손보는 쪽(라인 표의 칸 병합)이 상자를 잡는다. */
  boxRef?: Ref<HTMLDivElement>;
  /** 줄 고르기와 다른 줄 누름(라인 표의 행 편집) — 상자의 click 을 먼저 받는다. */
  onBoxClick?: (event: MouseEvent<HTMLDivElement>) => void;
}

/** 줄 고르기가 받지 않는 누름 — 줄 안의 다른 조작. 고르는 단추는 예외다. */
const INTERACTIVE = 'button, input, a, label, select, textarea';
const PICK_CLASS = 'board-table-pick';

const cellText = <T,>(row: T, key: string): ReactNode => {
  const value = (row as Record<string, unknown>)[key];

  return value === null || value === undefined ? '' : String(value as string | number);
};

/**
 * **입고 관리 짜임의 표**(사용자 지시 2026-10-27 — 입고 관리의 표를 다른 화면이 그대로 쓴다). 디자인 시스템 `Table` 을
 * 감싸 아래를 한 벌로 낸다:
 *
 * - 행은 한 줄 · 고정 배치 · 칸 안 말줄임 · 촘촘한 밀도(`.po-board-table`) — 구획 안에서 머리줄이 고정되고 줄이 스크롤된다.
 * - 열 폭 끌기와 기억(`widthKey`) — 표의 최소 폭이 넓힌 만큼 따라간다(`minWidth`).
 * - 줄 어디를 눌러도 고르기와 고른 줄 칠하기(`pick`).
 * - 제어 정렬 · 선택 체크 · 빈 자리는 그대로 넘긴다.
 */
export const BoardTable = <T,>({
  label,
  columns,
  rows,
  getRowId,
  widthKey,
  pick,
  sort,
  onSortChange,
  selectable,
  selectedIds,
  onSelectionChange,
  empty,
  minWidth,
  className,
  boxRef,
  onBoxClick,
}: BoardTableProps<T>) => {
  const pickedColumns =
    pick === undefined
      ? columns
      : columns.map((column): Column<T> =>
          column.key !== pick.columnKey
            ? column
            : {
                ...column,
                render: (row, index) => {
                  const content = column.render?.(row, index) ?? cellText(row, column.key);
                  if (pick.canPick?.(row) === false) return content;
                  const id = getRowId(row);

                  return (
                    <button
                      type="button"
                      className={`link-cell ${PICK_CLASS}`}
                      aria-current={pick.currentId === id ? true : undefined}
                      aria-label={pick.label(row)}
                      data-board-row={id}
                    >
                      {content}
                    </button>
                  );
                },
              },
        );

  /* 열쇠가 없으면 폭을 끌지 않는다 — 훅은 늘 부르되 그 결과를 쓰지 않는다. */
  const resizable = useColumnWidths(widthKey ?? 'omf-mes:board-table:fixed', pickedColumns);
  const shown = widthKey === undefined ? pickedColumns : resizable.columns;
  const style: CSSProperties = {
    ...(widthKey === undefined ? {} : resizable.style),
    ...(minWidth === undefined ? {} : ({ '--board-table-min': minWidth } as CSSProperties)),
  };

  const handleClick = (event: MouseEvent<HTMLDivElement>): void => {
    onBoxClick?.(event);
    if (pick === undefined || event.defaultPrevented) return;

    const target = event.target as HTMLElement;
    const interactive = target.closest(INTERACTIVE);
    if (interactive !== null && !interactive.classList.contains(PICK_CLASS)) return;

    const id = target.closest('tbody tr')?.querySelector<HTMLElement>(`.${PICK_CLASS}`)
      ?.dataset.boardRow;
    const row = id === undefined ? undefined : rows.find((each) => getRowId(each) === id);
    if (row !== undefined) pick.onPick(row);
  };

  const boxClass = [
    'wide-table',
    'po-board-table',
    'board-table',
    pick === undefined ? '' : 'board-table-pickable',
    className ?? '',
  ]
    .filter((name) => name !== '')
    .join(' ');

  return (
    // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions
    <div ref={boxRef} className={boxClass} style={style} onClick={handleClick}>
      <Table
        density="compact"
        caption={<span className="erp-data-table-caption">{label}</span>}
        columns={shown}
        rows={rows}
        getRowId={getRowId}
        /* 준 것만 넘긴다 — `sort` 가 실리면(값이 없어도) 부품이 제어 정렬로 돈다. */
        {...(sort === undefined ? {} : { sort })}
        {...(onSortChange === undefined ? {} : { onSortChange })}
        {...(selectable === undefined ? {} : { selectable })}
        {...(selectedIds === undefined ? {} : { selectedIds })}
        {...(onSelectionChange === undefined ? {} : { onSelectionChange })}
        {...(empty === undefined ? {} : { empty })}
      />
    </div>
  );
};
