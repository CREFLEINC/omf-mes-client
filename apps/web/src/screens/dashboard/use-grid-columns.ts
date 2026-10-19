import { useEffect, useState, type RefObject } from 'react';

/**
 * 격자의 실제 열 수(`grid-template-columns` 가 계산된 결과). 설비 타일을 「2행 수준」으로 끊으려면 지금 몇
 * 열로 서는지 알아야 한다 — 열 수는 CSS(영역 폭)가 정하고 여기서는 읽기만 한다. 크기 관찰을 못 하는
 * 환경(테스트의 jsdom)에서는 `fallback`.
 */
export const useGridColumns = (
  ref: RefObject<HTMLElement | null>,
  fallback: number,
  /** 격자가 그려졌는가 — 처음엔 데이터가 없어 격자가 없다. 그려진 뒤 다시 붙는다. */
  active: boolean,
): number => {
  const [columns, setColumns] = useState(fallback);

  useEffect(() => {
    const element = ref.current;
    if (element === null || typeof ResizeObserver === 'undefined') return undefined;

    const read = (): void => {
      const tracks = getComputedStyle(element).gridTemplateColumns.split(' ').filter(Boolean);
      setColumns(tracks.length > 0 ? tracks.length : fallback);
    };
    const observer = new ResizeObserver(read);
    observer.observe(element);
    read();

    return () => {
      observer.disconnect();
    };
  }, [ref, fallback, active]);

  return columns;
};
