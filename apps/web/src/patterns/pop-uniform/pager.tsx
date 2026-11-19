import { messages } from '@omf-mes/i18n';
import { useCallback, useLayoutEffect, useRef, useState, type RefObject } from 'react';

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
 * 구획 높이에 들어가는 한 쪽 건수. `ref` 는 목록이 놓이는 칸(높이가 정해진 칸)이다.
 *
 * 그려진 줄 높이(가장 큰 것)와 간격으로 「몇 줄 들어가나」를 잰다. 줄이 아직 없으면 `fallback`.
 * 화면 크기가 바뀌면 다시 잰다. 결과는 `min` 이상.
 *
 * ⭐ 줄 높이는 «처음 잰 값»을 붙들지 않는다 — 데이터가 바뀌어 줄이 높아지면(두 줄 글 등) 다음 그리기에서
 *    다시 재서 줄인다. 그래서 넘치는 순간이 한 번 있을 수 있어 칸은 `overflow:hidden`(`.pu-fit`)으로 둔다.
 */
export const useFitCount = (
  ref: RefObject<HTMLElement | null>,
  { fallback = 5, min = 1, max = 50 }: { fallback?: number; min?: number; max?: number } = {},
): number => {
  const [count, setCount] = useState(fallback);

  const measure = useCallback(() => {
    const box = ref.current;
    if (box === null) return;
    const height = box.clientHeight;
    if (height <= 0) return;
    const rows = Array.from(box.children).filter(
      (child): child is HTMLElement => child instanceof HTMLElement && child.offsetHeight > 0,
    );
    if (rows.length === 0) return;
    const style = getComputedStyle(box);
    const gap = Number.parseFloat(style.rowGap) || 0;
    const rowHeight = Math.max(...rows.map((row) => row.offsetHeight));
    if (rowHeight <= 0) return;
    const fits = Math.floor((height + gap) / (rowHeight + gap));
    const next = Math.min(max, Math.max(min, fits));
    setCount((prev) => (prev === next ? prev : next));
  }, [ref, min, max]);

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

/**
 * 표에 들어가는 한 쪽 줄 수. `ref` 는 표를 감싼 칸(높이가 정해진 칸), 머리 줄은 빼고 잰다.
 */
export const useFitTableRows = (
  ref: RefObject<HTMLElement | null>,
  { fallback = 5, min = 1, max = 50 }: { fallback?: number; min?: number; max?: number } = {},
): number => {
  const [count, setCount] = useState(fallback);

  const measure = useCallback(() => {
    const box = ref.current;
    if (box === null) return;
    const height = box.clientHeight;
    if (height <= 0) return;
    const head = box.querySelector('thead');
    const rows = Array.from(box.querySelectorAll('tbody > tr')).filter(
      (row): row is HTMLElement => row instanceof HTMLElement && row.offsetHeight > 0,
    );
    if (rows.length === 0) return;
    const rowHeight = Math.max(...rows.map((row) => row.offsetHeight));
    const headHeight = head instanceof HTMLElement ? head.offsetHeight : 0;
    const fits = Math.floor((height - headHeight - 2) / rowHeight);
    const next = Math.min(max, Math.max(min, fits));
    setCount((prev) => (prev === next ? prev : next));
  }, [ref, min, max]);

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

/** `index` 번째 항목이 든 쪽(1부터). 스캔한 항목이 있는 쪽으로 넘길 때 쓴다. */
export const pageContaining = (index: number, size: number): number =>
  index < 0 ? 1 : Math.floor(index / Math.max(1, size)) + 1;

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

/** 쪽 크기를 재는 칸의 ref. */
export const useFitRef = <E extends HTMLElement = HTMLDivElement>() => useRef<E>(null);
