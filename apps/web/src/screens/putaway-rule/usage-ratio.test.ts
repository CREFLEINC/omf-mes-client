import { describe, expect, it } from 'vitest';

import { toBalanceView } from './balance-lookup';
import {
  OWNERSHIP_A,
  OWNERSHIP_B,
  RULE_WAREHOUSE_WIDE,
  RULE_WITH_LOCATION,
  balanceRow,
} from './fixtures';
import { judgeUsage } from './usage-ratio';

const rowsOf = (...overrides: Parameters<typeof balanceRow>[0][]) =>
  overrides.map((override) => toBalanceView(balanceRow(override)));

describe('judgeUsage — 계산할 수 있을 때', () => {
  /** 단위가 같고 소유가 하나일 때만 비율이 선다. 용량 500 · 적재 320 → 64%다. */
  it('단위가 같고 소유가 하나면 비율을 낸다', () => {
    expect(judgeUsage(RULE_WITH_LOCATION, rowsOf({ onHandQty: 320 }))).toEqual({
      kind: 'ratio',
      percent: 64,
      qty: 320,
      uomId: 9401,
    });
  });

  /** 같은 소유·같은 단위의 줄이 여럿이면 더한다 — 합치면 안 되는 축은 소유뿐이다. */
  it('같은 소유·같은 단위의 줄은 더한다', () => {
    const judgment = judgeUsage(
      RULE_WAREHOUSE_WIDE,
      rowsOf(
        { itemId: 9102, locationId: 9301, onHandQty: 300, uomId: 9402 },
        { itemId: 9102, locationId: 9302, onHandQty: 300, uomId: 9402 },
      ),
    );

    /* 창고 전체 규칙(용량 1200)의 두 위치 합 600 → 50%다. */
    expect(judgment).toEqual({ kind: 'ratio', percent: 50, qty: 600, uomId: 9402 });
  });

  /**
   * **잔액이 0인 것과 잔액 줄이 없는 것은 다르다.** 0은 재고를 확인한 결과이므로 비율 0%가
   * 서고, 줄이 없는 것은 확인 자체가 없는 상태다.
   */
  it('잔액 0은 비율 0%다 — 줄이 없는 것과 다르다', () => {
    expect(judgeUsage(RULE_WITH_LOCATION, rowsOf({ onHandQty: 0 }))).toEqual({
      kind: 'ratio',
      percent: 0,
      qty: 0,
      uomId: 9401,
    });
  });

  /** 100%를 넘는 비율을 자르지 않는다 — 자르는 것은 막대뿐이고 값은 그대로 넘긴다. */
  it('100%를 넘어도 실제 비율을 그대로 낸다', () => {
    expect(judgeUsage(RULE_WITH_LOCATION, rowsOf({ onHandQty: 640 }))).toMatchObject({
      kind: 'ratio',
      percent: 128,
    });
  });
});

describe('judgeUsage — 잔액 줄이 없을 때', () => {
  /** 「없다」는 확정된 사실이다 — 조회가 성공했고 그 조건의 줄이 한 줄도 없다. */
  it('줄이 하나도 없으면 없음이다', () => {
    expect(judgeUsage(RULE_WITH_LOCATION, [])).toEqual({ kind: 'none' });
  });
});

describe('judgeUsage — 소유 구분이 갈릴 때', () => {
  /**
   * **자사 재고와 고객 지급품을 더한 비율은 오독이다**(공유계약 L-7 · 부록 B Q3).
   * 합치지 않고 소유별로 나눠 낸다.
   */
  it('소유가 둘이면 비율을 만들지 않고 소유별로 나눈다', () => {
    expect(
      judgeUsage(
        RULE_WITH_LOCATION,
        rowsOf(
          { ownershipTypeCode: OWNERSHIP_A, onHandQty: 300 },
          { ownershipTypeCode: OWNERSHIP_B, onHandQty: 120 },
        ),
      ),
    ).toEqual({
      kind: 'incomparable',
      reason: 'ownership',
      groups: [
        { ownershipTypeCode: OWNERSHIP_A, qty: 300, uomId: 9401 },
        { ownershipTypeCode: OWNERSHIP_B, qty: 120, uomId: 9401 },
      ],
    });
  });

  /**
   * **소유가 단위보다 앞선다.** 합치는 것 자체가 금지된 축이므로 단위를 보기 전에 접는다 —
   * 순서를 뒤집으면 소유가 섞인 잔액이 「단위가 달라서」로 설명되고, 사용자는 단위만 맞추면
   * 비율이 선다고 읽는다.
   */
  it('소유와 단위가 함께 갈리면 소유로 판정한다', () => {
    expect(
      judgeUsage(
        RULE_WITH_LOCATION,
        rowsOf(
          { ownershipTypeCode: OWNERSHIP_A, uomId: 9401, onHandQty: 300 },
          { ownershipTypeCode: OWNERSHIP_B, uomId: 9402, onHandQty: 120 },
        ),
      ),
    ).toMatchObject({ kind: 'incomparable', reason: 'ownership' });
  });

  /** 소유가 하나면 그 코드는 갈래를 가르지 않는다 — 자사만 있는 잔액도 정상 비율이 선다. */
  it('소유가 하나뿐이면 비율이 선다', () => {
    expect(
      judgeUsage(RULE_WITH_LOCATION, rowsOf({ ownershipTypeCode: OWNERSHIP_B })),
    ).toMatchObject({ kind: 'ratio' });
  });
});

