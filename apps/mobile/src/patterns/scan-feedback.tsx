import { Haptics, NotificationType } from '@capacitor/haptics';
import { useEffect, useState } from 'react';

import './scan-feedback.css';

/**
 * 스캔·저장 결과를 귀와 손과 눈으로 알린다.
 *
 * 단말을 허리에 차고 장갑을 낀 채 읽는 작업이라 작업자는 화면을 보고 있지 않을 수 있다.
 * 전에는 실패음 하나뿐이어서, 소리가 안 나면 «됐다»인지 «소리를 못 들었다»인지 가를 수 없었다.
 *
 * 단말 스캐너가 내는 소리·진동은 «읽혔다»는 뜻일 뿐이다. 읽은 값을 받아들였는지는 앱만 안다 -
 * 이 신호가 그 판정을 말한다.
 *
 * - confirm 받아들였다: 높은 음 두 번 · 짧은 진동 · 초록 테두리
 * - warn 받았지만 확인할 것이 있다: 가운데 음 한 번 · 진동 (테두리는 없다)
 * - reject 받지 않았다: 낮은 음(공유계약 D-2) · 긴 진동 · 빨간 테두리
 */
export type ScanSignal = 'confirm' | 'warn' | 'reject';

interface Beep {
  hz: number;
  /** 시작 시각(초). 앞 음과의 간격을 여기서 준다. */
  at: number;
  sec: number;
}

const GAIN = 0.2;

const TONES: Record<ScanSignal, Beep[]> = {
  confirm: [
    { hz: 1320, at: 0, sec: 0.06 },
    { hz: 1320, at: 0.1, sec: 0.06 },
  ],
  warn: [{ hz: 660, at: 0, sec: 0.12 }],
  /* 공유계약 D-2 의 오류음. 바꾸면 현장이 익힌 소리가 달라진다. */
  reject: [{ hz: 220, at: 0, sec: 0.18 }],
};

const HAPTICS: Record<ScanSignal, NotificationType> = {
  confirm: NotificationType.Success,
  warn: NotificationType.Warning,
  reject: NotificationType.Error,
};

type AudioContextCtor = typeof AudioContext;

const resolveAudioContext = (): AudioContextCtor | undefined =>
  (window as unknown as { AudioContext?: AudioContextCtor; webkitAudioContext?: AudioContextCtor })
    .AudioContext ??
  (window as unknown as { webkitAudioContext?: AudioContextCtor }).webkitAudioContext;

const playTone = (beeps: Beep[]): void => {
  const Ctor = resolveAudioContext();

  if (Ctor === undefined) {
    return;
  }

  try {
    const context = new Ctor();
    const gain = context.createGain();
    gain.gain.value = GAIN;
    gain.connect(context.destination);

    beeps.forEach((beep, index) => {
      const oscillator = context.createOscillator();
      oscillator.frequency.value = beep.hz;
      oscillator.connect(gain);
      oscillator.start(context.currentTime + beep.at);
      oscillator.stop(context.currentTime + beep.at + beep.sec);

      if (index === beeps.length - 1) {
        oscillator.onended = () => {
          void context.close();
        };
      }
    });
  } catch {
    return;
  }
};

const vibrate = (signal: ScanSignal): void => {
  /* 진동이 없는 단말·브라우저에서 플러그인이 거부한다. 소리와 화면 표시는 그대로 간다. */
  try {
    void Haptics.notification({ type: HAPTICS[signal] }).catch(() => undefined);
  } catch {
    return;
  }
};

type FlashListener = (signal: ScanSignal) => void;

const flashListeners = new Set<FlashListener>();

/**
 * 결과를 알린다. 소리·진동·화면 테두리를 한꺼번에 낸다.
 *
 * 어느 것도 던지지 않는다 - 부르는 쪽은 이미 화면에 결과 문구를 냈고, 여기서 예외가 오르면
 * 그 문구까지 함께 끊긴다.
 */
export const signal = (kind: ScanSignal): void => {
  playTone(TONES[kind]);
  vibrate(kind);

  for (const listener of flashListeners) {
    listener(kind);
  }
};

/** 테두리가 머무는 시간(ms). 실패는 놓치면 안 되므로 더 오래 둔다. */
const FLASH_MS: Record<ScanSignal, number> = { confirm: 400, warn: 0, reject: 700 };

/**
 * 화면 가장자리를 잠깐 물들인다. 셸이 한 번 띄운다.
 *
 * 누름을 막지 않는다 - 테두리가 떠 있는 동안 다음 라벨을 읽거나 단추를 누를 수 있어야 한다.
 */
export const ScanFlashHost = () => {
  const [flash, setFlash] = useState<{ kind: ScanSignal; id: number } | null>(null);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;

    const listener: FlashListener = (kind) => {
      if (FLASH_MS[kind] === 0) {
        return;
      }

      clearTimeout(timer);
      /* 같은 결과가 잇달아 와도 다시 번쩍여야 한다 - 식별값을 바꿔 새로 그린다. */
      setFlash((current) => ({ kind, id: (current?.id ?? 0) + 1 }));
      timer = setTimeout(() => {
        setFlash(null);
      }, FLASH_MS[kind]);
    };

    flashListeners.add(listener);

    return () => {
      clearTimeout(timer);
      flashListeners.delete(listener);
    };
  }, []);

  if (flash === null) {
    return null;
  }

  return (
    <div
      key={flash.id}
      className={`scan-flash scan-flash--${flash.kind}`}
      data-signal={flash.kind}
      aria-hidden="true"
    />
  );
};
