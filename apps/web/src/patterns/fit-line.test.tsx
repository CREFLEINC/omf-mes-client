import { describe, expect, it } from 'vitest';

import { fitFontPx } from './fit-line';

describe('fitFontPx — 칸 폭에 맞는 글자 크기', () => {
  it('다 들어가면 원래 크기를 둔다', () => {
    expect(fitFontPx(14, 200, 200)).toBeNull();
    expect(fitFontPx(14, 200, 120)).toBeNull();
  });

  it('넘치면 넘친 만큼 줄인다', () => {
    expect(fitFontPx(14, 200, 250)).toBe(11.2);
  });

  it('가장 작은 크기 아래로는 줄이지 않는다', () => {
    expect(fitFontPx(14, 100, 400)).toBe(10);
  });

  it('칸 폭을 아직 재지 못했으면 그대로 둔다', () => {
    expect(fitFontPx(14, 0, 300)).toBeNull();
  });
});
