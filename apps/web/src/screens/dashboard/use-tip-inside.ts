import { useEffect } from 'react';

/** 말풍선과 카드 경계 사이 여백(px). */
const EDGE_GAP = 4;

const px = (value: string): number => Number.parseFloat(value) || 0;

/** 마우스가 올라간 · 포커스된 요소에서 말풍선(`data-tip` 의 `::after`)을 그리는 요소를 찾는다. */
const tipHostOf = (target: EventTarget | null): HTMLElement | null => {
  if (!(target instanceof Element)) return null;
  const host = target.closest('[data-tip]') ?? target.querySelector('[data-tip]');

  return host instanceof HTMLElement && host.closest('.dash-panel') !== null ? host : null;
};

/** 밀기 전 말풍선의 화면 가로 위치(left, right). 말풍선이 떠 있지 않으면 null. */
const tipEdgesOf = (host: HTMLElement): Edges | null => {
  const tip = getComputedStyle(host, '::after');
  const width =
    px(tip.width) +
    (tip.boxSizing === 'border-box'
      ? 0
      : px(tip.paddingLeft) +
        px(tip.paddingRight) +
        px(tip.borderLeftWidth) +
        px(tip.borderRightWidth));
  if (tip.content === 'none' || tip.content === 'normal' || width <= 0) return null;
  const rect = host.getBoundingClientRect();
  if (tip.position === 'absolute') {
    const shift = tip.transform === 'none' ? 0 : new DOMMatrixReadOnly(tip.transform).m41;
    const left = rect.left + host.clientLeft + px(tip.left) + shift;

    return { left, right: left + width };
  }

  /* 글 흐름에 붙는 말풍선(원인 구분)은 요소 끝에 서므로 요소 오른쪽이 말풍선 오른쪽이다. */
  return { left: rect.right - width, right: rect.right };
};

interface Edges {
  left: number;
  right: number;
}

/**
 * 말풍선을 안쪽(`bounds`)에 넣으려면 가로로 옮길 거리(px, 오른쪽 +). 이미 안쪽이면 0.
 * 안쪽보다 넓으면 왼쪽 끝에 맞춘다 — 글 첫머리가 보이게.
 */
export const tipShiftOf = (tip: Edges, bounds: Edges): number => {
  if (tip.left < bounds.left || tip.right - tip.left > bounds.right - bounds.left)
    return bounds.left - tip.left;
  if (tip.right > bounds.right) return bounds.right - tip.right;

  return 0;
};

/**
 * 대시보드 말풍선(`data-tip`)이 카드나 화면 밖으로 나가 잘리지 않게 안쪽으로 민다(omf-all-around#128).
 * 말풍선은 CSS `::after` 라 크기를 미리 알 수 없어, 뜬 뒤 위치를 재고 `--tip-shift` 만큼 옮긴다.
 */
export const useTipInside = (): void => {
  useEffect(() => {
    const place = (event: Event): void => {
      const host = tipHostOf(event.target);
      if (host === null) return;
      /* 잴 때 쓰는 값(left · transform · 요소 크기)은 `translate` 로 옮긴 만큼을 빼고 나온다 — 미리 지우지 않는다. */
      requestAnimationFrame(() => {
        const edges = tipEdgesOf(host);
        const card = host.closest('.dash-panel')?.getBoundingClientRect();
        if (edges === null || card === undefined) return;
        const shift = tipShiftOf(edges, {
          left: Math.max(card.left, 0) + EDGE_GAP,
          right: Math.min(card.right, document.documentElement.clientWidth) - EDGE_GAP,
        });
        if (shift === 0) host.style.removeProperty('--tip-shift');
        else host.style.setProperty('--tip-shift', `${String(Math.round(shift))}px`);
      });
    };
    document.addEventListener('pointerover', place);
    document.addEventListener('focusin', place);

    return () => {
      document.removeEventListener('pointerover', place);
      document.removeEventListener('focusin', place);
    };
  }, []);
};
