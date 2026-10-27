import type { Column } from '@crefle/web-ui';
import { useLayoutEffect, useRef, useState } from 'react';

/** 폭을 정하지 않은(남는 폭을 흡수하는) 열이 지킬 폭. */
const FLEX_MIN = 120;
/** 줄여도 이보다 좁아지지 않는다(`column-resize.tsx` 의 최소 폭과 같다). */
const COLUMN_MIN = 40;

const pxOf = (width: string | undefined): number | null =>
  width?.endsWith('px') === true ? Number.parseFloat(width) : null;

/**
 * 표가 감싼 상자 폭을 넘지 않게 한다(사용자 지시 2026-10-26 · omf-all-around#185 — 반응형).
 * 정해 둔 열 폭(끌어 바꾼 폭 포함)의 비율대로 상자 폭을 나눈다 — 합이 상자보다 크면 줄이고, 작으면 늘린다.
 * 저장된 폭은 그대로라 창이 다시 넓어지면 원래 폭으로 돌아간다. 창 · 구획 크기가 바뀔 때마다 다시 잰다.
 */
export const useFitColumns = <T,>(
  columns: Column<T>[],
  /** 넘칠 때 줄이지 않고 표 안에서 가로로 구른다(좌우 배치 · 사용자 지시 2026-10-26). 모자랄 때 늘리는 것은 같다. */
  {
    scrollX = false,
    reserve = 0,
  }: {
    scrollX?: boolean;
    /** 열 목록 밖에서 표가 따로 쓰는 폭(px) — 선택 체크칸 등. 상자 폭에서 빼고 맞춘다(#185). */
    reserve?: number;
  } = {},
) => {
  const ref = useRef<HTMLDivElement>(null);
  const [available, setAvailable] = useState<number | null>(null);

  useLayoutEffect(() => {
    const element = ref.current;
    if (element === null) return;
    const measure = (): void => setAvailable(element.clientWidth - reserve);
    measure();
    /* 시험 환경(jsdom)에는 `ResizeObserver` 가 없다 — 없으면 창 크기 변화만 따른다. */
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
    observer?.observe(element);
    window.addEventListener('resize', measure);
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [reserve]);

  const fixed = columns.map((column) => pxOf(column.width));
  const fixedSum = fixed.reduce<number>((sum, width) => sum + (width ?? 0), 0);
  const flexNeed = fixed.filter((width) => width === null).length * FLEX_MIN;
  /*
   * 모든 열이 폭을 가지면(남는 폭을 흡수하는 열이 없으면) 상자 폭에 맞춰 늘리고 줄인다 — 끈 열은 그만큼 몫이 커진다.
   * 흡수하는 열이 있으면 넘칠 때만 줄인다(남는 폭은 그 열이 가진다).
   */
  const fitted =
    available === null || available <= 0 || fixedSum === 0
      ? 1
      : flexNeed === 0
        ? available / fixedSum
        : fixedSum + flexNeed <= available
          ? 1
          : Math.max(0, (available - flexNeed) / fixedSum);
  const scale = scrollX ? Math.max(1, fitted) : fitted;

  return {
    ref,
    columns:
      scale === 1
        ? columns
        : columns.map((column, index) => {
            const width = fixed[index];
            return width === null || width === undefined
              ? column
              : {
                  ...column,
                  width: `${String(Math.max(COLUMN_MIN, Math.floor(width * scale)))}px`,
                };
          }),
  };
};
