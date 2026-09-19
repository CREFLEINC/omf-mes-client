import { useEffect, useLayoutEffect, useRef } from 'react';

import { fitFontSize } from './fit-font';

/**
 * 한 줄에 세우는 글줄 — 넘치면 **글자를 줄여** 맞춘다(`fit-font` 에 판정이 있다).
 *
 * ⚠ **그린 뒤에 잰다.** 그래서 `useLayoutEffect` 다 — 그려진 뒤 다음 칠 전에 맞춰야 작은 글자가
 *   한 번 커졌다 작아지는 깜빡임이 없다.
 *
 * ⚠ **글꼴이 늦게 온다.** 첫 칠은 대체 글꼴로 재고, 웹폰트가 도착하면 폭이 달라진다 —
 *   `document.fonts` 가 준비되면 한 번 더 맞춘다. 셸에는 글꼴이 함께 실려 대개 곧바로 끝난다.
 *
 * ⛔ **폭이 바뀌면 다시 잰다.** 줄 자체가 늘거나 줄면(좌우 구획 폭은 창 크기를 따른다) 앞서
 *    고른 크기는 더 이상 맞지 않는다. `ResizeObserver` 가 없는 환경(감지기의 jsdom)에서는
 *    첫 계산만 하고 조용히 넘어간다 — 거기서는 폭 자체가 0 이라 잴 것도 없다.
 */
export interface FitTextProps {
  value: string;
  className?: string;
}

export const FitText = ({ value, className }: FitTextProps) => {
  const ref = useRef<HTMLSpanElement>(null);

  useLayoutEffect(() => {
    const node = ref.current;
    if (node === null) return undefined;

    const fit = () => {
      fitFontSize(node);
    };

    fit();

    if (typeof ResizeObserver === 'undefined') return undefined;

    /*
     * ⛔ **자기 자신을 보지 않는다.** 글자 크기를 바꾸면 자기 크기가 바뀌므로 다시 불리고,
     *    브라우저가 「되돌이가 끝나지 않았다」고 경고한다. 폭을 정하는 것은 바깥 칸이다.
     */
    const observer = new ResizeObserver(fit);
    observer.observe(node.parentElement ?? node);

    return () => {
      observer.disconnect();
    };
  }, [value]);

  useEffect(() => {
    const node = ref.current;
    if (node === null) return;

    void document.fonts?.ready.then(() => {
      fitFontSize(node);
    });
  }, [value]);

  return (
    <span ref={ref} className={className}>
      {value}
    </span>
  );
};
