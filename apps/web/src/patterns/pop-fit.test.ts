import { describe, expect, it } from 'vitest';

import { fitScale } from './pop-fit';

describe('POP 화면 배율', () => {
  it('옮기지 않은 화면은 1024×768 기준 그대로다', () => {
    expect(fitScale(1920, 1080)).toBe(1);
    expect(fitScale(1092, 614)).toBeCloseTo(614 / 768);
  });

  it('작업장 콘솔은 1920×1080 기준으로 줄이기만 한다', () => {
    expect(fitScale(1920, 1080, 'console')).toBe(1);
    /* 표시 배율 150% 단말 — 1920×1080 패널의 CSS 크기가 1280×720 이 된다. */
    expect(fitScale(1280, 720, 'console')).toBeCloseTo(2 / 3);
    expect(fitScale(3840, 2160, 'console')).toBe(1);
  });
});
