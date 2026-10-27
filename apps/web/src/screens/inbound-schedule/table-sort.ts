import type { SortDirection, SortState } from '@crefle/web-ui';

/**
 * 표 열 정렬의 **비교 규칙**(사용자 지시 2026-10-24 「컬럼을 내림차순, 오름차순 정렬할 수 있게」).
 *
 * 표 부품은 머리칸을 누를 때마다 오름 → 내림 → 해제로 돈다. 이 화면은 그 상태를 **제어**로 받는다(`sort` prop) —
 * 부품이 줄을 다시 세우게 두면 라인 아래 딸린 LOT 줄이 제 라인에서 떨어진다. 그래서 정렬은 여기서 하고,
 * 부품에는 정렬을 마친 줄을 넘긴다.
 *
 * - **빈 값은 방향과 상관없이 맨 뒤**다 — 내림차순에서 「—」 줄이 맨 위로 올라오면 값이 있는 줄이 밀려 보이지 않는다.
 * - 숫자는 크기로, 글자는 한국어 순서로 비교하되 글자 속 숫자는 숫자로 읽는다(「RM-2」 < 「RM-10」).
 * - 같은 값끼리는 원래 순서(서버 순서)를 지킨다 — `Array.prototype.sort` 는 안정 정렬이다.
 */
export type SortValue = string | number | null | undefined;

const isEmpty = (value: SortValue): value is null | undefined | '' =>
  value === null || value === undefined || value === '';

export const compareSortValues = (
  left: SortValue,
  right: SortValue,
  direction: SortDirection,
): number => {
  const leftEmpty = isEmpty(left);
  const rightEmpty = isEmpty(right);

  if (leftEmpty || rightEmpty) {
    if (leftEmpty && rightEmpty) return 0;

    return leftEmpty ? 1 : -1;
  }

  const sign = direction === 'ascending' ? 1 : -1;

  if (typeof left === 'number' && typeof right === 'number') return (left - right) * sign;

  return String(left).localeCompare(String(right), 'ko', { numeric: true }) * sign;
};

/** 열 키 → 그 열의 비교 값. 없는 키로 정렬하라고 하면(열이 사라졌다) 원래 순서 그대로다. */
export type SortAccessors<T> = Readonly<Record<string, (row: T) => SortValue>>;

export const sortRows = <T>(
  rows: readonly T[],
  sort: SortState | null,
  accessors: SortAccessors<T>,
): readonly T[] => {
  const accessor = sort === null ? undefined : accessors[sort.key];

  if (sort === null || accessor === undefined) return rows;

  return [...rows].sort((left, right) =>
    compareSortValues(accessor(left), accessor(right), sort.direction),
  );
};
