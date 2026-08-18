import { describe, expect, it } from 'vitest';

import { duplicateRuleIds } from './duplicate-badge';
import { RULE_WAREHOUSE_WIDE, RULE_WITH_LOCATION, ruleViewFixtures } from './fixtures';

const idsOf = (...rules: Parameters<typeof duplicateRuleIds>[0][number][]): number[] =>
  [...duplicateRuleIds(rules)].sort((left, right) => left - right);

describe('duplicateRuleIds', () => {
  /** 합성 자료 넷은 조합이 모두 달라 중복이 없다 — 기준선을 먼저 못 박는다. */
  it('중복이 없으면 아무 번호도 내지 않는다', () => {
    expect(idsOf(...ruleViewFixtures)).toEqual([]);
  });

  /**
   * 판정 축은 **(품목·창고·위치·우선순위)** 넷이다(공유계약 B-12 · 이슈 §6).
   * 계약이 이 조합의 활성 중복을 400으로 막으므로 화면도 같은 축으로 센다.
   */
  it('네 축이 모두 같은 활성 규칙 둘에 표식을 붙인다', () => {
    expect(idsOf(RULE_WITH_LOCATION, { ...RULE_WITH_LOCATION, putawayRuleId: 9005 })).toEqual([
      9001, 9005,
    ]);
  });

  it('우선순위만 달라도 중복이 아니다', () => {
    expect(
      idsOf(RULE_WITH_LOCATION, {
        ...RULE_WITH_LOCATION,
        putawayRuleId: 9005,
        priorityNo: 11,
      }),
    ).toEqual([]);
  });

  it('위치만 달라도 중복이 아니다', () => {
    expect(
      idsOf(RULE_WITH_LOCATION, {
        ...RULE_WITH_LOCATION,
        putawayRuleId: 9005,
        locationId: 9302,
      }),
    ).toEqual([]);
  });

  /**
   * **위치를 비운 규칙끼리는 서로 중복이다.** 위치가 없는 것이 아니라 「창고 전체」라는
   * 확정된 값이므로 같은 값끼리 겹친다.
   */
  it('위치를 비운 규칙끼리는 중복이다', () => {
    expect(idsOf(RULE_WAREHOUSE_WIDE, { ...RULE_WAREHOUSE_WIDE, putawayRuleId: 9006 })).toEqual([
      9002, 9006,
    ]);
  });

  /**
   * **꺼진 규칙은 세지 않는다.** 계약이 막는 것은 활성 중복이고, 꺼진 규칙을 중복으로 표시하면
   * 정상 운용(끄고 새로 등록)이 잘못으로 보인다.
   */
  it('꺼진 규칙은 중복으로 세지 않는다', () => {
    expect(
      idsOf(RULE_WITH_LOCATION, {
        ...RULE_WITH_LOCATION,
        putawayRuleId: 9005,
        isActive: false,
      }),
    ).toEqual([]);
  });

  it('꺼진 규칙끼리 겹쳐도 표식을 붙이지 않는다', () => {
    const off = { ...RULE_WITH_LOCATION, isActive: false };

    expect(idsOf(off, { ...off, putawayRuleId: 9005 })).toEqual([]);
  });

  /** 셋 이상 겹치면 셋 다 표식을 받는다 — 하나만 남기면 어느 것이 「원본」인지 화면이 지어낸다. */
  it('셋이 겹치면 셋 다 표식을 받는다', () => {
    expect(
      idsOf(
        RULE_WITH_LOCATION,
        { ...RULE_WITH_LOCATION, putawayRuleId: 9005 },
        { ...RULE_WITH_LOCATION, putawayRuleId: 9006 },
      ),
    ).toEqual([9001, 9005, 9006]);
  });

  /**
   * ⚠ **이 판정은 넘겨받은 목록 안의 사실이다.** 쪽이 다르면 못 본다 — 그 한계를 화면 문구가
   * 말하지 않고(과잉 표시 금지), 저장 차단은 조준 조회가 맡는다(단위 ③).
   */
  it('넘긴 목록 밖의 규칙은 판정에 들어오지 않는다', () => {
    expect(idsOf(RULE_WITH_LOCATION)).toEqual([]);
  });
});
