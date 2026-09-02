import { useEffect, useState } from 'react';

/**
 * 화면이 아는 「지금」. **시간이 흐르는 것을 화면에 앉히는 자리**다.
 *
 * 세 곳이 이 값을 읽는다 — 진행 중 구간의 경과 시간 · 미래 시각 판정 · 오늘이 며칠인가.
 * 세지 않으면 처음 그린 값이 그대로 굳는다.
 *
 * ⛔ **조건을 걸어 멈추지 않는다.** 「진행 중이 있을 때만」처럼 좁히면, 정작 그 조건이 아닐 때
 * 시계가 서 버린다 — 실측으로 겪었다: 진행 중이 없을 때만 저장이 열리는데 바로 그때 시계가
 * 멈춰, 화면을 몇 분 열어 둔 뒤 `[지금]`으로 찍은 시각이 **자기 화면의 멈춘 시계보다 미래**가
 * 되어 저장이 거부됐다. 자정을 넘기면 「오늘」도 전날에 머문다.
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
