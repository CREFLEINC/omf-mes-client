import { Table, type Column, type SummaryCell } from '@crefle/web-ui';
import {
  useLayoutEffect,
  useRef,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
} from 'react';

/**
 * C-1 행 선택 공용 부품. DS `Table` 감싸개.
 *
 * - 행 전체를 눌러 고른다. 위아래 방향키로 행을 옮기고 Enter로 고른다.
 * - `checkedIds`를 주면 DS 체크박스 열을 쓴다(일괄 대상). 체크박스 칸을 눌러도 행 동작이 일어나지 않는다(T-W-C 작업함).
 * - `stickyLastColumn`이면 마지막 열(행 동작)을 오른쪽에 고정한다.
 *
 * DS `Table`에 행 클릭이 생기면 걷어 낸다(규범 6장). 그때까지는 그려진 `tbody tr`에 순서대로 속성을 붙인다.
 * 미구현: 그룹 머리 행(`groupBy`)과 함께 쓰기.
 */
export interface SelectableTableProps<T> {
  columns: Column<T>[];
  rows: T[];
  getRowId: (row: T) => string;
  caption?: ReactNode;
  empty?: ReactNode;
  className?: string;
  summaryRows?: SummaryCell[][];
  /** 선택된 행. 작업함처럼 선택 상태가 의미 없으면 주지 않는다(C-1 이탈 조건). */
  activeId?: string | null;
  /** 행을 누르거나 Enter. */
  onActivate?: (row: T) => void;
  /** 행의 접근명(예: 「IR-2026-000210 처리 화면 열기」). */
  rowLabel?: (row: T) => string;
  checkedIds?: readonly string[];
  onCheckedChange?: (ids: string[]) => void;
  /** 체크박스의 접근 이름(예: 「UIR-PO-001 선택」). 같은 이름을 여러 곳에 두지 않는다(C-1). */
  checkLabel?: (row: T) => string;
  /**
   * 행을 누르면 다른 화면으로 가는 표(작업함)는 행을 링크로 알린다. 보조기기와 자동화 도구가 행을 조작 대상으로 찾는다.
   * 선택 표시가 있는 표는 주지 않는다(행 의미를 유지).
   */
  rowRole?: 'link';
  stickyLastColumn?: boolean;
}

const INTERACTIVE =
  'input, button, a, select, textarea, label, [role="checkbox"], [role="combobox"], [role="button"]';

export const SelectableTable = <T,>({
  columns,
  rows,
  getRowId,
  caption,
  empty,
  className,
  summaryRows,
  activeId = null,
  onActivate,
  rowLabel,
  checkedIds,
  onCheckedChange,
  stickyLastColumn = false,
  checkLabel,
  rowRole,
}: SelectableTableProps<T>) => {
  const wrapper = useRef<HTMLDivElement>(null);
  const checkable = checkedIds !== undefined && onCheckedChange !== undefined;

  const dataRows = (): HTMLTableRowElement[] =>
    wrapper.current === null
      ? []
      : [...wrapper.current.querySelectorAll<HTMLTableRowElement>('tbody > tr')];

  useLayoutEffect(() => {
    const trs = dataRows();
    if (trs.length !== rows.length) return;
    trs.forEach((tr, index) => {
      const row = rows[index];
      if (row === undefined) return;
      const id = getRowId(row);
      tr.dataset.rowId = id;
      tr.tabIndex = onActivate === undefined ? -1 : 0;
      tr.classList.add('selectable-table-row');
      tr.classList.toggle('is-active', activeId !== null && activeId === id);
      if (activeId !== null) tr.setAttribute('aria-selected', String(activeId === id));
      else tr.removeAttribute('aria-selected');
      const label = rowLabel?.(row);
      if (label !== undefined) tr.setAttribute('aria-label', label);
      if (rowRole !== undefined) tr.setAttribute('role', rowRole);
      const box =
        checkLabel === undefined ? null : tr.cells[0]?.querySelector('input[type="checkbox"]');
      if (box != null && checkLabel !== undefined) box.setAttribute('aria-label', checkLabel(row));
    });
  });

  const rowOf = (tr: HTMLTableRowElement): T | undefined => {
    const index = dataRows().indexOf(tr);
    return index < 0 || dataRows().length !== rows.length ? undefined : rows[index];
  };

  const onClick = (event: MouseEvent<HTMLDivElement>) => {
    if (onActivate === undefined) return;
    const target = event.target as HTMLElement;
    const tr = target.closest<HTMLTableRowElement>('tbody > tr');
    if (tr === null || !wrapper.current?.contains(tr)) return;
    if (target.closest(INTERACTIVE) !== null) return;
    /* 체크박스 칸 전체는 고르기 자리다 — 칸의 빈 곳을 눌러도 이동하지 않는다. */
    if (checkable && target.closest('td') === tr.cells[0]) return;
    const row = rowOf(tr);
    if (row !== undefined) onActivate(row);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement;
    if (target.tagName !== 'TR') return;
    const trs = dataRows();
    const index = trs.indexOf(target as HTMLTableRowElement);
    if (index < 0) return;
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const next =
        trs[
          event.key === 'ArrowDown' ? Math.min(index + 1, trs.length - 1) : Math.max(index - 1, 0)
        ];
      next?.focus();
    } else if (event.key === 'Enter' && onActivate !== undefined) {
      event.preventDefault();
      const row = rowOf(target as HTMLTableRowElement);
      if (row !== undefined) onActivate(row);
    }
  };

  return (
    /* 행 위임: 각 행이 tabIndex와 접근명을 갖는다. */
    <div
      ref={wrapper}
      className={[
        'selectable-table',
        onActivate === undefined ? '' : 'is-clickable',
        stickyLastColumn ? 'has-sticky-last' : '',
        className ?? '',
      ]
        .filter((name) => name !== '')
        .join(' ')}
      onClick={onClick}
      onKeyDown={onKeyDown}
    >
      <Table
        caption={caption}
        density="compact"
        zebra={false}
        columns={columns}
        rows={rows}
        getRowId={(row) => getRowId(row)}
        sort={null}
        empty={empty}
        summaryRows={summaryRows}
        {...(checkable
          ? { selectable: true, selectedIds: checkedIds, onSelectionChange: onCheckedChange }
          : {})}
      />
    </div>
  );
};
