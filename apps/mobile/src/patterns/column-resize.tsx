import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent,
  type ReactElement,
} from 'react';

import { readLocal, writeLocal } from './local-store';
import './column-resize.css';

/** 칸이 이보다 좁아지면 머리 글자가 한 자도 남지 않는다. */
export const MIN_COLUMN_WIDTH = 40;

/** 화살표 한 번에 옮기는 폭. */
const KEY_STEP = 8;

/**
 * 두 칸 사이 경계를 delta 만큼 옮긴다. 한쪽이 넓어진 만큼 다른 쪽이 좁아진다 - 표 폭은 그대로라
 * 화면 밖으로 밀리지 않는다. 어느 쪽도 최소 폭 밑으로 내려가지 않는다.
 */
export const moveColumnBorder = (
  left: number,
  right: number,
  delta: number,
  min = MIN_COLUMN_WIDTH,
): [number, number] => {
  const shift = Math.min(Math.max(delta, min - left), right - min);

  return [left + shift, right - shift];
};

type Widths = Record<number, number>;

const parseWidths = (raw: string | null): Widths | null => {
  if (raw === null) return null;

  try {
    const value: unknown = JSON.parse(raw);
    if (typeof value !== 'object' || value === null) return null;

    const widths: Widths = {};
    for (const [key, width] of Object.entries(value)) {
      if (typeof width === 'number' && Number.isFinite(width) && width > 0) {
        widths[Number(key)] = width;
      }
    }

    return widths;
  } catch {
    return null;
  }
};

/** 칸의 테두리 상자 폭과 좌우 여백. 폭은 여백을 뺀 내용 폭으로 건다(칸이 content-box 라). */
const measure = (cell: Element) => {
  const style = getComputedStyle(cell);
  const padding = (parseFloat(style.paddingLeft) || 0) + (parseFloat(style.paddingRight) || 0);

  return { box: cell.getBoundingClientRect().width, padding };
};

interface Drag {
  pointerId: number;
  startX: number;
  index: number;
  left: { box: number; padding: number };
  right: { box: number; padding: number };
}

export interface ColumnResize {
  /** 끌어서 정한 칸 폭. 정한 적이 없으면 CSS 가 정한 폭 그대로다. */
  styleOf: (index: number) => CSSProperties | undefined;
  /**
   * index 칸과 그 오른쪽 칸 사이 경계 손잡이. 왼쪽 칸 머리 안에 둔다. 컴포넌트가 아니라 그리는
   * 함수다 - 렌더마다 새 컴포넌트면 끄는 도중 손잡이가 다시 붙어 포인터를 놓친다.
   */
  handle: (index: number, label: string) => ReactElement;
}

/**
 * 표의 칸 폭을 머리 경계를 끌어 바꾼다(사용자 지시 2026-10-22).
 *
 * 남는 폭을 가지는 칸(flex)은 폭을 걸지 않는다 - 이웃이 넓어지거나 좁아진 만큼 그 칸이 받아 표가
 * 늘 화면 폭에 맞는다. 정한 폭은 기기에 남겨 다음에 열어도 같다.
 */
export const useColumnResize = (storageKey: string, flex: number): ColumnResize => {
  const [widths, setWidths] = useState<Widths>({});
  const latest = useRef<Widths>({});
  const touched = useRef(false);
  const drag = useRef<Drag | null>(null);
  const [dragging, setDragging] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;

    void readLocal(storageKey)
      .then((raw) => {
        const saved = parseWidths(raw);
        // 불러오는 사이 이미 끌었으면 손댄 것이 이긴다.
        if (cancelled || saved === null || touched.current) return;
        latest.current = saved;
        setWidths(saved);
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, [storageKey]);

  const apply = useCallback(
    (from: Drag, delta: number) => {
      const [left, right] = moveColumnBorder(from.left.box, from.right.box, delta);
      const next = { ...latest.current };
      if (from.index !== flex) next[from.index] = left - from.left.padding;
      if (from.index + 1 !== flex) next[from.index + 1] = right - from.right.padding;
      touched.current = true;
      latest.current = next;
      setWidths(next);
    },
    [flex],
  );

  const save = useCallback(() => {
    void writeLocal(storageKey, JSON.stringify(latest.current)).catch(() => undefined);
  }, [storageKey]);

  /** 손잡이가 든 칸과 그 오른쪽 칸을 지금 그려진 폭으로 잰다. */
  const start = (grip: Element, index: number, pointerId: number, startX: number) => {
    const cell = grip.closest('th');
    const next = cell?.nextElementSibling;
    if (cell === null || next === null || next === undefined) return null;

    return { pointerId, startX, index, left: measure(cell), right: measure(next) };
  };

  const styleOf = (index: number): CSSProperties | undefined => {
    const width = widths[index];

    return index === flex || width === undefined ? undefined : { width: `${String(width)}px` };
  };

  const handle = (index: number, label: string) => (
    <span
      role="separator"
      aria-orientation="vertical"
      aria-label={label}
      tabIndex={0}
      className="column-resize"
      data-dragging={dragging === index ? '' : undefined}
      onPointerDown={(event: PointerEvent<HTMLSpanElement>) => {
        const from = start(event.currentTarget, index, event.pointerId, event.clientX);
        if (from === null) return;
        event.preventDefault();
        event.currentTarget.setPointerCapture(event.pointerId);
        drag.current = from;
        setDragging(index);
      }}
      onPointerMove={(event: PointerEvent<HTMLSpanElement>) => {
        const from = drag.current;
        if (from === null || from.pointerId !== event.pointerId) return;
        apply(from, event.clientX - from.startX);
      }}
      onPointerUp={() => {
        if (drag.current === null) return;
        drag.current = null;
        setDragging(null);
        save();
      }}
      onPointerCancel={() => {
        drag.current = null;
        setDragging(null);
        save();
      }}
      onKeyDown={(event: KeyboardEvent<HTMLSpanElement>) => {
        const step =
          event.key === 'ArrowLeft' ? -KEY_STEP : event.key === 'ArrowRight' ? KEY_STEP : 0;
        if (step === 0) return;
        const from = start(event.currentTarget, index, -1, 0);
        if (from === null) return;
        event.preventDefault();
        apply(from, step);
        save();
      }}
    />
  );

  return { styleOf, handle };
};
