import { type Column, Table, type SortState } from '@crefle/web-ui';
import type { MouseEvent, ReactNode } from 'react';

import { useColumnOrder } from './column-grip-order';
import { useFitColumns } from './column-fit';
import { useColumnWidths } from './column-resize';

export interface ManagedTableProps<T> {
  /** 바꾼 열 폭 · 순서를 브라우저에 남기는 열쇠 — 표마다 달라야 한다(예: `omf-mes:inspection-results:columns:trend`). */
  storageKey: string;
  /** 열마다 px 폭(`width: '120px'`)과 정렬을 준다. */
  columns: Column<T>[];
  rows: T[];
  getRowId: (row: T) => string;
  caption: ReactNode;
  empty: ReactNode;
  /** 칸이 좁아도 열을 줄이지 않고 표 안에서 가로로 구른다(좌우 배치의 목록처럼). */
  scrollX?: boolean;
  sort?: SortState | null;
  onSortChange?: (sort: SortState | null) => void;
  className?: string;
  isBusy?: boolean;
  /** 주면 줄 아무 곳이나 눌러 그 줄을 고른다(단추 · 입력 칸 누름은 뺀다 · 검사 결과 목록과 같다). */
  onRowClick?: (row: T) => void;
}

/** 첫 열 칸에 줄 열쇠를 숨겨 둔다 — 줄 누름에서 그 줄을 찾는 데 쓴다(표 부품은 줄에 열쇠를 달지 않는다). */
const withRowId = <T,>(columns: Column<T>[], getRowId: (row: T) => string): Column<T>[] =>
  columns.map((column, index) =>
    index !== 0
      ? column
      : {
          ...column,
          render: (row: T, rowIndex: number) => (
            <>
              <span hidden data-managed-row-id={getRowId(row)} />
              {column.render
                ? column.render(row, rowIndex)
                : String((row as Record<string, unknown>)[column.key])}
            </>
          ),
        },
  );

/**
 * 검사 조회·판정 · 검사 결과 목록과 같은 표(사용자 2026-10-30 · omf-all-around#217) — 머리 경계를 끌어 열 폭을 바꾸고,
 * 손잡이로 열 순서를 옮기며(둘 다 브라우저에 남는다), 상자 폭에 맞춰 열을 비율대로 맞춘다. 줄 고르기가 없는 조회용 표가 쓴다.
 */
export const ManagedTable = <T,>({
  storageKey,
  columns,
  rows,
  getRowId,
  caption,
  empty,
  scrollX = false,
  sort,
  onSortChange,
  className,
  isBusy,
  onRowClick,
}: ManagedTableProps<T>) => {
  const ordered = useColumnOrder(`${storageKey}:order`, columns);
  const resizable = useColumnWidths(storageKey, ordered, { fitContent: scrollX });
  const fit = useFitColumns(resizable.columns, { scrollX });

  return (
    <div
      ref={fit.ref}
      className={['wide-table managed-table inspection-queue-table', className]
        .filter(Boolean)
        .join(' ')}
      style={resizable.style}
      aria-busy={isBusy}
      {...(onRowClick === undefined
        ? {}
        : {
            onClick: (event: MouseEvent<HTMLDivElement>) => {
              const target = event.target as Element;
              if (target.closest('button, a, input, select, textarea') !== null) return;
              // 줄 차례가 아니라 줄 열쇠(getRowId)로 찾는다 — 표가 정렬해 그린 차례와 `rows` 차례가 달라도 맞는 줄을 고른다.
              const id = target
                .closest('tbody tr')
                ?.querySelector<HTMLElement>('[data-managed-row-id]')?.dataset.managedRowId;
              const picked = rows.find((row) => getRowId(row) === id);
              if (picked !== undefined) onRowClick(picked);
            },
          })}
    >
      <Table
        density="compact"
        caption={caption}
        columns={onRowClick === undefined ? fit.columns : withRowId(fit.columns, getRowId)}
        rows={rows}
        getRowId={getRowId}
        empty={empty}
        {...(sort === undefined ? {} : { sort, onSortChange })}
      />
    </div>
  );
};
