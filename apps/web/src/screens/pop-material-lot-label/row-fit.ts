import { useLayoutEffect, useState, type RefObject } from 'react';

/**
 * 표 한 줄의 높이(px) — `pop.css` 의 `.pop-mlot-row` 높이와 같은 값이다. 고치면 함께 고친다.
 *
 * ⚠ E-3(POP 관리웹 기본 밀도 · 40px)보다 크다 — 개편안이 손가락으로 누르는 줄을 56px 로 정했고 사용자가
 *   승인했다(2026-10-24 · omf-all-around#184). 이 화면 안에서만 쓴다.
 */
export const ROW_HEIGHT = 56;

/** 높이를 아직 모를 때(첫 그림 · 시험 환경)의 쪽 크기 — 설계 기준 1024×768 에서 들어가는 수다. */
export const FALLBACK_ROWS = 8;

/** 이 높이에 잘리지 않고 들어가는 줄 수 — 하나 아래로는 내려가지 않는다. */
export const rowsThatFit = (height: number, rowHeight = ROW_HEIGHT): number =>
  height <= 0 ? FALLBACK_ROWS : Math.max(1, Math.floor(height / rowHeight));

/**
 * 표 칸이 지금 몇 줄을 담는가 — **화면 높이가 쪽 크기를 정한다.**
 *
 * ⭐ 옛 화면은 한 쪽 8줄로 못박아 1920×1080 에서는 목록 아래가 비고, 1024×768 에서는 3줄이 가려졌다
 *    (실측 2026-10-24). 칸을 재서 들어가는 만큼만 한 쪽에 둔다 — 잘리는 줄은 다음 쪽이다(사용자 지시
 *    2026-09-19 — 목록에 스크롤을 두지 않는다).
 * ⚠ `clientHeight` 로 잰다 — 단말 크기 맞춤(`pop-fit` 의 `zoom`)이 걸려도 줄 높이와 같은 단위다.
 */
export const useRowsThatFit = (ref: RefObject<HTMLElement | null>): number => {
  const [rows, setRows] = useState(FALLBACK_ROWS);

  useLayoutEffect(() => {
    const element = ref.current;

    if (element === null) return;

    const apply = (): void => {
      setRows(rowsThatFit(element.clientHeight));
    };

    apply();

    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(apply);
    observer?.observe(element);

    return () => {
      observer?.disconnect();
    };
  }, [ref]);

  return rows;
};
