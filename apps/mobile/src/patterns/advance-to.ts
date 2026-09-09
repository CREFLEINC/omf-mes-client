import { useEffect, useRef, type RefObject } from 'react';

/**
 * 한 구획이 끝나면 다음 구획을 화면 안으로 들인다.
 *
 * 세로 화면이라 위에서 아래로 채우는데, 다 채운 구획이 화면을 차지한 채 남으면 다음에 무엇을
 * 할지가 접힌 자리에 있다. 사람이 스크롤로 찾아야 하고, 한 손은 스캐너를 들고 있다.
 */
export const useAdvanceTo = (active: boolean, target: RefObject<HTMLElement | null>): void => {
  const wasActive = useRef(false);

  useEffect(() => {
    if (!active) {
      wasActive.current = false;
      return;
    }

    /* 열려 있는 동안 다시 그릴 때마다 끌어오면 사람이 올려 본 자리가 도로 내려간다. */
    if (wasActive.current) {
      return;
    }

    wasActive.current = true;

    const node = target.current;

    /* 이 기능이 없는 환경에서 던지면 화면이 통째로 멈춘다. 스크롤은 있으면 좋은 것이다. */
    if (node === null || typeof node.scrollIntoView !== 'function') {
      return;
    }

    /* 움직임을 줄여 달라는 설정을 존중한다. 그 물음을 못 받는 환경도 있다. */
    const reduced =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    node.scrollIntoView({ block: 'start', behavior: reduced ? 'auto' : 'smooth' });
  }, [active, target]);
};
