import { useEffect, useState } from 'react';

/**
 * 화면이 아는 「지금」. **시간이 흐르는 것을 화면에 앉히는 자리**다.
 *
 * 이 화면에서 이 값을 읽는 곳은 하나다 — 세션의 경과 시간(스펙 §3). 세지 않으면 처음 그린
 * 값이 그대로 굳어, 여섯 시간 뒤에도 「6분」이라 적혀 있다.
 *
 * ⛔ **조건을 걸어 멈추지 않는다.** 「세션이 있을 때만」처럼 좁히면 그 조건이 바뀌는 순간
 * 시계가 서 있던 자리에서 다시 출발한다.
 *
 * ⚠ **초 단위로 돌리지 않는다.** 화면이 보이는 단위가 분이라 더 자주 깨워 봐야 같은 글자를
 * 다시 그릴 뿐이고, 단말은 하루 종일 켜져 있다.
 */
export const TICK_MS = 30_000;

export const useNow = (): Date => {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = globalThis.setInterval(() => {
      setNow(new Date());
    }, TICK_MS);

    return () => {
      globalThis.clearInterval(timer);
    };
    /* 의존성이 비어 있는 것은 의도다 — 이 시계는 화면이 사는 동안 한 벌만 있으면 된다. */
  }, []);

  return now;
};
