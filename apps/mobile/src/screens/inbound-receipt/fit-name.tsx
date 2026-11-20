import { useLayoutEffect, useRef } from 'react';

import { Words } from './words';

/** 낱말 조각이 놓인 줄 수 — 조각마다 윗변이 다르면 다른 줄이다. */
const linesOf = (box: HTMLElement): number =>
  new Set([...box.querySelectorAll<HTMLElement>('.receive-word')].map((word) => word.offsetTop))
    .size;

/** 한 줄 칸(nowrap)이 넘치는가. */
const overflows = (box: HTMLElement): boolean => box.scrollWidth > box.clientWidth;

/**
 * 품목명 — `lines` 줄을 넘으면 글자를 1px 씩 줄여 맞춘다(사용자 지시 2026-11-20). 폭이 바뀌면(기기를 돌리면) 다시 잰다.
 * - 두 줄(방금 찍은 칸): `min` 까지 줄여도 넘치면 그 크기로 세 줄이 된다 - 자르지 않는다.
 * - 한 줄(표의 행): 「줄여서라도 한 줄로」 - `min` 까지 줄여도 넘칠 때만 CSS 말줄임이 끝을 줄인다. 전체 이름은 품목 시트에 있다.
 */
export const FitName = ({
  text,
  min,
  lines = 2,
  className,
}: {
  text: string;
  min: number;
  lines?: 1 | 2;
  className?: string;
}) => {
  const ref = useRef<HTMLSpanElement>(null);

  useLayoutEffect(() => {
    const box = ref.current;

    if (box === null) return;

    const fit = () => {
      box.style.fontSize = '';
      let size = parseFloat(getComputedStyle(box).fontSize);

      const tooLong = () => (lines === 1 ? overflows(box) : linesOf(box) > 2);

      while (tooLong() && size > min) {
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
  }, [text, min, lines]);

  return (
    <span ref={ref} className={className}>
      <Words text={text} />
    </span>
  );
};
