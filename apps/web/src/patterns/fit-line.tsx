import { useLayoutEffect, useRef } from 'react';

import { CutHint } from './cut-hint';

/** 글자를 줄여도 읽히는 가장 작은 크기(px). 이보다 줄여야 들어가면 말줄임하고 힌트로 전체를 보인다. */
const MIN_FONT_PX = 10;

/** 칸 폭에 맞는 글자 크기(px). 다 들어가면 `null`(원래 크기). */
export const fitFontPx = (basePx: number, boxWidth: number, textWidth: number): number | null => {
  if (boxWidth <= 0 || textWidth <= boxWidth) return null;
  /* 글 폭은 글자 크기에 비례한다. 반올림으로 한 글자가 넘치지 않게 내림한다(0.1px 단위). */
  const fitted = Math.floor(((basePx * boxWidth) / textWidth) * 10) / 10;
  return Math.max(MIN_FONT_PX, fitted);
};

export interface FitLineProps {
  text: string;
  className?: string;
}

/**
 * 한 줄 맞춤 글(사용자 지시 2026-11-27) — 긴 품목 코드 · 품목명이 칸에서 잘리지 않게, 넘치면 글자를 줄여 한 줄에 다 보인다.
 * 가장 작은 크기로도 넘치면 말줄임하고 커서를 두면 전체 글이 뜬다(`CutHint`). 칸 폭이 바뀌면 다시 맞춘다.
 */
export const FitLine = ({ text, className }: FitLineProps) => {
  const textRef = useRef<HTMLSpanElement>(null);

  useLayoutEffect(() => {
    const element = textRef.current;
    if (element === null) return;
    const fit = (): void => {
      element.style.fontSize = '';
      const basePx = Number.parseFloat(getComputedStyle(element).fontSize);
      const fitted = fitFontPx(basePx, element.clientWidth, element.scrollWidth);
      if (fitted !== null) element.style.fontSize = `${String(fitted)}px`;
    };
    fit();
    if (typeof ResizeObserver === 'undefined') return;
    /* 글자 크기를 바꿔도 상자 폭은 그대로라 되풀이되지 않는다. */
    const observer = new ResizeObserver(fit);
    observer.observe(element);
    return () => observer.disconnect();
  }, [text]);

  return (
    <CutHint text={text} className={className}>
      <span ref={textRef} data-cut-text className="cut-hint-text">
        {text}
      </span>
    </CutHint>
  );
};
