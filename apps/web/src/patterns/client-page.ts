import { useState } from 'react';

/** 상세 탭 표의 쪽 크기(사용자 지시 2026-10-27 · omf-all-around#185). */
export const TAB_PAGE_SIZES = [10, 20, 50] as const;
export type TabPageSize = (typeof TAB_PAGE_SIZES)[number];

/**
 * 이미 다 받은 줄을 화면에서 쪽으로 나눈다 — 서버 쪽 나누기가 없는 표(측정치 · 첨부 · 이력 · 이전 회차)용.
 * 줄 수가 줄어 지금 쪽이 비면 마지막 쪽을 보인다. 가장 작은 쪽 크기보다 줄이 많을 때만 쪽 이동을 그린다.
 */
export const useClientPage = <T>(rows: readonly T[]) => {
  const [size, setSize] = useState<TabPageSize>(TAB_PAGE_SIZES[0]);
  const [page, setPage] = useState(1);
  const total = rows.length;
  const current = Math.min(page, Math.max(1, Math.ceil(total / size)));

  return {
    rows: rows.slice((current - 1) * size, current * size),
    nav:
      total > TAB_PAGE_SIZES[0]
        ? {
            meta: { page: current, size, total },
            sizes: TAB_PAGE_SIZES,
            onChangePage: setPage,
            onChangeSize: (next: TabPageSize) => {
              setSize(next);
              setPage(1);
            },
          }
        : null,
  };
};
