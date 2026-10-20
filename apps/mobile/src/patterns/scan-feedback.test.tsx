import { act, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const haptics = vi.hoisted(() => ({ notification: vi.fn(() => Promise.resolve()) }));

vi.mock('@capacitor/haptics', () => ({
  Haptics: haptics,
  NotificationType: { Success: 'SUCCESS', Warning: 'WARNING', Error: 'ERROR' },
}));

import { ScanFlashHost, signal } from './scan-feedback';

interface FakeOscillator {
  frequency: { value: number };
  connect: () => void;
  start: (at: number) => void;
  stop: (at: number) => void;
  onended: (() => void) | null;
}

/* 울린 음의 높이를 차례대로 모은다. */
const withAudioContext = () => {
  const played: number[] = [];

  Object.defineProperty(window, 'AudioContext', {
    configurable: true,
    writable: true,
    value: class {
      currentTime = 0;
      destination = {};
      createGain = () => ({ gain: { value: 0 }, connect: vi.fn() });
      createOscillator = (): FakeOscillator => {
        const oscillator: FakeOscillator = {
          frequency: { value: 0 },
          connect: vi.fn(),
          start: () => {
            played.push(oscillator.frequency.value);
          },
          stop: vi.fn(),
          onended: null,
        };
        return oscillator;
      };
      close = vi.fn();
    },
  });

  return played;
};

beforeEach(() => {
  haptics.notification.mockClear();
});

afterEach(() => {
  Reflect.deleteProperty(window, 'AudioContext');
  vi.useRealTimers();
});

describe('스캔 결과 신호', () => {
  /* 성공과 실패가 같은 소리면 화면을 보지 않는 작업자는 둘을 가르지 못한다. */
  it('받아들이면 높은 음 두 번, 거절하면 낮은 음 한 번을 낸다', () => {
    const played = withAudioContext();

    signal('confirm');
    expect(played).toEqual([1320, 1320]);

    played.length = 0;
    signal('reject');
    expect(played).toEqual([220]);
  });

  it('결과에 맞는 진동을 낸다', () => {
    signal('confirm');
    signal('reject');

    expect(haptics.notification.mock.calls).toEqual([[{ type: 'SUCCESS' }], [{ type: 'ERROR' }]]);
  });

  /* 진동이 없는 기기에서 던지면 화면에 이미 낸 결과 문구까지 끊긴다. */
  it('진동을 낼 수 없어도 던지지 않는다', () => {
    haptics.notification.mockImplementationOnce(() => {
      throw new Error('unavailable');
    });

    expect(() => {
      signal('reject');
    }).not.toThrow();
  });

  it('화면 가장자리를 잠깐 물들였다가 거둔다', () => {
    vi.useFakeTimers();
    const { container } = render(<ScanFlashHost />);

    act(() => {
      signal('reject');
    });
    expect(container.querySelector('[data-signal="reject"]')).not.toBeNull();

    act(() => {
      vi.advanceTimersByTime(700);
    });
    expect(container.querySelector('[data-signal]')).toBeNull();
  });

  /* 확인할 것이 있다는 신호는 소리·진동만 낸다. 테두리까지 내면 성공·실패와 섞여 읽힌다. */
  it('주의 신호는 테두리를 내지 않는다', () => {
    const { container } = render(<ScanFlashHost />);

    act(() => {
      signal('warn');
    });

    expect(container.querySelector('[data-signal]')).toBeNull();
  });
});
