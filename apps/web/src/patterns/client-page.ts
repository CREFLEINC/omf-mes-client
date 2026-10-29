import type { SortState } from '@crefle/web-ui';
import { useState } from 'react';

/** 상세 탭 표의 쪽 크기(사용자 지시 2026-10-27 · omf-all-around#185). */
export const TAB_PAGE_SIZES = [10, 20, 50] as const;
export type TabPageSize = (typeof TAB_PAGE_SIZES)[number];

/**
 * 이미 다 받은 줄을 화면에서 쪽으로 나눈다 — 서버 쪽 나누기가 없는 표(측정치 · 첨부 · 이력 · 이전 회차)용.
 * 줄 수가 줄어 지금 쪽이 비면 마지막 쪽을 보인다. 쪽 이동은 줄 수와 무관하게 늘 그린다 — 목록 표 아래와 같은
 * 「총 n건 · 쪽 크기 · [처음] [이전] n/N [다음] [마지막]」 한 줄(사용자 지시 2026-10-28 · #197).
 *
 * 정렬할 열은 `sortAccessors` 로 준다 — 쪽을 나누기 «전에» 전체 줄을 정렬한다(표 부품의 내부 정렬은 받은 쪽 안만 정렬한다).
 * 결과의 `sort` · `onSortChange` 를 표에 그대로 넘긴다. 정렬을 바꾸면 첫 쪽으로 간다.
 */
export const useClientPage = <T>(
  rows: readonly T[],
  sortAccessors: Readonly<Record<string, (row: T) => string | number>> = {},
) => {
  const [size, setSize] = useState<TabPageSize>(TAB_PAGE_SIZES[0]);
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<SortState | null>(null);
  const total = rows.length;
  const current = Math.min(page, Math.max(1, Math.ceil(total / size)));

  const accessor = sort === null ? undefined : sortAccessors[sort.key];
  const sorted =
    sort === null || accessor === undefined
      ? rows
      : [...rows].sort((a, b) => {
          const x = accessor(a);
          const y = accessor(b);
          const order = x < y ? -1 : x > y ? 1 : 0;
          return sort.direction === 'ascending' ? order : -order;
        });

  return {
    rows: sorted.slice((current - 1) * size, current * size),
    sort,
    onSortChange: (next: SortState | null) => {
      setSort(next);
      setPage(1);
    },
    nav: {
      meta: { page: current, size, total },
      sizes: TAB_PAGE_SIZES,
      onChangePage: setPage,
      onChangeSize: (next: TabPageSize) => {
        setSize(next);
        setPage(1);
      },
    },
  };
};
