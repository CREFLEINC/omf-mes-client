import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  noteServerAnswered,
  noteServerSilent,
  useOnlineStatus,
  useServerReachable,
} from './online-status';

const setOnline = (value: boolean) => {
  vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(value);
};

beforeEach(() => {
  noteServerAnswered();
});

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

  /* 못 닿는 사정은 online-status.ts 에 적어 두었다. */
  it('망이 붙어 있어도 서버가 답하지 않으면 거짓이다', () => {
    setOnline(true);
    const { result } = renderHook(() => useServerReachable());

    act(() => {
      noteServerSilent();
    });

    expect(result.current).toBe(false);
  });

  it('서버가 다시 답하면 참으로 돌아온다', () => {
    setOnline(true);
    const { result } = renderHook(() => useServerReachable());

    act(() => {
      noteServerSilent();
    });
    act(() => {
      noteServerAnswered();
    });

    expect(result.current).toBe(true);
  });

  /*
   * 기동 직후는 참이다. 아직 아무것도 안 보냈으니 못 닿는다고 단정할 근거가 없고, 첫 조회가
   * 곧 답을 준다. 거짓으로 두면 멀쩡한 단말이 켜질 때마다 오프라인을 보인다.
   *
   * 공용 설정이 회차마다 참으로 되돌리므로 그 값을 그대로 재면 이 갈래가 가려진다 - 모듈을
   * 새로 읽어 아무도 손대지 않은 초깃값을 본다.
   */
  it('아무것도 보내기 전에는 참이다', async () => {
    setOnline(true);
    vi.resetModules();

    const fresh = await import('./online-status');
    const { result } = renderHook(() => fresh.useServerReachable());

    expect(result.current).toBe(true);
  });

  /* 다시 붙었다는 기기 신호는 앞서 못 닿았던 기억을 지운다. 다음 요청이 정정한다. */
  it('망이 다시 붙으면 못 닿았던 기억을 지운다', () => {
    setOnline(true);
    const { result } = renderHook(() => useServerReachable());

    act(() => {
      noteServerSilent();
    });
    expect(result.current).toBe(false);

    act(() => {
      window.dispatchEvent(new Event('online'));
    });

    expect(result.current).toBe(true);
  });
});
