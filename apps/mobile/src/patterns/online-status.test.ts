import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { useOnlineStatus } from './online-status';

const setOnline = (value: boolean) => {
  vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(value);
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe('연결 상태', () => {
  it('기기가 연결돼 있으면 참이다', () => {
    setOnline(true);

    const { result } = renderHook(() => useOnlineStatus());

    expect(result.current).toBe(true);
  });

  it('끊기면 거짓으로 바뀐다', () => {
    setOnline(true);
    const { result } = renderHook(() => useOnlineStatus());

    setOnline(false);
    act(() => {
      window.dispatchEvent(new Event('offline'));
    });

    expect(result.current).toBe(false);
  });

  it('다시 붙으면 참으로 돌아온다', () => {
    setOnline(false);
    const { result } = renderHook(() => useOnlineStatus());

    setOnline(true);
    act(() => {
      window.dispatchEvent(new Event('online'));
    });

    expect(result.current).toBe(true);
  });
});
