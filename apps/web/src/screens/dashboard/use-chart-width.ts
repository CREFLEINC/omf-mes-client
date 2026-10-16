import { useEffect, useRef, useState, type RefObject } from 'react';

/**
 * 그림을 그릴 실제 폭(px). ⭐ 공통 원칙(d) — 차트 글자는 최소 크기 이하로 줄지 않는다(사용자 점검 2026-10-16).
 * 고정 크기 그림(viewBox)을 화면 폭에 맞춰 늘이고 줄이면 좁은 폭에서 축 글자가 8px 까지 작아졌다 — 대신 실제
 * 폭으로 다시 그려 글자가 늘 지정한 크기로 선다. 크기 관찰을 못 하는 환경(jsdom)에서는 `fallback`.
 */
export const useChartWidth = <T extends HTMLElement>(
  fallback = 600,
  min = 260,
): [RefObject<T | null>, number] => {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(fallback);

  useEffect(() => {
    const element = ref.current;
    if (element === null || typeof ResizeObserver === 'undefined') return undefined;

    const observer = new ResizeObserver((entries) => {
      const measured = entries[0]?.contentRect.width ?? 0;
      if (measured > 0) setWidth(Math.max(min, Math.round(measured)));
    });
    observer.observe(element);

    return () => {
      observer.disconnect();
    };
  }, [min]);

  return [ref, width];
};
