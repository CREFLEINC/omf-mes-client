import { useEffect, useState } from 'react';

/**
 * 그림을 그릴 실제 폭(px). ⭐ 공통 원칙(d) — 차트 글자는 최소 크기 이하로 줄지 않는다(사용자 점검 2026-10-16).
 * 고정 크기 그림(viewBox)을 화면 폭에 맞춰 늘이고 줄이면 좁은 폭에서 축 글자가 8px 까지 작아졌다 — 대신 실제
 * 폭으로 다시 그려 글자가 늘 지정한 크기로 선다. 크기 관찰을 못 하는 환경(jsdom)에서는 `fallback`.
 *
 * 요소는 콜백 ref 로 받는다 — 처음에는 불러오는 중이라 그림 자리가 없다가 나중에 생기는 경우, 고정 ref 로는
 * 관찰이 걸리지 않아 `fallback`(640) 폭 그림이 넓은 화면에서 늘어나 글자가 커졌다(1920 실측 2026-10-16).
 */
export const useChartWidth = <T extends HTMLElement>(
  fallback = 600,
  min = 260,
): [(node: T | null) => void, number] => {
  const [element, setElement] = useState<T | null>(null);
  const [width, setWidth] = useState(fallback);

  useEffect(() => {
    if (element === null || typeof ResizeObserver === 'undefined') return undefined;

    const observer = new ResizeObserver((entries) => {
      const measured = entries[0]?.contentRect.width ?? 0;
      if (measured > 0) setWidth(Math.max(min, Math.round(measured)));
    });
    observer.observe(element);

    return () => {
      observer.disconnect();
    };
  }, [element, min]);

  return [setElement, width];
};
