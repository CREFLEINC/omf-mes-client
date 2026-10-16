import { useEffect, useState } from 'react';

/** 가장 가까운 세로 스크롤 영역(셸 `main` 등). 없으면 문서. */
const scrollParentOf = (element: HTMLElement): HTMLElement | null => {
  for (let node = element.parentElement; node !== null; node = node.parentElement) {
    const overflowY = getComputedStyle(node).overflowY;
    if (overflowY === 'auto' || overflowY === 'scroll') return node;
  }

  return null;
};

/**
 * 이 요소 아래로 붙는 여백 — 요소의 아래 바깥 여백, 스크롤 영역까지 감싼 부모들의 아래 안쪽 여백 · 테두리 ·
 * 바깥 여백, 스크롤 영역의 아래 안쪽 여백을 더한다(빈 공간은 세지 않는다 — 그 자리를 채우려는 것이다).
 */
const trailingSpaceOf = (element: HTMLElement, scroller: HTMLElement | null): number => {
  const px = (value: string): number => Number.parseFloat(value) || 0;
  let total = px(getComputedStyle(element).marginBottom);
  for (
    let node = element.parentElement;
    node !== null && node !== scroller;
    node = node.parentElement
  ) {
    const style = getComputedStyle(node);
    total += px(style.paddingBottom) + px(style.borderBottomWidth) + px(style.marginBottom);
    if (node === document.body) break;
  }
  if (scroller !== null) total += px(getComputedStyle(scroller).paddingBottom);

  return total;
};

/**
 * 화면 아래까지 남은 높이(px) — 대시보드 탭의 2 · 3행이 큰 화면에서 하단을 비우지 않게 나눠 갖는다(⭐ 사용자 지정
 * 2026-10-16). 스크롤 영역의 보이는 높이에서 이 요소 위쪽(머리 · 조건 줄 · 탭 · KPI)과 아래쪽(여백) 자리를 뺀다.
 * 고정 px 에 기대지 않고 재서 정한다 — 크기 · 위쪽 내용이 바뀌면 다시 잰다. 잴 수 없으면 `null`.
 */
export const useFillHeight = (element: HTMLElement | null): number | null => {
  const [height, setHeight] = useState<number | null>(null);

  useEffect(() => {
    if (element === null || typeof ResizeObserver === 'undefined') return undefined;
    const scroller = scrollParentOf(element);

    const measure = (): void => {
      const viewTop = scroller === null ? 0 : scroller.getBoundingClientRect().top;
      const scrollTop = scroller === null ? window.scrollY : scroller.scrollTop;
      const visible = scroller === null ? window.innerHeight : scroller.clientHeight;
      const rect = element.getBoundingClientRect();
      const top = rect.top - viewTop + scrollTop;
      setHeight(Math.max(0, Math.floor(visible - top - trailingSpaceOf(element, scroller))));
    };

    const observer = new ResizeObserver(measure);
    observer.observe(element.parentElement ?? element);
    if (scroller !== null) observer.observe(scroller);
    window.addEventListener('resize', measure);
    measure();

    return () => {
      observer.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [element]);

  return height;
};
