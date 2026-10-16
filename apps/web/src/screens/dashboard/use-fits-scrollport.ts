import { useEffect, useState, type RefObject } from 'react';

/** 가장 가까운 세로 스크롤 영역(관리웹 셸의 `main`). 없으면 `null` — 그때는 창 높이로 잰다. */
const scrollParentOf = (element: HTMLElement): HTMLElement | null => {
  for (let node = element.parentElement; node !== null; node = node.parentElement) {
    if (/(auto|scroll)/.test(getComputedStyle(node).overflowY)) return node;
  }

  return null;
};

/**
 * 요소가 스크롤 영역 높이 안에 들어가는가 — 대시보드 오른쪽 열을 위에 붙일지(sticky) 고른다.
 * 열이 화면보다 길 때 붙이면 그 아래가 왼쪽 패널 끝까지 보이지 않는다. 자동 갱신으로 열 높이가 바뀌거나
 * 창 크기가 바뀌면 다시 잰다. 크기 관찰을 못 하는 환경(테스트의 jsdom)에서는 붙이지 않는다.
 *
 * `margin` — 위 · 아래로 남겨 둘 여백(px).
 */
export const useFitsScrollport = (ref: RefObject<HTMLElement | null>, margin = 32): boolean => {
  const [fits, setFits] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (element === null || typeof ResizeObserver === 'undefined') return undefined;

    const scroller = scrollParentOf(element);
    const check = (): void => {
      const available = scroller?.clientHeight ?? window.innerHeight;
      setFits(element.offsetHeight + margin <= available);
    };
    const observer = new ResizeObserver(check);
    observer.observe(element);
    if (scroller !== null) observer.observe(scroller);
    window.addEventListener('resize', check);
    check();

    return () => {
      observer.disconnect();
      window.removeEventListener('resize', check);
    };
  }, [ref, margin]);

  return fits;
};
