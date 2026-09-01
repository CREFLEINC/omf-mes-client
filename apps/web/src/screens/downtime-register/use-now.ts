import { useEffect, useState } from 'react';

/**
 * 지금. **분이 바뀔 때마다 다시 그리기 위한 것**이다.
 *
 * 진행 중 비가동의 「n분 진행 중」은 저장된 값이 아니라 화면이 매 순간 세는 값이다(스펙 §5-3).
 * 세지 않으면 처음 그린 숫자가 그대로 굳어, 한 시간 뒤에도 「1분 진행 중」이라고 말한다.
 *
 * ⚠ **초 단위로 돌리지 않는다.** 화면이 보이는 단위가 분이라 더 자주 깨워 봐야 같은 글자를
 * 다시 그릴 뿐이고, 단말은 하루 종일 켜져 있다.
 */
const TICK_MS = 30_000;

export const useNow = (enabled: boolean): Date => {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    if (!enabled) return;

    const timer = globalThis.setInterval(() => {
      setNow(new Date());
    }, TICK_MS);

    return () => {
      globalThis.clearInterval(timer);
    };
  }, [enabled]);

  return now;
};
