import { describe, expect, it } from 'vitest';

import { DPI, LABEL_HEIGHT, LABEL_WIDTH, mm } from './geometry';

/**
 * 라벨 자의 감지기.
 *
 * ⭐ **값이 바뀌는 것을 «사고»로 다룬다.** 이 수는 저장소 밖의 둘과 맞춰 둔 것이다 —
 *    씨앗의 `tools/mock/label-layout.mjs` 와 실물 TSPL 의 `apps/pop/src/main/tspl-label.ts`.
 *    여기만 바뀌면 같은 라벨지에 찍히는 라벨들의 자가 갈려 한쪽이 종이를 벗어난다.
 *    그래서 「고쳐도 되는 값」이 아니라 **못박은 값**으로 둔다.
 */

describe('라벨 자', () => {
  it('203dpi 다 — 현장 라벨 프린터의 해상도', () => {
    expect(DPI).toBe(203);
  });

  it('서식은 80 × 30 mm = 639 × 240 점이다', () => {
    expect([LABEL_WIDTH, LABEL_HEIGHT]).toEqual([639, 240]);
    expect(LABEL_WIDTH).toBe(mm(80));
    expect(LABEL_HEIGHT).toBe(mm(30));
  });

  it('밀리미터를 점으로 옮긴다 — 점은 정수라 반올림한다', () => {
    expect(mm(0)).toBe(0);
    expect(mm(25.4)).toBe(203);
    /* 소수 밀리미터도 받는다 — 서식이 1.5mm 같은 자리를 쓴다. */
    expect(mm(1.5)).toBe(Math.round((1.5 / 25.4) * 203));
    expect(Number.isInteger(mm(1.5))).toBe(true);
  });

  it('길이가 늘면 점도 는다', () => {
    expect(mm(10)).toBeGreaterThan(mm(5));
  });
});
