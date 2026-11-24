import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { useScanOpen } from './scan-open';

const scan = { requestId: 7, lotId: 70, key: 1 };

describe('useScanOpen', () => {
  it('고른 의뢰가 스캔보다 늦게 바뀌어도 스캔 열기를 지킨다 — 처음 스캔', () => {
    const { result, rerender } = renderHook(({ id }) => useScanOpen(id), {
      initialProps: { id: null as number | null },
    });
    act(() => result.current.setScanOpen(scan));
    expect(result.current.scanOpen).toEqual(scan);
    rerender({ id: 7 });
    expect(result.current.scanOpen).toEqual(scan);
  });

  it('다른 의뢰로 옮기거나 상세를 닫으면 거둔다', () => {
    const { result, rerender } = renderHook(({ id }) => useScanOpen(id), {
      initialProps: { id: 7 as number | null },
    });
    act(() => result.current.setScanOpen(scan));
    rerender({ id: 8 });
    expect(result.current.scanOpen).toBeNull();

    act(() => result.current.setScanOpen({ ...scan, requestId: 8 }));
    rerender({ id: null });
    expect(result.current.scanOpen).toBeNull();
  });

  it('떠날지 묻는 창에서 「계속 작성」이면 스캔한 다른 의뢰 열기만 거둔다', () => {
    const { result } = renderHook(({ id }) => useScanOpen(id), { initialProps: { id: 3 } });
    act(() => result.current.setScanOpen(scan));
    act(() => result.current.stay());
    expect(result.current.scanOpen).toBeNull();

    act(() => result.current.setScanOpen({ ...scan, requestId: 3 }));
    act(() => result.current.stay());
    expect(result.current.scanOpen).toEqual({ ...scan, requestId: 3 });
  });
});
