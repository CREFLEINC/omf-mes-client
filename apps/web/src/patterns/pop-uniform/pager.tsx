import { messages } from '@omf-mes/i18n';
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react';

/**
 * 쪽 넘김(규칙 1·15) — #295.
 *
 * 구획 크기는 고정이고 구획 안 스크롤이 없다. 목록·표가 구획보다 많으면 아래 오른쪽 「총 N건 ‹ 1 / 3 ›」으로
 * 나눠 본다. 0건이면 숨기고, 한 쪽이면 「총 N건」만. 한 쪽 건수는 구획 높이에 들어가는 만큼(`useFitCount`).
 */
const t = messages.popUniform.pager;

export const PuPager = ({
  total,
  page,
  pages,
  onPage,
  label,
  showTotal = true,
}: {
  /** 전체 건수. 모르면 `null` — 그때는 쪽 번호만. */
  total: number | null;
  /** 지금 쪽(1부터). */
  page: number;
  pages: number;
  onPage: (page: number) => void;
  /** 무엇의 쪽인지(랜드마크 이름). */
  label: string;
  showTotal?: boolean;
}) => {
  if (total !== null && total <= 0) return null;
  if (total === null && pages <= 1) return null;
  const one = pages <= 1;

  return (
    <nav className="pu-pager" aria-label={label}>
      {showTotal && total !== null && <span className="pu-pager-info">{t.total(total)}</span>}
      {!one && (
        <>
          <button
            type="button"
            className="pu-btn sm"
            aria-label={t.prev}
            disabled={page <= 1}
            onClick={() => {
              onPage(page - 1);
            }}
          >
            ‹
          </button>
          <span className="pu-pager-pg">{t.position(page, pages)}</span>
          <button
            type="button"
            className="pu-btn sm"
            aria-label={t.next}
            disabled={page >= pages}
            onClick={() => {
              onPage(page + 1);
            }}
          >
            ›
          </button>
        </>
      )}
    </nav>
  );
};

/**
 * 쪽 줄 수 재기의 공통 틀 — `useFitCount` · `useFitTableRows` 가 함께 쓴다(피처 014 P-01-01 총괄 확인 2026-11-24).
 *
 * - 그릴 때마다 잰다(데이터가 바뀌어 줄이 높아지면 다음 그리기에서 줄인다 — 지금 동작 그대로).
 * - ⭐ **진동 막기**: 줄 높이가 «그려진 줄 수»에 따라 바뀌면(두 줄 셀 · 칩이 든 줄이 보이느냐에 따라) 줄 수 → 보이는 줄 →
 *   가장 높은 줄 → 줄 수가 번갈아 바뀌어 끝없이 돈다(Maximum update depth). 칸 높이도 줄 수 · 데이터에 따라 바뀔 수 있다
 *   (쪽 크기가 바뀌면 다시 받는 동안 쪽 넘김 줄이 숨었다 서며 표 칸이 36px 오르내림 — P-01-01 스캔 · 인쇄 직후 실측
 *   420 ↔ 384). 그래서 «칸 크기»가 아니라 «창 크기»(`innerWidth` · `innerHeight`)를 기준으로, 같은 창 크기에서
 *   «전에 거쳤던 값»으로 다시 줄어들면(= 돌기 시작) 그 값을 «천장»으로 삼아 다시 늘지 않는다 — 작은 쪽에 멈춘다.
 *   처음 줄어드는 것(데이터가 바뀌어 줄이 높아짐)은 천장을 만들지 않으므로 줄이 다시 낮아지면 지금처럼 늘어난다.
 *   창 크기가 바뀌면(1100 ↔ 1920) 천장 · 거친 값을 풀고 새로 잰다. 화면이 `resetKey`(고른 대상 · 탭 · 쪽 등 사람이
 *   바꾼 보기)를 주면 그것이 바뀔 때도 푼다 — 한 번 잡힌 천장이 다른 보기의 줄 수까지 묶지 않게(T054).
 * - ⭐ **칸이 갈려도 지켜본다**: 빈 상태 · 로딩으로 칸 요소가 내려갔다 다시 서면 `ref` 가 새 요소를 가리킨다. 크기 관찰을
 *   새 요소로 옮겨 붙인다(전에는 처음 요소에 붙은 채라 창 크기를 바꿔도 다시 재지 않았다).
 */
