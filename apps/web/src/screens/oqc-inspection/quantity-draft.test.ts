import { describe, expect, it } from 'vitest';

import {
  canConfirm,
  formatMicro,
  toMicro,
  toSendableNumber,
  toTotals,
  validateQuantities,
} from './quantity-draft';

/**
 * ⭐ **집중 지점 V4 — 합계 제약.**
 *
 * 이 화면의 저장 가능 여부가 여기 한 함수에 달려 있고, 부동소수로 재면 **눈에는 딱 맞는데 저장
 * 버튼이 죽어 있는** 화면이 만들어진다 — 사용자는 무엇이 틀렸는지 영영 모른다. 「틀려도 조용한
 * 것」의 정확한 정의라 감지기를 여기 세운다.
 */
describe('toTotals — 부동소수로 재면 조용히 틀리는 자리', () => {
  /*
   * ⚠ **값을 아무거나 고르면 감지기가 헛통과한다.** `0.1 + 0.2 + 0.7 === 1` 은 IEEE-754 에서도
   * «참»이라 부동소수 합으로 바꿔도 통과한다 — 결함 재주입으로 실측했다. 부동소수에서 실제로
   * 어긋나는 값을 골라야 이 시험이 무언가를 지킨다.
   */
  it.each([
    { accepted: '0.1', rejected: '0.2', inspected: 0.3, floatSum: 0.30000000000000004 },
    { accepted: '1.1', rejected: '2.2', inspected: 3.3, floatSum: 3.3000000000000003 },
  ])('$accepted + $rejected = $inspected 을 일치로 판정한다', (row) => {
    /* 이 자리가 부동소수로 재면 어긋난다는 사실을 시험이 함께 못박는다. */
    expect(Number(row.accepted) + Number(row.rejected)).toBe(row.floatSum);

    const totals = toTotals(
      { accepted: row.accepted, rejected: row.rejected, held: '' },
      row.inspected,
    );

    expect(totals.kind).toBe('counted');
    expect(totals.kind === 'counted' && totals.matches).toBe(true);
    expect(canConfirm(totals)).toBe(true);
  });

  it('소수 여섯 자리까지 정확히 센다', () => {
    const totals = toTotals(
      { accepted: '0.000001', rejected: '0.000002', held: '0.000003' },
      0.000006,
    );

    expect(totals.kind === 'counted' && totals.matches).toBe(true);
  });

  it('빈 칸은 0으로 읽는다 — 계약의 기본값이 0이다', () => {
    const totals = toTotals({ accepted: '500', rejected: '', held: '' }, 500);

    expect(totals.kind === 'counted' && totals.matches).toBe(true);
  });

  it('모자란 양·넘긴 양을 숫자로 남긴다 — 사용자가 다시 더하지 않게', () => {
    const short = toTotals({ accepted: '480', rejected: '15', held: '' }, 500);
    const over = toTotals({ accepted: '480', rejected: '15', held: '10' }, 500);

    expect(short.kind === 'counted' && formatMicro(short.remaining)).toBe('5');
    expect(over.kind === 'counted' && formatMicro(-over.remaining)).toBe('5');
  });

  it('한 칸이라도 수량이 아니면 uncountable 이고 「일치합니다」를 말하지 않는다', () => {
    const totals = toTotals({ accepted: 'abc', rejected: '500', held: '' }, 500);

    expect(totals.kind).toBe('uncountable');
    expect(canConfirm(totals)).toBe(false);
  });
});

describe('toMicro', () => {
  it('소수 일곱 자리는 자르지 않고 거절한다 — 조용히 버림하면 넣은 값과 저장되는 값이 달라진다', () => {
    expect(toMicro('1.0000001')).toBeNull();
    expect(toMicro('1.000001')).not.toBeNull();
  });

  it('음수·지수 표기는 수량이 아니다', () => {
    expect(toMicro('-1')).toBeNull();
    expect(toMicro('1e3')).toBeNull();
  });
});

describe('validateQuantities · toSendableNumber', () => {
  it('빈 칸은 잘못된 것이 아니다', () => {
    expect(validateQuantities({ accepted: '', rejected: ' ', held: '0' })).toEqual({
      accepted: false,
      rejected: false,
      held: false,
    });
  });

  it('보내는 값도 화면이 재는 자와 같은 자를 쓴다', () => {
    expect(toSendableNumber('')).toBe(0);
    expect(toSendableNumber('480.500000')).toBe(480.5);
  });
});
