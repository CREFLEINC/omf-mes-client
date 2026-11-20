import { useLayoutEffect, useRef } from 'react';

import { Words } from './words';

/** 낱말 조각이 놓인 줄 수 — 조각마다 윗변이 다르면 다른 줄이다. */
const linesOf = (box: HTMLElement): number =>
  new Set([...box.querySelectorAll<HTMLElement>('.receive-word')].map((word) => word.offsetTop)).size;

/**
 * 품목명 — 두 줄을 넘으면 글자를 1px 씩 줄여 두 줄에 맞춘다(사용자 지시 2026-11-20). 자르지는 않는다 - `min` 까지
 * 줄여도 넘치면 그 크기로 세 줄이 된다(「코드 · 이름은 잘리지 않게」가 먼저다). 폭이 바뀌면(기기를 돌리면) 다시 잰다.
 */
export const FitName = ({ text, min, className }: { text: string; min: number; className?: string }) => {
  const ref = useRef<HTMLSpanElement>(null);

  useLayoutEffect(() => {
    const box = ref.current;

    if (box === null) return;

    const fit = () => {
      box.style.fontSize = '';
      let size = parseFloat(getComputedStyle(box).fontSize);

      while (linesOf(box) > 2 && size > min) {
        size -= 1;
        box.style.fontSize = `${String(size)}px`;
      }
    };

    fit();

    if (typeof ResizeObserver === 'undefined' || box.parentElement === null) return;

    let width = box.parentElement.clientWidth;
    const observer = new ResizeObserver(([entry]) => {
      if (entry === undefined || entry.contentRect.width === width) return;
      width = entry.contentRect.width;
      fit();
    });
    observer.observe(box.parentElement);

    return () => {
      observer.disconnect();
    };
  }, [text, min]);

  return (
    <span ref={ref} className={className}>
      <Words text={text} />
    </span>
  );
};
