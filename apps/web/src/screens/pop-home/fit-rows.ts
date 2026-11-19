import { useCallback, useLayoutEffect, useRef, useState, type RefObject } from 'react';

/** 쪽 넘김을 아직 그리지 않았을 때 잡는 높이(`.pu-pager` 의 작은 버튼 줄). 그린 뒤에는 잰 값을 쓴다. */
const PAGER_FALLBACK_PX = 40;

export interface FitRows {
  /** 쪽 넘김 없이 칸에 다 들어가는 줄 수. */
  all: number;
  /** 아래에 쪽 넘김을 둘 때 들어가는 줄 수. 0 이면 쪽 넘김을 둘 자리가 없다. */
  paged: number;
}

/**
 * 홈 목록 칸(줄 + 아래 쪽 넘김이 한 칸)에 들어가는 줄 수 — 쪽 넘김이 «있을 때»와 «없을 때»를 따로 잰다.
 *
 * 공통 `useFitCount` 는 줄 수만 주므로, 쪽 넘김 자리로 줄 하나를 통째로 내주면 쪽 넘김(≈40px)보다 큰 줄(58px)을
 * 비워 한 줄이 덜 보였다(사용자 지시 2026-11-19 「W/O가 1건은 더 보일 수 있을 거 같아」). 여기서는 칸 높이 ·
 * 줄 높이 · 간격 · 쪽 넘김 높이로 바로 센다. 줄이 아직 없으면 `fallback`.
 */
export const useFitRows = (
  ref: RefObject<HTMLElement | null>,
  { fallback = 3, rowSelector }: { fallback?: number; rowSelector: string },
): FitRows => {
  const [fit, setFit] = useState<FitRows>({ all: fallback, paged: fallback });
  const pagerHeight = useRef(PAGER_FALLBACK_PX);

  const measure = useCallback(() => {
    const box = ref.current;
    if (box === null) return;
    const height = box.clientHeight;
    if (height <= 0) return;
    const rows = Array.from(box.querySelectorAll<HTMLElement>(rowSelector)).filter(
      (row) => row.offsetHeight > 0,
    );
    if (rows.length === 0) return;
    const rowHeight = Math.max(...rows.map((row) => row.offsetHeight));
    const gap = Number.parseFloat(getComputedStyle(box).rowGap) || 0;
    const pager = box.querySelector<HTMLElement>('.pu-pager');
    if (pager !== null && pager.offsetHeight > 0) pagerHeight.current = pager.offsetHeight;
    const all = Math.max(1, Math.floor((height + gap) / (rowHeight + gap)));
    const paged = Math.max(0, Math.floor((height - pagerHeight.current) / (rowHeight + gap)));
    setFit((prev) => (prev.all === all && prev.paged === paged ? prev : { all, paged }));
  }, [ref, rowSelector]);

  useLayoutEffect(() => {
    measure();
  });

  useLayoutEffect(() => {
    const box = ref.current;
    if (box === null || typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(() => {
      measure();
    });
    observer.observe(box);
    return () => {
      observer.disconnect();
    };
  }, [ref, measure]);

  return fit;
};
