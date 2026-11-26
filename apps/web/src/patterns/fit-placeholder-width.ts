import { type RefCallback, useLayoutEffect, useState } from 'react';

/**
 * 조회 상자 검색 칸의 폭을 흐린 문구 길이에 맞춘다(omf-all-around#358).
 * 이 class 를 검색 칸 바깥 상자(`containerClassName`)에 달고, 훅이 돌려준 ref 를 칸에 건다.
 * 흐린 문구를 실제 글꼴로 재고 앞 아이콘 · 안쪽 여백을 더한 폭을 상자에 준다 — 언어가 바뀌어도 잘리지 않는다.
 */
export const FIT_PLACEHOLDER_CLASS = 'fit-placeholder-width';

const px = (value: string): number => Number.parseFloat(value) || 0;

const sides = (style: CSSStyleDeclaration): number =>
  px(style.paddingLeft) +
  px(style.paddingRight) +
  px(style.borderLeftWidth) +
  px(style.borderRightWidth);

/** 흐린 문구를 칸과 같은 글꼴로 그려 본 폭. 그려지지 않는 곳(시험 환경)에서는 0. */
const measurePlaceholder = (input: HTMLInputElement): number => {
  const style = getComputedStyle(input, '::placeholder');
  const span = document.createElement('span');
  span.textContent = input.placeholder;
  span.style.position = 'absolute';
  span.style.visibility = 'hidden';
  span.style.whiteSpace = 'pre';
  span.style.fontStyle = style.fontStyle;
  span.style.fontWeight = style.fontWeight;
  span.style.fontSize = style.fontSize;
  span.style.fontFamily = style.fontFamily;
  span.style.letterSpacing = style.letterSpacing;
  document.body.append(span);
  const width = span.getBoundingClientRect().width;
  span.remove();
  return width;
};

const fit = (input: HTMLInputElement): void => {
  const box = input.closest<HTMLElement>(`.${FIT_PLACEHOLDER_CLASS}`);
  if (box === null || input.placeholder === '') return;
  const text = measurePlaceholder(input);
  if (text === 0) return;

  let width = text + sides(getComputedStyle(input));
  // 칸에서 바깥 상자까지 올라가며 안쪽 여백과, 가로 줄에서 칸 앞에 놓인 것(돋보기 아이콘)과 그 사이 간격을 더한다.
  for (let node: Element = input; node !== box;) {
    const parent = node.parentElement;
    if (parent === null) return;
    const style = getComputedStyle(parent);
    width += sides(style);
    if (style.display.includes('flex') && style.flexDirection.startsWith('row')) {
      for (
        let prev = node.previousElementSibling;
        prev !== null;
        prev = prev.previousElementSibling
      ) {
        width += prev.getBoundingClientRect().width + px(style.columnGap);
      }
    }
    node = parent;
  }

  const size = `${String(Math.ceil(width) + 1)}px`;
  box.style.width = size;
  box.style.flex = `0 0 ${size}`;
};

/** 흐린 문구가 바뀌거나(언어 전환) 글꼴이 늦게 내려오면 다시 잰다. */
export const useFitPlaceholderWidth = (placeholder: string): RefCallback<HTMLInputElement> => {
  const [input, setInput] = useState<HTMLInputElement | null>(null);

  useLayoutEffect(() => {
    if (input === null) return undefined;
    fit(input);
    let alive = true;
    const fonts = (document as Partial<Document>).fonts;
    void fonts?.ready.then(() => {
      if (alive) fit(input);
    });
    return () => {
      alive = false;
    };
  }, [input, placeholder]);

  return setInput;
};