const useFitMeasure = (
  ref: RefObject<HTMLElement | null>,
  fallback: number,
  fitsOf: (box: HTMLElement) => number | null,
  resetKey: string | undefined,
): number => {
  const [count, setCount] = useState(fallback);
  const guard = useRef<{
    viewport: string;
    ceiling: number | null;
    seen: Set<number>;
  }>({ viewport: '', ceiling: null, seen: new Set() });
  const fitsRef = useRef(fitsOf);
  fitsRef.current = fitsOf;
  const resetKeyRef = useRef(resetKey);
  resetKeyRef.current = resetKey;

  const measure = useCallback(() => {
    const box = ref.current;
    if (box === null) return;
    if (box.clientHeight <= 0) return;
    const viewport = `${String(window.innerWidth)}x${String(window.innerHeight)}|${resetKeyRef.current ?? ''}`;
    if (viewport !== guard.current.viewport) {
      guard.current = { viewport, ceiling: null, seen: new Set() };
    }
    const fits = fitsRef.current(box);
    if (fits === null) return;
    setCount((prev) => {
      const { ceiling, seen } = guard.current;
      const next = ceiling === null ? fits : Math.min(fits, ceiling);
      if (next < prev && seen.has(next)) guard.current.ceiling = next;
      seen.add(prev);
      seen.add(next);

      return prev === next ? prev : next;
    });
  }, [ref]);

  const observed = useRef<{ element: HTMLElement; observer: ResizeObserver } | null>(null);

  useLayoutEffect(() => {
    const box = ref.current;
    if (observed.current?.element !== box) {
      observed.current?.observer.disconnect();
      observed.current = null;
      if (box !== null && typeof ResizeObserver !== 'undefined') {
        const observer = new ResizeObserver(() => {
          measure();
        });
        observer.observe(box);
        observed.current = { element: box, observer };
      }
    }
    measure();
  });

  useEffect(
    () => () => {
      observed.current?.observer.disconnect();
      observed.current = null;
    },
    [],
  );

  return count;
};

/**
 * 구획 높이에 들어가는 한 쪽 건수. `ref` 는 목록이 놓이는 칸(높이가 정해진 칸)이다.
 *
 * 그려진 줄 높이(가장 큰 것)와 간격으로 「몇 줄 들어가나」를 잰다. 줄이 아직 없으면 `fallback`.
 * 화면 크기가 바뀌면 다시 잰다. 결과는 `min` 이상.
 *
 * ⭐ 줄 높이는 «처음 잰 값»을 붙들지 않는다 — 데이터가 바뀌어 줄이 높아지면(두 줄 글 등) 다음 그리기에서
 *    다시 재서 줄인다. 그래서 넘치는 순간이 한 번 있을 수 있어 칸은 `overflow:hidden`(`.pu-fit`)으로 둔다.
 *    같은 칸 크기에서 줄었다 늘었다 하면 작은 쪽에 멈춘다(`useFitMeasure`).
 */
export const useFitCount = (
  ref: RefObject<HTMLElement | null>,
  {
    fallback = 5,
    min = 1,
    max = 50,
    resetKey,
  }: {
    fallback?: number;
    min?: number;
    max?: number;
    /** 사람이 바꾼 보기(고른 대상 · 탭 · 쪽) — 바뀌면 진동 막기의 천장을 푼다. */
    resetKey?: string;
  } = {},
): number =>
  useFitMeasure(
    ref,
    fallback,
    (box) => {
      const rows = Array.from(box.children).filter(
        (child): child is HTMLElement => child instanceof HTMLElement && child.offsetHeight > 0,
      );
      if (rows.length === 0) return null;
      const style = getComputedStyle(box);
      const gap = Number.parseFloat(style.rowGap) || 0;
      const rowHeight = Math.max(...rows.map((row) => row.offsetHeight));
      if (rowHeight <= 0) return null;
      const fits = Math.floor((box.clientHeight + gap) / (rowHeight + gap));

      return Math.min(max, Math.max(min, fits));
    },
    resetKey,
  );

/**
 * 표에 들어가는 한 쪽 줄 수. `ref` 는 표를 감싼 칸(높이가 정해진 칸), 머리 줄은 빼고 잰다.
 */
