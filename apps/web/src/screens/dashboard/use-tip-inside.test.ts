import { describe, expect, it } from 'vitest';

import { tipShiftOf } from './use-tip-inside';

/* omf-all-around#128 — 말풍선이 카드 경계를 넘으면 안쪽으로 붙는다. */
describe('tipShiftOf', () => {
  const card = { left: 100, right: 500 };

  it('안쪽이면 옮기지 않는다', () => {
    expect(tipShiftOf({ left: 120, right: 300 }, card)).toBe(0);
  });

  it('왼쪽 경계를 넘으면 오른쪽으로 민다', () => {
    expect(tipShiftOf({ left: 40, right: 180 }, card)).toBe(60);
  });

  it('오른쪽 경계를 넘으면 왼쪽으로 민다', () => {
    expect(tipShiftOf({ left: 420, right: 560 }, card)).toBe(-60);
  });

  it('카드보다 넓으면 왼쪽 끝에 맞춘다', () => {
    expect(tipShiftOf({ left: 300, right: 800 }, card)).toBe(-200);
  });
});
