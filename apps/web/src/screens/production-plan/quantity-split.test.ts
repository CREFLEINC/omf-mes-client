import { describe, expect, it } from 'vitest';
import { splitPlanQuantity } from './quantity-split';

describe('계획 분할 수량', () => {
  it('소수 단위의 수량을 손실 없이 분할한다', () => {
    expect(splitPlanQuantity(0.75, 0.25, 2)).toEqual({ remaining: 0.5, split: 0.25 });
    expect(splitPlanQuantity(0.3, 0.1, 1)).toEqual({ remaining: 0.2, split: 0.1 });
    expect(splitPlanQuantity(0.000003, 0.000001, 6)).toEqual({
      remaining: 0.000002,
      split: 0.000001,
    });
  });
  it('단위 자릿수와 원수량 경계를 지킨다', () => {
    expect(splitPlanQuantity(10, 0.5, 0)).toBeNull();
    expect(splitPlanQuantity(2_000_000_000_000_000, 1_000_000_000_000_000.5, 0)).toBeNull();
    expect(splitPlanQuantity(0.75, 0.001, 2)).toBeNull();
    for (const value of [0, -1, 10, 11, NaN, Infinity])
      expect(splitPlanQuantity(10, value)).toBeNull();
    expect(splitPlanQuantity(10, 1, 7)).toBeNull();
    expect(splitPlanQuantity(Number.MAX_SAFE_INTEGER, 1, 6)).toBeNull();
  });
});