export const useFitTableRows = (
  ref: RefObject<HTMLElement | null>,
  {
    fallback = 5,
    min = 1,
    max = 50,
    resetKey,
  }: {
    fallback?: number;
    min?: number;
    max?: number;
    /** 사람이 바꾼 보기(고른 대상 · 탭 · 쪽) — 바뀌면 진동 막기의 천장을 푼다. */
    resetKey?: string;
  } = {},
): number =>
  useFitMeasure(
    ref,
    fallback,
    (box) => {
      const head = box.querySelector('thead');
      const rows = Array.from(box.querySelectorAll('tbody > tr')).filter(
        (row): row is HTMLElement => row instanceof HTMLElement && row.offsetHeight > 0,
      );
      if (rows.length === 0) return null;
      const rowHeight = Math.max(...rows.map((row) => row.offsetHeight));
      const headHeight = head instanceof HTMLElement ? head.offsetHeight : 0;
      const fits = Math.floor((box.clientHeight - headHeight - 2) / rowHeight);

      return Math.min(max, Math.max(min, fits));
    },
    resetKey,
  );

export interface PuPage<T> {
  items: T[];
  /** 지금 쪽(1부터, 넘치면 마지막 쪽으로 당긴다). */
  page: number;
  pages: number;
  total: number;
}

/** 받은 목록 전체를 화면에서 쪽으로 자른다(서버가 한 번에 다 주는 목록). */
export const pageOf = <T,>(list: readonly T[], page: number, size: number): PuPage<T> => {
  const per = Math.max(1, size);
  const pages = Math.max(1, Math.ceil(list.length / per));
  const current = Math.min(Math.max(1, page), pages);
  return {
    items: list.slice((current - 1) * per, current * per),
    page: current,
    pages,
    total: list.length,
  };
};

/**
 * 화면에서 자르는 목록의 쪽 상태 — 한 쪽 건수가 바뀌어도 «보던 첫 줄이 든 쪽»을 지킨다(규칙 15).
 */
export const useClientPage = <T,>(
  list: readonly T[],
  size: number,
): PuPage<T> & { setPage: (page: number) => void; showIndex: (index: number) => void } => {
  const [first, setFirst] = useState(0);
  const per = Math.max(1, size);
  const page = Math.floor(first / per) + 1;
  const result = pageOf(list, page, per);
  const setPage = useCallback(
    (next: number) => {
      setFirst((Math.max(1, next) - 1) * per);
    },
    [per],
  );
  const showIndex = useCallback((index: number) => {
    setFirst(Math.max(0, index));
  }, []);
  return { ...result, setPage, showIndex };
};

export type PuFitRef = (element: HTMLElement | null) => void;

/** 줄 요소 — 목록은 바로 아래 자식, 표는 본문 줄. */
const fitRows = (box: HTMLElement, table: boolean): HTMLElement[] =>
  Array.from(table ? box.querySelectorAll('tbody > tr') : box.children).filter(
    (row): row is HTMLElement => row instanceof HTMLElement,
  );

/**
 * 칸 높이에 드는 줄만 한 쪽으로 — 안쪽 스크롤 · 잘린 줄 없이 공통 쪽 넘김. `fitRef` 는 줄을 담는 목록(`ul`)이나 표를 감싼 칸에 단다.
 *
 * 줄 높이가 서로 다를 수 있어(회차마다 시리얼 줄 수가 다름) 한 쪽 줄 수를 하나로 정하지 않는다 — 한 번 다 그려 줄마다 재고,
 * 앞에서부터 칸에 드는 만큼씩 쪽을 끊는다. 의뢰 · 줄 수 · 칸 높이가 바뀌거나 그린 쪽이 칸을 넘으면 다시 잰다.
 * 칸 높이를 모르면(jsdom 등) 한 쪽에 다 둔다. `resetKey`(의뢰 등)가 바뀌면 1쪽부터. `enabled` 가 거짓이면 나누지 않고 다 준다.
 * (`useFitCount` 는 «가장 높은 줄» 하나로 줄 수를 정해 줄 높이가 다르면 늘었다 줄었다 할 수 있다 — 그런 목록에 쓴다.)
 */
