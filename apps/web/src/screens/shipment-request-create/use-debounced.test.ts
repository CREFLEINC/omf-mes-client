import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useDebounced } from './use-debounced';

/**
 * ⛔ **글자마다 조회하지 않는다.** 품목 검색칸은 라인마다 서므로, 다섯 줄을 편성하며 치면
 *    타건 수만큼 요청이 나간다 — 목록은 하나뿐인데 서버는 그 수만큼 일한다.
 *
 * ⚠ 시계를 세워 재지 않으면 「기다린다」가 시험에 안 잡힌다 — 디바운스를 통째로 걷어도 화면
 *   시험은 그대로 통과한다(실측).
 */
describe('useDebounced', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('첫 값은 기다리지 않는다 — 처음 그릴 때의 값은 「방금 친 것」이 아니다', () => {
    const { result } = renderHook(() => useDebounced('처음', 300));

    expect(result.current).toBe('처음');
  });

  it('타건이 멎기 전에는 내놓지 않는다', () => {
    const { result, rerender } = renderHook(({ value }) => useDebounced(value, 300), {
      initialProps: { value: 'a' },
    });

    rerender({ value: 'ab' });
    act(() => {
      vi.advanceTimersByTime(299);
    });

    expect(result.current).toBe('a');

    act(() => {
      vi.advanceTimersByTime(1);
    });

    expect(result.current).toBe('ab');
  });

  /* ⛔ 중간 값이 새어 나가면 그 값으로도 요청이 한 번 나간다 — 기다린 뜻이 없어진다. */
  it('중간 값은 건너뛰고 마지막 것만 내놓는다', () => {
    const { result, rerender } = renderHook(({ value }) => useDebounced(value, 300), {
      initialProps: { value: 'a' },
    });

    for (const value of ['ab', 'abc', 'abcd']) {
      rerender({ value });
      act(() => {
        vi.advanceTimersByTime(200);
      });
    }

    expect(result.current).toBe('a');

    act(() => {
      vi.advanceTimersByTime(300);
    });

    expect(result.current).toBe('abcd');
  });
});
