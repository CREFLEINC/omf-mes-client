import { describe, expect, it } from 'vitest';

import {
  canConfirm,
  EMPTY_QUANTITY_DRAFT,
  formatMicro,
  fromServerQty,
  hasQuantityError,
  toMicro,
  toTotals,
  validateQuantities,
} from './quantity-draft';

describe('toMicro', () => {
  it('정수를 마이크로 단위로 옮긴다', () => {
    expect(toMicro('30')).toBe(30_000_000n);
  });

  it('소수 여섯 자리까지 받는다 — 정본이 numeric(20, 6) 이다', () => {
    expect(toMicro('0.000001')).toBe(1n);
  });

  it('일곱째 자리는 자르지 않고 거절한다 — 조용히 버림하면 넣은 값과 저장되는 값이 달라진다', () => {
    expect(toMicro('0.0000001')).toBeNull();
  });

  it.each(['-1', '1e3', 'abc', '', '  ', '1.2.3', '+5'])('수량이 아닌 값(%s)을 거절한다', (raw) => {
    expect(toMicro(raw)).toBeNull();
  });

  it('앞뒤 공백은 값을 가리지 않는다', () => {
    expect(toMicro('  12.5  ')).toBe(12_500_000n);
  });
});

describe('formatMicro', () => {
  it('뒤따르는 0을 걷는다 — 「10.000000」은 읽기 나쁘다', () => {
    expect(formatMicro(10_000_000n)).toBe('10');
  });

  it('의미 있는 소수는 남긴다', () => {
    expect(formatMicro(10_500_000n)).toBe('10.5');
  });

  it('음수 잔여를 그대로 보인다 — 얼마나 넘겼는지가 고쳐야 할 양이다', () => {
    expect(formatMicro(-2_500_000n)).toBe('-2.5');
  });

  it('옮겼다 되돌리면 같은 값이다', () => {
    expect(formatMicro(toMicro('123.456789') as bigint)).toBe('123.456789');
  });
});

/** 셀 수 있다고 단언하고 값을 꺼낸다 — 갈래를 매번 좁히지 않으려고 둔다. */
const counted = (totals: ReturnType<typeof toTotals>) => {
  if (totals.kind !== 'counted') throw new Error('셀 수 있어야 하는 초안인데 uncountable 이다');
  return totals;
};

describe('toTotals — 합계 제약', () => {
  it('빈 칸은 0으로 읽는다 — 계약의 기본값이 0이다', () => {
    const totals = counted(toTotals(EMPTY_QUANTITY_DRAFT, 500));

    expect(formatMicro(totals.sum)).toBe('0');
    expect(formatMicro(totals.remaining)).toBe('500');
    expect(totals.matches).toBe(false);
  });

  it('세 칸의 합이 검사수량과 정확히 같으면 일치다', () => {
    const totals = counted(toTotals({ accepted: '480', rejected: '15', held: '5' }, 500));

    expect(totals.matches).toBe(true);
    expect(formatMicro(totals.remaining)).toBe('0');
  });

  it('모자라면 잔여를 양수로 보인다', () => {
    expect(
      formatMicro(counted(toTotals({ accepted: '400', rejected: '0', held: '0' }, 500)).remaining),
    ).toBe('100');
  });

  it('넘기면 잔여를 음수로 보인다 — 0으로 깎으면 얼마나 넘겼는지 다시 세어야 한다', () => {
    const totals = counted(toTotals({ accepted: '600', rejected: '0', held: '0' }, 500));

    expect(formatMicro(totals.remaining)).toBe('-100');
    expect(totals.matches).toBe(false);
  });

  /*
   * ⭐ 이 화면의 유일한 판정을 부동소수로 하면 여기서 깨진다 — 0.1 + 0.2 !== 0.3 이라
   * 눈에는 딱 맞는데 확정이 비활성인 화면이 만들어지고, 사용자는 무엇이 틀렸는지 알 수 없다.
   */
  it('소수 합이 부동소수 오차로 어긋나지 않는다 — 0.1 + 0.2 = 0.3', () => {
    expect(counted(toTotals({ accepted: '0.1', rejected: '0.2', held: '0' }, 0.3)).matches).toBe(
      true,
    );
  });

  it('여섯 자리 소수가 정확히 맞아떨어진다', () => {
    const totals = counted(
      toTotals({ accepted: '0.333333', rejected: '0.333333', held: '0.333334' }, 1),
    );

    expect(totals.matches).toBe(true);
  });

  it('아주 조금 모자라도 일치가 아니다 — 서버가 400 으로 막는 자리를 화면이 먼저 막는다', () => {
    expect(
      counted(toTotals({ accepted: '499.999999', rejected: '0', held: '0' }, 500)).matches,
    ).toBe(false);
  });

  /*
   * ⭐ 리뷰가 잡은 자리다. 0으로 읽고 세면 `abc + 500 + 빈칸 = 500` 이 되어 화면이
   * 「일치합니다」라고 거짓을 말하고, matches 가 확정 가능 여부의 유일한 근거이므로
   * 쓰레기 입력에 확정이 열린다.
   */
  it('한 칸이라도 수량이 아니면 세지 않는다 — 0으로 읽고 세면 「일치합니다」가 거짓이 된다', () => {
    expect(toTotals({ accepted: 'abc', rejected: '500', held: '' }, 500)).toEqual({
      kind: 'uncountable',
    });
  });

  it('셀 수 없으면 확정을 열지 않는다', () => {
    expect(canConfirm(toTotals({ accepted: 'abc', rejected: '500', held: '' }, 500))).toBe(false);
  });

  it('셀 수 있고 일치할 때만 확정을 연다', () => {
    expect(canConfirm(toTotals({ accepted: '480', rejected: '15', held: '5' }, 500))).toBe(true);
    expect(canConfirm(toTotals({ accepted: '480', rejected: '15', held: '4' }, 500))).toBe(false);
  });
});

describe('validateQuantities', () => {
  it('빈 칸은 수량이 아닌 것이 아니다 — 0으로 읽힌다', () => {
    expect(hasQuantityError(validateQuantities(EMPTY_QUANTITY_DRAFT))).toBe(false);
  });

  it('칸마다 따로 잡는다 — 한 칸이 틀렸다고 멀쩡한 칸까지 고치라고 하지 않는다', () => {
    expect(validateQuantities({ accepted: '-1', rejected: '10', held: '' })).toEqual({
      accepted: true,
      rejected: false,
      held: false,
    });
  });
});

describe('fromServerQty', () => {
  it('서버가 준 double 을 정본 자릿수로 옮긴다', () => {
    expect(fromServerQty(30)).toBe(30_000_000n);
  });

  it('부동소수 오차가 실린 값도 정본 자리에 세운다', () => {
    expect(fromServerQty(0.1 + 0.2)).toBe(300_000n);
  });

  it('음수는 부호를 뒤집지 않는다 — abs 로 정상값처럼 만들면 자료의 이상함이 사라진다', () => {
    expect(fromServerQty(-5)).toBe(0n);
  });
});
