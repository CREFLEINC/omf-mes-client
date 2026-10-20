import { useEffect, useState } from 'react';

/**
 * 상태바가 보이는 **단말 쪽 상태** — 연결 · 전송 대기 · 시계.
 *
 * ⛔ **화면 슬라이스의 같은 이름 파일을 부르지 않는다.** `screens/work-start/connection.ts` 같은
 *    자리는 그 화면이 소유하고, 의존 방향(`routes → screens → patterns`)도 이쪽에서 그쪽을 부를
 *    수 없다. 골격이 읽는 것은 골격이 따로 읽는다.
 */

/**
 * 연결 여부. ⚠ `navigator.onLine` 은 「랜선이 꽂혀 있다」에 가깝다 — 상태바의 표시일 뿐
 * 판정에 쓰지 않는다. 시작·재개를 막는 판정은 각 화면이 서버 응답으로 따로 한다.
 */
export const useIsOnline = (): boolean => {
  const [isOnline, setIsOnline] = useState(() => navigator.onLine);

  useEffect(() => {
    const update = () => {
      setIsOnline(navigator.onLine);
    };

    window.addEventListener('online', update);
    window.addEventListener('offline', update);

    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);

  return isOnline;
};

/** 화면별 전송 대기열이 쓰는 저장소 열쇠의 모양 — `omf-mes.<화면>.outbox`. */
const OUTBOX_KEY = /^omf-mes\.[a-z0-9-]+\.outbox$/u;

/**
 * **모든 화면의 전송 대기 건수 합.**
 *
 * ⭐ **왜 합하는가.** 전송 대기열은 화면마다 따로 있고(투입·실적·검사·중단·비가동 …), 건수는 그
 *    화면에 들어가야만 보였다. 작업자가 실적 화면에 있는 동안 투입 건이 밀려 있어도 알 길이
 *    없었다 — 공유계약 C-1 #4(미전송 건수는 필수 표시)가 화면 «밖»에서는 지켜지지 않았다.
 *
 * ⛔ **읽기만 한다.** 대기열의 주인은 각 화면의 `outbox.ts` 이고, 보내고 지우는 것도 그쪽이다.
 *
 * ⚠ 저장소를 못 읽거나 모양이 깨진 열쇠는 0 으로 센다 — 각 대기열도 같은 경우를 빈 큐로 본다.
 */
export const countPendingOutbox = (storage: Storage): number => {
  let total = 0;

  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index);

    if (key === null || !OUTBOX_KEY.test(key)) continue;

    try {
      const parsed: unknown = JSON.parse(storage.getItem(key) ?? '[]');

      if (Array.isArray(parsed)) total += parsed.length;
    } catch {
      /* 그 대기열이 스스로 버릴 항목이다 — 세지 않는다. */
    }
  }

  return total;
};

/**
 * ⚠ **같은 창의 저장은 `storage` 사건이 오지 않는다** — 대기열은 이 창이 쓰므로 사건으로는
 *   알 수 없어 짧게 다시 센다. 저장소 읽기는 싸고, 2초면 담자마자 건수가 따라온다.
 */
const OUTBOX_POLL_MS = 2_000;

const readPendingOutbox = (): number => {
  try {
    return countPendingOutbox(globalThis.localStorage);
  } catch {
    return 0;
  }
};

export const usePendingOutboxCount = (): number => {
  const [count, setCount] = useState(readPendingOutbox);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setCount(readPendingOutbox());
    }, OUTBOX_POLL_MS);

    return () => {
      window.clearInterval(timer);
    };
  }, []);

  return count;
};

/** 단말 시각 `HH:mm`. 초는 보이지 않는다 — 매초 바뀌는 글자는 눈을 끈다. */
export const clockText = (now: Date): string =>
  `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

/** 분이 바뀔 때마다 다시 그린다. */
export const useMinuteClock = (): Date => {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNow(new Date());
    }, 15_000);

    return () => {
      window.clearInterval(timer);
    };
  }, []);

  return now;
};
