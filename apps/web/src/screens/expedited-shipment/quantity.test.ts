import { messages } from '@omf-mes/i18n';
import { describe, expect, it } from 'vitest';

import { formatQty, quantityError, toQuantity, type QuantityLimits } from './quantity';

const t = messages.expeditedShipment.qty;
const limits: QuantityLimits = { lotQty: 500, remainingQty: 300 };

describe('quantityError', () => {
  it('비어 있으면 필수라고 말한다', () => {
    expect(quantityError('', limits)).toBe(t.required);
    expect(quantityError('   ', limits)).toBe(t.required);
  });

  it('수가 아니면 그렇게 말한다', () => {
    expect(quantityError('abc', limits)).toBe(t.notNumber);
    expect(quantityError('-5', limits)).toBe(t.notNumber);
  });

  /*
   * ⚠ 자릿수 상한이 없으면 `1e+21`이 전선에 실리거나 사용자가 친 수와 «다른 값»이 조용히
   * 나간다. 되돌릴 수 없는 원장에 남는 수라 특히 그렇다.
   */
  it('⛔ 자릿수를 넘기면 막는다 — 정밀도를 넘는 수가 조용히 바뀌지 않게 한다', () => {
    expect(quantityError('9999999999999', null)).toBe(t.tooLong);
    expect(quantityError('1.1234567', null)).toBe(t.tooLong);
    expect(quantityError('9007199254740993', null)).toBe(t.tooLong);
  });

  it('0 이하는 막는다', () => {
    expect(quantityError('0', limits)).toBe(t.tooSmall);
    expect(quantityError('0.0', limits)).toBe(t.tooSmall);
  });

  it('소수를 받는다 — 단위마다 소수 자릿수가 있다', () => {
    expect(quantityError('0.5', limits)).toBeUndefined();
    expect(quantityError('299.999999', limits)).toBeUndefined();
  });

  /*
   * ⭐ 두 상한을 «함께» 보인다. 낮은 쪽만 말하면 사용자가 그 값으로 고친 뒤 다른 상한에 다시
   * 걸린다 — 두 번 틀리게 만드는 안내다.
   */
  it('⛔ LOT 수량과 배정 잔여 중 어느 쪽을 넘겨도 두 수를 함께 보인다', () => {
    const overRemaining = quantityError('400', limits);

    expect(overRemaining).toBe(t.overLimit('500', '300'));
    expect(overRemaining).toContain('500');
    expect(overRemaining).toContain('300');
  });

  it('LOT 수량이 더 낮을 때도 두 수를 함께 보인다', () => {
    expect(quantityError('250', { lotQty: 200, remainingQty: 300 })).toBe(
      t.overLimit('200', '300'),
    );
  });

  it('상한과 같으면 통과한다 — 경계는 열려 있다', () => {
    expect(quantityError('300', limits)).toBeUndefined();
  });

  /* 상한을 아직 모르는 동안(LOT·라인 미정)에는 모양만 본다 — 없는 상한으로 막지 않는다. */
  it('상한을 모르면 상한으로 막지 않는다', () => {
    expect(quantityError('999999', null)).toBeUndefined();
  });
});

describe('toQuantity', () => {
  it('통과한 수만 수로 바꾼다', () => {
    expect(toQuantity('300', limits)).toBe(300);
    expect(toQuantity('0.5', limits)).toBe(0.5);
  });

  it('⛔ 통과하지 못하면 수를 만들지 않는다 — 본문이 만들어지지 않는다', () => {
    expect(toQuantity('400', limits)).toBeUndefined();
    expect(toQuantity('', limits)).toBeUndefined();
  });
});

describe('formatQty', () => {
  it('소수 끝에 0을 붙이지 않는다', () => {
    expect(formatQty(500)).toBe('500');
    expect(formatQty(0.5)).toBe('0.5');
  });
});
