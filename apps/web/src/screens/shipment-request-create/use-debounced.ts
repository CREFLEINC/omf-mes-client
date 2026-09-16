import { useEffect, useState } from 'react';

/**
 * 타건이 멎은 뒤에야 값을 내놓는다.
 *
 * ⛔ **글자마다 조회하지 않는다.** 품목 검색칸은 **라인마다** 서므로, 다섯 줄을 편성하며 치면
 *    타건 수만큼 요청이 나간다 — 목록은 하나뿐인데 서버는 그 수만큼 일한다.
 *
 * ⚠ **값이 바뀔 때마다 시계를 다시 건다.** 그래서 마지막 타건에서 `delay` 만큼 기다린 뒤 한
 *   번만 내놓는다. 벗어날 때 시계를 거두지 않으면 사라진 화면의 상태를 건드린다.
 *
 * ⭐ **첫 값은 기다리지 않는다** — 처음 그릴 때의 값은 「방금 친 것」이 아니다.
 *
 * 이 화면 슬라이스가 소유한다 — 다른 화면 슬라이스의 같은 이름 파일을 참조하지 않는다.
 */
export const useDebounced = <T>(value: T, delay: number): T => {
  const [settled, setSettled] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => {
      setSettled(value);
    }, delay);

    return () => {
      clearTimeout(timer);
    };
  }, [delay, value]);

  return settled;
};
