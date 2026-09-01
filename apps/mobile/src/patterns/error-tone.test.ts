import { afterEach, describe, expect, it, vi } from 'vitest';

import { playErrorTone } from './error-tone';

const withAudioContext = (value: unknown) => {
  Object.defineProperty(window, 'AudioContext', {
    value,
    configurable: true,
    writable: true,
  });
};

afterEach(() => {
  Reflect.deleteProperty(window, 'AudioContext');
  vi.restoreAllMocks();
});

describe('스캔 오류음', () => {
  it('소리를 낼 수 없는 환경에서도 던지지 않는다', () => {
    expect(() => {
      playErrorTone();
    }).not.toThrow();
  });

  it('만들다 실패해도 던지지 않는다', () => {
    withAudioContext(
      class {
        constructor() {
          throw new Error('사용자 제스처가 없습니다');
        }
      },
    );

    expect(() => {
      playErrorTone();
    }).not.toThrow();
  });

  it('울리고 스스로 멎는다', () => {
    const stop = vi.fn();
    const start = vi.fn();
    const oscillator = {
      frequency: { value: 0 },
      connect: vi.fn(),
      start,
      stop,
      onended: null,
    };
    withAudioContext(
      class {
        currentTime = 0;
        destination = {};
        createOscillator = () => oscillator;
        createGain = () => ({ gain: { value: 0 }, connect: vi.fn() });
        close = vi.fn();
      },
    );

    playErrorTone();

    expect(start).toHaveBeenCalled();
    expect(stop).toHaveBeenCalled();
  });
});
