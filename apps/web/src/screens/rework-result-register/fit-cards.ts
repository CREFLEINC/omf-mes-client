import { useCallback, useLayoutEffect, useRef, useState, type RefObject } from 'react';

/** 카드 높이(px). 고른 카드(`expanded`)는 줄이 셋 더 붙고, 배포 전 카드(`planned`)는 「상태」 줄이 하나 더 붙는다. */
export interface CardHeights {
  compact: number;
  expanded: number;
  planned: number;
}

/**
 * 목록 한 쪽 건수 — **실제로 생길 쪽마다** 높이를 더해 모두 들어가는 가장 큰 수(사용자 지시 2026-11-19
 * 「아래에 항목 하나 더 보일 수 있을 거 같은데」).
 *
 * ⭐ 고정 규칙: 배포된 줄이 있는 쪽은 **늘 한 장을 고른 카드 높이로 잡는다**. 고르기 전·후, 어느 줄을
 *    고르든 건수가 같아 쪽 번호가 튀지 않는다. 나머지는 접힌 카드, 배포 전 줄은 그 카드 높이로 센다.
 *    (공통 `useFitCount` 는 가장 큰 카드로 모든 줄을 재서, 고른 카드 하나 때문에 한 장이 덜 보였다.)
 */
export const fitPageSize = ({
  height,
  gap,
  cards,
  releasedTotal,
  plannedTotal,
  max = 50,
}: {
  height: number;
  gap: number;
  cards: CardHeights;
  releasedTotal: number;
  plannedTotal: number;
  max?: number;
}): number => {
  const fits = (size: number): boolean => {
    /* 데이터가 적어도 «꽉 찬 쪽»이 들어가는 만큼만 — 줄이 늘어도 넘치지 않는다. */
    if (cards.expanded + (size - 1) * (cards.compact + gap) > height) return false;
    let released = releasedTotal;
    let planned = plannedTotal;
    /* 마지막 쪽까지 — 배포된 줄이 먼저, 그 뒤를 배포 전 줄이 잇는다(화면의 쪽 나누기와 같다). */
    do {
      const r = Math.min(size, released);
      const p = Math.min(size - r, planned);
      const count = r + p;
      const used =
        (r > 0 ? cards.expanded + (r - 1) * cards.compact : 0) +
        p * cards.planned +
        Math.max(0, count - 1) * gap;
      if (used > height) return false;
      released -= r;
      planned -= p;
    } while (released > 0 || planned > 0);
    return true;
  };

  let size = 1;
  while (size < max && fits(size + 1)) size += 1;
  return size;
};

/**
 * `ref` 목록 칸에 맞는 한 쪽 건수. 카드 높이는 보이는 카드에서 재고, 아직 없는 모양은 글 줄 높이로 어림한다
 * (고른 카드 = 접힌 카드 + 세 줄, 배포 전 카드 = 접힌 카드 + 한 줄). 고른 카드는 잰 값과 어림값 중 큰 쪽.
 */
export const useFitCardCount = (
  ref: RefObject<HTMLElement | null>,
  totals: { releasedTotal: number; plannedTotal: number },
  { fallback = 4 }: { fallback?: number } = {},
): number => {
  const [count, setCount] = useState(fallback);
  const known = useRef<Partial<CardHeights>>({});
  const totalsRef = useRef(totals);
  totalsRef.current = totals;

  const measure = useCallback(() => {
    const box = ref.current;
    if (box === null) return;
    const height = box.clientHeight;
    if (height <= 0) return;
    const heightOf = (selector: string): number | undefined => {
      const el = box.querySelector<HTMLElement>(selector);
      return el !== null && el.offsetHeight > 0 ? el.offsetHeight : undefined;
    };
    const line = box.querySelector<HTMLElement>('.rwu-sub > span');
    const sub = box.querySelector<HTMLElement>('.rwu-sub');
    if (line === null || sub === null) return;
    const row = line.offsetHeight + (Number.parseFloat(getComputedStyle(sub).rowGap) || 0);
    if (row <= 0) return;

    const seen = known.current;
    seen.compact = heightOf('button.rwu-item:not(.is-selected)') ?? seen.compact;
    seen.planned = heightOf('div.rwu-item') ?? seen.planned;
    const expandedSeen = heightOf('.rwu-item.is-selected');
    if (expandedSeen !== undefined) seen.expanded = Math.max(seen.expanded ?? 0, expandedSeen);

    const compact =
      seen.compact ??
      (seen.planned !== undefined
        ? seen.planned - row
        : seen.expanded !== undefined
          ? seen.expanded - 3 * row
          : undefined);
    if (compact === undefined || compact <= 0) return;
    const cards: CardHeights = {
      compact,
      expanded: Math.max(seen.expanded ?? 0, compact + 3 * row),
      planned: seen.planned ?? compact + row,
    };
    const gap = Number.parseFloat(getComputedStyle(box).rowGap) || 0;
    const next = fitPageSize({ height, gap, cards, ...totalsRef.current });
    setCount((prev) => (prev === next ? prev : next));
  }, [ref]);

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

  return count;
};
