import { describe, expect, it } from 'vitest';

import { fitScale } from './pop-fit';

describe('POP 화면 배율', () => {
  it('1920×1080 기준으로 줄이기만 한다', () => {
    expect(fitScale(1920, 1080)).toBe(1);
    /* 표시 배율 150% 단말 — 1920×1080 패널의 CSS 크기가 1280×720 이 된다. */
    expect(fitScale(1280, 720)).toBeCloseTo(2 / 3);
    expect(fitScale(3840, 2160)).toBe(1);
  });

  it('하한 아래로는 줄이지 않는다 — 그때는 스크롤을 받아들인다', () => {
    expect(fitScale(800, 450)).toBe(0.6);
  });
});
