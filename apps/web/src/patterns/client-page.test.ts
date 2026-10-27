import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { useClientPage } from './client-page';

const rows = (count: number): number[] => Array.from({ length: count }, (_, index) => index + 1);

describe('useClientPage', () => {
  it('10건 이하면 쪽 이동을 그리지 않고 다 보인다', () => {
    const { result } = renderHook(() => useClientPage(rows(10)));

    expect(result.current.rows).toHaveLength(10);
    expect(result.current.nav).toBeNull();
  });

  it('기본 10건씩 나누고, 쪽 크기를 바꾸면 첫 쪽으로 돌아간다', () => {
    const { result } = renderHook(() => useClientPage(rows(55)));

    expect(result.current.rows).toEqual(rows(10));
    act(() => result.current.nav?.onChangePage(6));
    expect(result.current.rows).toEqual([51, 52, 53, 54, 55]);

    act(() => result.current.nav?.onChangeSize(50));
    expect(result.current.nav?.meta).toEqual({ page: 1, size: 50, total: 55 });
    expect(result.current.rows).toHaveLength(50);
  });

  it('줄이 줄어 지금 쪽이 비면 마지막 쪽을 보인다', () => {
    const { result, rerender } = renderHook(({ count }) => useClientPage(rows(count)), {
      initialProps: { count: 30 },
    });
    act(() => result.current.nav?.onChangePage(3));
    rerender({ count: 15 });

    expect(result.current.nav?.meta.page).toBe(2);
    expect(result.current.rows).toEqual([11, 12, 13, 14, 15]);
  });

  it('정렬은 쪽을 나누기 전에 전체 줄에 건다 — 내림차순이면 첫 쪽에 가장 큰 값', () => {
    const { result } = renderHook(() => useClientPage(rows(25), { n: (row) => row }));
    act(() => result.current.nav?.onChangePage(2));
    act(() => result.current.onSortChange({ key: 'n', direction: 'descending' }));

    expect(result.current.nav?.meta.page).toBe(1);
    expect(result.current.rows).toEqual([25, 24, 23, 22, 21, 20, 19, 18, 17, 16]);
  });
});
