import { describe, expect, it } from 'vitest';

import { panelScale } from './panel-scale';

describe('panelScale', () => {
  it('설계 예산 크기(1024×768) 단말에서는 키우지 않는다', () => {
    expect(panelScale(1024, 768)).toBe(1);
  });

  it('예산보다 작은 화면에서는 줄이지 않는다 — 줄이는 것은 pop-fit 의 몫이다', () => {
    expect(panelScale(1092, 614)).toBe(1);
  });

  it('큰 화면에서는 좁은 쪽에 맞춰 키운다', () => {
    /* 1920/1136 = 1.690 · 1080/640 = 1.6875 → 세로가 정한다. */
    expect(panelScale(1920, 1080)).toBeCloseTo(1.6875, 4);
  });

  it('아주 큰 화면에서도 상한을 넘지 않는다', () => {
    expect(panelScale(3840, 2160)).toBe(2);
  });

  it('크기를 모르는 동안에는 1 이다', () => {
    expect(panelScale(0, 0)).toBe(1);
  });
});