describe('judgeUsage — 단위가 갈릴 때', () => {
  /**
   * **환산하지 않는다**(이슈 §6). 환산 정의가 없는 조합이 있고, 억지로 맞춘 숫자를 운영자가
   * 근거로 삼는다. 두 값을 단위와 함께 그대로 둔다.
   */
  it('규칙 단위와 잔액 단위가 다르면 비율을 만들지 않는다', () => {
    expect(judgeUsage(RULE_WITH_LOCATION, rowsOf({ uomId: 9402, onHandQty: 300 }))).toEqual({
      kind: 'incomparable',
      reason: 'unit',
      groups: [{ ownershipTypeCode: OWNERSHIP_A, qty: 300, uomId: 9402 }],
    });
  });

  /** 잔액 줄끼리 단위가 갈려도 더할 수 없다 — 단위마다 나눠 낸다. */
  it('잔액 줄끼리 단위가 갈리면 단위별로 나눈다', () => {
    expect(
      judgeUsage(
        RULE_WITH_LOCATION,
        rowsOf({ uomId: 9401, onHandQty: 200 }, { uomId: 9402, onHandQty: 30 }),
      ),
    ).toEqual({
      kind: 'incomparable',
      reason: 'unit',
      groups: [
        { ownershipTypeCode: OWNERSHIP_A, qty: 200, uomId: 9401 },
        { ownershipTypeCode: OWNERSHIP_A, qty: 30, uomId: 9402 },
      ],
    });
  });
});

describe('judgeUsage — 용량이 나눌 수 없는 값일 때', () => {
  /**
   * 계약은 「0 은 넣을 수 없다」고 적었지만 자료가 0이면 나눌 수 없다 — 나누면 화면에
   * 무한대가 서고, 그 수를 운영자가 사용률로 읽는다.
   */
  it('용량이 0이면 비율을 만들지 않는다', () => {
    expect(
      judgeUsage({ ...RULE_WITH_LOCATION, capacityQty: 0 }, rowsOf({ onHandQty: 320 })),
    ).toEqual({
      kind: 'incomparable',
      reason: 'capacity',
      groups: [{ ownershipTypeCode: OWNERSHIP_A, qty: 320, uomId: 9401 }],
    });
  });

  /** 음수 용량도 같다. 방향이 뒤집힌 비율을 그리느니 만들지 않는 편이 정확하다. */
  it('용량이 음수여도 비율을 만들지 않는다', () => {
    expect(
      judgeUsage({ ...RULE_WITH_LOCATION, capacityQty: -5 }, rowsOf({ onHandQty: 320 })),
    ).toMatchObject({ kind: 'incomparable', reason: 'capacity' });
  });

  /**
   * **용량 판정이 「줄이 없다」보다 뒤에 선다.** 잔액 줄이 없으면 견줄 대상 자체가 없으므로
   * 용량이 0이어도 말할 것은 「없음」이다 — 순서를 뒤집으면 확인할 잔액도 없는 자리에
   * 용량 탓을 하는 문구가 선다.
   */
  it('용량이 0이고 잔액 줄도 없으면 없음이다', () => {
    expect(judgeUsage({ ...RULE_WITH_LOCATION, capacityQty: 0 }, [])).toEqual({ kind: 'none' });
  });
});

describe('judgeUsage — 축이 다른 줄', () => {
  /**
   * 요청은 위치 축으로 묶었는데 응답에 다른 축의 줄이 섞이면 **같은 재고를 두 번 센다.**
   * 그 판정은 `balance-lookup`이 하고 이 함수에는 오지 않는다 — 여기서 다시 재면 같은 사실을
   * 두 자리에서 판정하게 되고 한쪽만 고쳐진다.
   */
  it('축 섞임은 이 함수가 다시 판정하지 않는다', () => {
    expect(judgeUsage(RULE_WITH_LOCATION, rowsOf({ groupBy: 'ITEM', onHandQty: 320 }))).toEqual({
      kind: 'ratio',
      percent: 64,
      qty: 320,
      uomId: 9401,
    });
  });
});
