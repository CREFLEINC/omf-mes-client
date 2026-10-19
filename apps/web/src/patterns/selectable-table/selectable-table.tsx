import { Table, type TableProps } from '@crefle/web-ui';
import { useLayoutEffect, useRef, type KeyboardEvent, type MouseEvent } from 'react';

/**
 * 행 전체를 눌러 고르는 표 — 화면 구성 규범 C-1.
 *
 * DS `Table`에는 행 클릭·선택 행 표시·키보드 이동이 없어 이 감싸개가 더한다(규범 6장).
 * **임시 감싸개다.** DS `Table`에 행 클릭이 들어오면 걷어 낸다.
 *
 * - 행 어디를 눌러도 `onRowActivate`가 불린다. 행 안의 버튼·링크·입력을 누른 것은 그쪽 동작으로 둔다.
 * - 고른 행은 배경과 왼쪽 막대로 표시한다(`aria-selected`, `app.css`의 `.selectable-table`).
 * - 위아래 방향키로 행 사이를 옮기고 Enter·Space로 고른다.
 * - 고를 수 없는 행(`isRowDisabled`)은 눌러도 반응하지 않고 `aria-disabled`를 단다.
 *   사유는 화면이 그 행의 칸 안에 보인다(배치 규범 4).
 *
 * 체크박스 다중 선택(`selectable`)과 한 표에 섞지 않는다(C-1) — 그 속성은 받지 않는다.
 * 오른쪽 고정 행 동작 열은 이 화면들에 필요하지 않아 아직 두지 않았다.
 *
 * 구현 주의: DS `Table`이 행 요소에 속성을 넘겨주지 않아, 그려진 `tbody tr`에 속성을 직접 단다.
 * 정렬·그룹 행을 쓰면 행 순서와 `rows` 순서가 갈리므로 그 둘은 받지 않는다.
 */
export interface SelectableTableProps<T> extends Omit<
  TableProps<T>,
  | 'selectable'
  | 'selectedIds'
  | 'onSelectionChange'
  | 'groupBy'
  | 'renderGroupHeader'
  | 'sort'
  | 'defaultSort'
  | 'onSortChange'
  | 'reorderable'
  | 'onRowReorder'
> {
  /** 행을 눌렀을 때(또는 Enter). 고를 수 없는 행에서는 불리지 않는다 */
  onRowActivate: (row: T) => void;
  /** 고른 행인가. 작업함처럼 선택 상태가 의미 없으면 주지 않는다(C-1 이탈 조건) */
  isRowSelected?: (row: T) => boolean;
  isRowDisabled?: (row: T) => boolean;
  /** 행의 접근 이름. 행이 버튼처럼 동작하므로 무엇을 고르는지 읽혀야 한다 */
  getRowLabel: (row: T) => string;
  /** 행 설명의 `id`(고를 수 없는 사유 등). 행이 `aria-describedby`로 잇는다 */
  getRowDescribedBy?: (row: T) => string | undefined;
  /** 감싸는 요소에 더할 클래스(`.wide-table` 등) */
  wrapperClassName?: string;
}

const INTERACTIVE = 'button, a, input, select, textarea, label, [role="button"]';

const dataRows = (root: HTMLElement | null): HTMLTableRowElement[] =>
  root === null
    ? []
    : [...root.querySelectorAll<HTMLTableRowElement>('tbody tr')].filter(
        (row) => row.dataset.rowIndex !== undefined,
      );

export const SelectableTable = <T,>({
  rows,
  onRowActivate,
  isRowSelected,
  isRowDisabled,
  getRowLabel,
  getRowDescribedBy,
  wrapperClassName,
  ...tableProps
}: SelectableTableProps<T>) => {
  const rootRef = useRef<HTMLDivElement>(null);

  /*
   * 그려진 행에 상태를 단다. 행 순서는 `rows` 순서와 같다(정렬·그룹을 받지 않는다).
   * 빈 상태 행은 칸이 하나뿐이라 `rows`가 비어 있을 때는 아무것도 달지 않는다.
   */
  useLayoutEffect(() => {
    const root = rootRef.current;

    if (root === null) return;

    const trs = [...root.querySelectorAll<HTMLTableRowElement>('tbody tr')];

    if (rows.length === 0 || trs.length !== rows.length) {
      trs.forEach((tr) => {
        delete tr.dataset.rowIndex;
      });

      return;
    }

    trs.forEach((tr, index) => {
      const row = rows[index] as T;
      const disabled = isRowDisabled?.(row) ?? false;
      const selected = isRowSelected?.(row) ?? false;

      tr.dataset.rowIndex = String(index);
      tr.tabIndex = disabled ? -1 : 0;
      tr.setAttribute('aria-label', getRowLabel(row));
      const describedBy = getRowDescribedBy?.(row);
      if (describedBy === undefined) tr.removeAttribute('aria-describedby');
      else tr.setAttribute('aria-describedby', describedBy);
      if (isRowSelected !== undefined) tr.setAttribute('aria-selected', String(selected));
      else tr.removeAttribute('aria-selected');
      if (disabled) tr.setAttribute('aria-disabled', 'true');
      else tr.removeAttribute('aria-disabled');
    });
  });

  const rowOf = (target: EventTarget | null): { tr: HTMLTableRowElement; row: T } | null => {
    if (!(target instanceof Element)) return null;

    const tr = target.closest<HTMLTableRowElement>('tbody tr[data-row-index]');

    if (tr === null) return null;

    const row = rows[Number(tr.dataset.rowIndex)];

    return row === undefined ? null : { tr, row };
  };

  const activate = (row: T): void => {
    if (isRowDisabled?.(row) ?? false) return;

    onRowActivate(row);
  };

  const onClick = (event: MouseEvent<HTMLDivElement>): void => {
    /* 행 안의 버튼·링크·입력은 그쪽 동작이다. */
    if (event.target instanceof Element && event.target.closest(INTERACTIVE) !== null) return;

    const found = rowOf(event.target);

    if (found !== null) activate(found.row);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    const found = rowOf(event.target);

    if (found === null || event.target !== found.tr) return;

    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      activate(found.row);

      return;
    }

    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;

    event.preventDefault();

    const focusable = dataRows(rootRef.current).filter((tr) => tr.tabIndex === 0);
    const at = focusable.indexOf(found.tr);
    const next = focusable[event.key === 'ArrowDown' ? at + 1 : at - 1];

    next?.focus();
  };

  return (
    /* 행이 키보드 초점을 받고 이 요소가 행의 클릭·키 입력을 위임받는다. */
    <div
      ref={rootRef}
      className={['selectable-table', wrapperClassName].filter(Boolean).join(' ')}
      onClick={onClick}
      onKeyDown={onKeyDown}
    >
      <Table {...tableProps} rows={rows} />
    </div>
  );
};
