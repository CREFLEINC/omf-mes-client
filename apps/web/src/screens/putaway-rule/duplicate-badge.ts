import type { RuleView } from './types';

/**
 * 같은 조합의 활성 규칙이 둘 이상인 행을 가려낸다.
 *
 * 데이터에 유일 제약이 없어 **계약이 400으로 막는 조합**이 있다 — (품목·창고·위치·우선순위)가
 * 모두 같은 활성 규칙 둘이다(공유계약 B-12 · 이슈 §6). 이미 들어와 있는 중복은 화면이 먼저
 * 보여야 한다: 그 상태에서는 어느 규칙이 이기는지 데이터가 정하지 않으므로 현장 적치가
 * 무엇을 따르는지 아무도 말할 수 없다.
 *
 * ## 이 판정이 말하는 범위
 *
 * ⚠ **넘겨받은 목록 안의 사실만 말한다.** 지금 보이는 쪽 밖의 중복은 보지 못한다 —
 * 그 한계를 화면 문구가 말하지 않는다. 「이 쪽에서만 본 것」이라고 덧붙이면 표식이 없는 행마다
 * 사용자가 다시 의심해야 하고, 그것은 화면이 해 줄 수 없는 일을 요구하는 것이다.
 * **저장을 막는 것은 등록·수정의 조준 조회**가 맡는다(단위 ③) — 두 자리를 등가로 보지 않는다.
 *
 * ## 꺼진 규칙은 세지 않는다
 *
 * 계약이 막는 것은 활성 중복이다. 꺼진 규칙을 중복으로 표시하면 **정상 운용**(끄고 새로
 * 등록해 두는 것)이 잘못으로 보인다.
 *
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 파일을 참조하지 않는다.
 */

/**
 * 판정 축 넷을 한 열쇠로 접는다.
 *
 * 위치를 비운 규칙은 `null`이 그대로 열쇠에 실린다 — **값이 없는 것이 아니라 「창고 전체」라는
 * 확정된 값**이라 같은 값끼리 겹쳐야 한다. 나머지 축이 전부 숫자라 `null`과 부딪히지 않는다.
 */
const keyOf = (rule: RuleView): string =>
  [rule.itemId, rule.warehouseId, rule.locationId, rule.priorityNo].map(String).join('|');

export const duplicateRuleIds = (rules: readonly RuleView[]): ReadonlySet<number> => {
  const byKey = new Map<string, number[]>();

  for (const rule of rules) {
    if (!rule.isActive) continue;

    const key = keyOf(rule);

    byKey.set(key, [...(byKey.get(key) ?? []), rule.putawayRuleId]);
  }

  const duplicated = new Set<number>();

  for (const ids of byKey.values()) {
    /* 셋이 겹치면 셋 다 받는다 — 하나를 빼면 어느 것이 「원본」인지 화면이 지어내게 된다. */
    if (ids.length > 1) for (const id of ids) duplicated.add(id);
  }

  return duplicated;
};
