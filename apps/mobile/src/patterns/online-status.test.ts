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

  /*
   * 기기가 망에 붙어 있어도 우리 서버에는 못 닿을 수 있다 - 방화벽, 평문 차단, 주소
   * 오설정, 서버 정지. 실측으로 겪었다: WiFi 는 검증된 채였고 기기 셸에서는 서버가 401 을
   * 주는데 앱의 요청만 OS 가 막아, 한 건도 못 가는 동안 배너는 계속 온라인이었다.
   */
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
   * 답이 오기만 하면 온라인이다. 401 도 500 도 서버가 받았다는 뜻이고, 그것을 오프라인으로
   * 보이면 작업자가 망을 고치러 간다 - 고칠 것은 망이 아니다.
   */
  it('오류 응답도 답이므로 온라인이다', () => {
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