export const useFitPages = <T,>(
  list: readonly T[],
  {
    table = false,
    resetKey,
    enabled = true,
  }: { table?: boolean; resetKey?: unknown; enabled?: boolean } = {},
): {
  fitRef: PuFitRef;
  items: T[];
  page: number;
  pages: number;
  total: number;
  setPage: (page: number) => void;
} => {
  const ref = useRef<HTMLElement | null>(null);
  const observer = useRef<ResizeObserver | null>(null);
  const [height, setHeight] = useState(0);
  const fitRef = useCallback<PuFitRef>((element) => {
    observer.current?.disconnect();
    observer.current = null;
    ref.current = element;
    if (element === null || typeof ResizeObserver === 'undefined') return;
    const next = new ResizeObserver(() => setHeight(element.clientHeight));
    next.observe(element);
    observer.current = next;
  }, []);
  /* 쪽마다 첫 줄 번호. `null` 이면 다 그려서 재는 중. */
  const [starts, setStarts] = useState<number[] | null>(null);
  const [page, setPage] = useState(1);
  const retries = useRef(0);
  /*
   * 다시 잴 때 머물 줄(#334) — 칸 높이 · 줄 높이가 바뀌어 다시 재도 보던 쪽에 머문다(판정을 바꿔도 쪽이 튀지 않게). 입력 중인
   * 줄(포커스)이 있으면 그 줄이 든 쪽으로 — 오류 문구로 줄이 높아져 다음 쪽으로 밀려도 보인다. `resetKey` 가 바뀌면 1쪽.
   */
  const shownStart = useRef(0);
  const anchor = useRef(0);
  const lastResetKey = useRef(resetKey);
  useLayoutEffect(() => {
    retries.current = 0;
    anchor.current = Object.is(lastResetKey.current, resetKey) ? shownStart.current : 0;
    lastResetKey.current = resetKey;
    setStarts(null);
  }, [resetKey, list.length, height, enabled]);
  useEffect(() => {
    setPage(1);
  }, [resetKey]);

  useLayoutEffect(() => {
    const box = ref.current;
    if (box === null || !enabled) return;
    const rows = fitRows(box, table);
    const first = rows[0];
    if (first === undefined) return;
    const boxRect = box.getBoundingClientRect();
    /* 칸이 아무리 낮아도 한 줄은 다 보이게 — 칸 최소 높이 = 칸 위 끝 → 첫 줄 아래 끝(표면 머리 줄 포함) + 표 테두리 몫. */
    const edge = table ? 2 : 0;
    const minHeight = `${Math.ceil(first.getBoundingClientRect().bottom - boxRect.top) + edge}px`;
    if (box.style.minHeight !== minHeight) box.style.minHeight = minHeight;
    if (starts !== null) {
      /* 그린 쪽이 칸을 넘으면(늦게 온 시리얼 등으로 줄이 높아짐) 다시 잰다 — 같은 조건에서 두 번까지만. */
      if (box.scrollHeight > box.clientHeight + 1 && retries.current < 2) {
        retries.current += 1;
        anchor.current = shownStart.current;
        setStarts(null);
      }
      return;
    }
    if (box.clientHeight <= 0) {
      setStarts([0]);
      return;
    }
    const room = boxRect.bottom - edge - first.getBoundingClientRect().top;
    const next = [0];
    let top = first.getBoundingClientRect().top;
    rows.forEach((row, index) => {
      const rect = row.getBoundingClientRect();
      if (index > (next.at(-1) ?? 0) && rect.bottom - top > room) {
        next.push(index);
        top = rect.top;
      }
    });
    setStarts(next);
    const focused = rows.findIndex((row) => row.contains(document.activeElement));
    const target = focused >= 0 ? focused : anchor.current;
    setPage(next.filter((start) => start <= target).length || 1);
  });

  const pages = enabled ? (starts?.length ?? 1) : 1;
  const current = Math.min(page, pages);
  if (starts !== null) shownStart.current = starts[current - 1] ?? 0;
  const items =
    !enabled || starts === null
      ? list.slice()
      : list.slice(starts[current - 1] ?? 0, starts[current] ?? list.length);
  return { fitRef, items, page: current, pages, total: list.length, setPage };
};
