import { messages } from '@omf-mes/i18n';
import { describe, expect, it } from 'vitest';

import {
  activationActionOf,
  activationIntentOf,
  isIntentReversed,
  judgeRemainingCoverage,
  type ActivationIntent,
} from './activation-guard';
import type { DuplicateCheck, DuplicateProbe } from './duplicate-check';
import { ruleFixtureAt } from './fixtures';
import type { PutawayRule } from './types';

const t = messages.putawayRule;

const CLEAR: DuplicateCheck = { kind: 'clear' };
const BLOCKED: DuplicateCheck = { kind: 'blocked', existingCount: 2 };

/** 규칙 9001 — 창고 9201 · 품목 9101 · 사용 중. 조준 조회가 실어 오는 모양 그대로다. */
const ACTIVE_RULE = ruleFixtureAt(9001);
/** 규칙 9003 — 같은 창고·품목의 **꺼진** 규칙. 「남는 규칙」에 세면 안 된다. */
const INACTIVE_RULE = ruleFixtureAt(9003);
/** 규칙 9002 — 같은 창고의 **다른 품목**. 품목이 다르면 이 품목의 덮개가 아니다. */
const OTHER_ITEM_RULE = ruleFixtureAt(9002);

const probeOf = (
  items: PutawayRule[],
  overrides: Partial<DuplicateProbe> = {},
): DuplicateProbe => ({
  items,
  total: items.length,
  isLoading: false,
  isError: false,
  ...overrides,
});

const COVERAGE_TARGET = { itemId: 9101, warehouseId: 9201, selfRuleId: 9001 };

describe('activationIntentOf — 지금 낼 수 있는 전환', () => {
  it('켜져 있으면 끄기다', () => {
    expect(activationIntentOf(true)).toBe<ActivationIntent>('deactivate');
  });

  it('꺼져 있으면 켜기다', () => {
    expect(activationIntentOf(false)).toBe<ActivationIntent>('activate');
  });

  /**
   * ⭐ **상세가 오기 전에는 어느 쪽도 아니다.**
   *
   * 목록 응답에는 잠금 토큰이 없어 행에서 곧바로 끄거나 켤 수 없다(위험 R2). 사용 여부를
   * 모르는 상태를 `false`로 접으면 화면이 「다시 사용」을 세우는데, 그것은 **확인하지 않은
   * 상태를 단언하는 것**이고 그대로 누르면 이미 켜진 규칙에 `:activate`가 나간다.
   */
  it('상세가 오기 전에는 어느 전환도 낼 수 없다', () => {
    expect(activationIntentOf(null)).toBeNull();
  });
});

/**
 * 「응답을 받지 못해 바뀌었는지 알 수 없다」가 **언제 거짓이 되는가**를 정하는 축이다.
 * 화면의 두 표면(창을 열 때 걷기 · 구획에 그리기)이 이 하나를 읽으므로 여기서 잰다.
 */
describe('isIntentReversed — 보낸 갈래가 뒤집혔는가', () => {
  it('보낸 갈래와 다른 갈래를 겨누면 뒤집힌 것이다', () => {
    expect(isIntentReversed('deactivate', 'activate')).toBe(true);
    expect(isIntentReversed('activate', 'deactivate')).toBe(true);
  });

  /** 같은 갈래는 **아직 아무것도 확인되지 않은 것**이다 — 그때 안내는 그대로 참이다. */
  it('보낸 갈래와 같으면 뒤집힌 것이 아니다', () => {
    expect(isIntentReversed('deactivate', 'deactivate')).toBe(false);
  });

  /**
   * ⛔ **보낸 것이 없으면 확인된 것도 없다.** 잠금 토큰이 없어 요청이 나가기도 전에 멈춘
   * 갈래가 여기 든다 — 이것을 「뒤집혔다」로 읽으면 **저장을 시작조차 못 했다는 사실이 걷혀**
   * 사용자는 아무 일도 없었다고 읽는다.
   */
  it('아직 아무것도 보내지 않았으면 뒤집힌 것이 아니다', () => {
    expect(isIntentReversed(null, 'deactivate')).toBe(false);
    expect(isIntentReversed(null, 'activate')).toBe(false);
  });
});

describe('activationActionOf — 지금 낼 수 있는 손잡이', () => {
  /**
   * **막힘과 사유가 한 값에서 나온다** — 「잠겼는데 사유가 없다」를 타입이 표현하지 못하게
   * 한다(배치 규범 4). 받는 쪽이 사유를 한 벌 더 갖게 두면 그 사본이 언젠가 갈린다.
   */
  it('상세가 오기 전에는 중립 갈래로 막히고 잠금 토큰 사유가 붙는다', () => {
    expect(activationActionOf({ intent: null, duplicate: CLEAR })).toEqual({
      kind: 'blocked',
      intent: null,
      reason: t.actionReasons.activationNeedsDetail,
    });
  });

  /**
   * **끄기는 막지 않는다.** 계약에 `:deactivate`의 400이 아예 없어 업무 규칙으로 막히지
   * 않는다 — 화면이 대신 막으면 계약에 없는 규칙을 화면이 지어내는 것이다.
   */
  it('끄기는 활성 중복이 있어도 열린다', () => {
    expect(activationActionOf({ intent: 'deactivate', duplicate: BLOCKED })).toEqual({
      kind: 'open',
      intent: 'deactivate',
    });
  });

  /** 짝 방향 — **같은 중복에서 켜기는 막힌다.** 없으면 「아무것도 막지 않는다」와 구별되지 않는다. */
  it('켜기는 같은 중복에서 막히고 건수를 사유에 싣는다', () => {
    expect(activationActionOf({ intent: 'activate', duplicate: BLOCKED })).toEqual({
      kind: 'blocked',
      intent: 'activate',
      reason: t.actionReasons.activateDuplicate(2),
    });
  });

  it('켜기도 중복이 없으면 열린다', () => {
    expect(activationActionOf({ intent: 'activate', duplicate: CLEAR })).toEqual({
      kind: 'open',
      intent: 'activate',
    });
  });

  /**
   * **판정 불가는 막지 않는다**(C3-9와 같은 잣대). 계약이 같은 조건을 다시 검사하므로
   * 확인하지 못한 것을 이유로 막으면 조회 실패 하나가 마스터 관리를 멈춘다.
   */
  it.each(['loading', 'failed', 'truncated', 'incomplete'] as const)(
    '켜기는 판정이 %s여도 열려 있다',
    (reason) => {
      expect(
        activationActionOf({ intent: 'activate', duplicate: { kind: 'unknown', reason } }),
      ).toEqual({ kind: 'open', intent: 'activate' });
    },
  );
});

describe('judgeRemainingCoverage — 끄고 난 뒤 남는 덮개', () => {
  /**
   * ⭐ **이 판정이 끄기 확인 창의 문면을 가른다.**
   *
   * 「끄면 위치 검증 없이 통과합니다」를 갈래 없이 늘 세우면, 같은 품목에 다른 활성 규칙이
   * 남는 경우 화면이 확인하지 않은 사실을 단언한다.
   */
  it('자기 자신을 빼고 남는 것이 없으면 마지막 규칙이다', () => {
    expect(judgeRemainingCoverage(probeOf([ACTIVE_RULE]), COVERAGE_TARGET)).toEqual({
      kind: 'none',
    });
  });

  it('자기 말고 사용 중인 규칙이 있으면 건수를 낸다', () => {
    const sibling: PutawayRule = { ...ACTIVE_RULE, putawayRuleId: 9005, priorityNo: 50 };

    expect(judgeRemainingCoverage(probeOf([ACTIVE_RULE, sibling]), COVERAGE_TARGET)).toEqual({
      kind: 'some',
      count: 1,
    });
  });

  /** 꺼진 규칙은 덮개가 아니다 — 세면 「남는다」가 거짓이 된다. */
  it('꺼진 규칙은 남는 규칙으로 세지 않는다', () => {
    expect(judgeRemainingCoverage(probeOf([ACTIVE_RULE, INACTIVE_RULE]), COVERAGE_TARGET)).toEqual({
      kind: 'none',
    });
  });

  /**
   * ⭐ **범위가 어긋나면 가장 약한 쪽으로 접는다.**
   *
   * 이 함수는 **조준 조회가 어느 축으로 열렸는지 모른다** — 조회는 폼 값으로 열리고 판정은
   * 서버 값으로 겨눈다. 둘이 갈리는 날 재검 필터가 전건을 떨어뜨리는데, 그때 `none`을 내면
   * **세 갈래 중 가장 센 단언**(「이것뿐입니다 · 검증 없이 통과합니다」)이 조용히 거짓이 된다.
   *
   * 그래서 재검에 걸린 행이 **하나라도 있으면** 셈을 하지 않고 「확인하지 못했다」로 낸다 —
   * 안전장치가 **틀리는 방향을 가장 나쁜 쪽으로 고정**하지 않게 한다.
   */
  it('다른 품목의 규칙이 섞여 오면 세지 않고 판정하지 못했다고 한다', () => {
    expect(
      judgeRemainingCoverage(probeOf([ACTIVE_RULE, OTHER_ITEM_RULE]), COVERAGE_TARGET),
    ).toEqual({ kind: 'unknown', reason: 'outOfScope' });
  });

  it('다른 창고의 규칙이 섞여 오면 세지 않고 판정하지 못했다고 한다', () => {
    const elsewhere: PutawayRule = { ...ACTIVE_RULE, putawayRuleId: 9006, warehouseId: 9202 };

    expect(judgeRemainingCoverage(probeOf([ACTIVE_RULE, elsewhere]), COVERAGE_TARGET)).toEqual({
      kind: 'unknown',
      reason: 'outOfScope',
    });
  });

  /**
   * 범위 어긋남이 **셈보다 앞이다** — 뒤에 두면 어긋난 자료로 센 수가 그대로 답이 된다
   * (「N건 더 남습니다」는 세 갈래 중 둘째로 센 단언이다).
   */
  it('남는 규칙이 있어도 범위가 어긋나면 건수를 내지 않는다', () => {
    const sibling: PutawayRule = { ...ACTIVE_RULE, putawayRuleId: 9005, priorityNo: 50 };

    expect(
      judgeRemainingCoverage(probeOf([ACTIVE_RULE, sibling, OTHER_ITEM_RULE]), COVERAGE_TARGET),
    ).toEqual({ kind: 'unknown', reason: 'outOfScope' });
  });

  /**
   * 순서가 뜻을 정한다 — **미완성 · 실패 · 미도착 · 잘림이 셈보다 앞선다.** 넷 중 하나라도
   * 참인데 「마지막이다」나 「남는다」로 답하면 확인하지 않은 것을 확인했다고 말하게 된다.
   */
  it('겨눌 조합이 없으면 미완성이다', () => {
    expect(
      judgeRemainingCoverage(probeOf([]), { itemId: null, warehouseId: 9201, selfRuleId: null }),
    ).toEqual({ kind: 'unknown', reason: 'incomplete' });
  });

  it('조회가 실패했으면 판정하지 않는다', () => {
    expect(judgeRemainingCoverage(probeOf([], { isError: true }), COVERAGE_TARGET)).toEqual({
      kind: 'unknown',
      reason: 'failed',
    });
  });

  it('조회가 아직 오지 않았으면 판정하지 않는다', () => {
    expect(judgeRemainingCoverage(probeOf([], { isLoading: true }), COVERAGE_TARGET)).toEqual({
      kind: 'unknown',
      reason: 'loading',
    });
  });

  /** 잘린 목록으로 세면 「이것이 마지막이다」가 실제보다 자주 참이 된다. */
  it('목록이 잘렸으면 판정하지 않는다', () => {
    expect(judgeRemainingCoverage(probeOf([ACTIVE_RULE], { total: 300 }), COVERAGE_TARGET)).toEqual(
      { kind: 'unknown', reason: 'truncated' },
    );
  });

  /** 미완성이 조회 상태보다 앞이다 — 열리지도 않은 조회의 상태를 답으로 내지 않는다. */
  it('미도착이면서 미완성이면 미완성이다', () => {
    expect(
      judgeRemainingCoverage(probeOf([], { isLoading: true }), {
        itemId: null,
        warehouseId: null,
        selfRuleId: null,
      }),
    ).toEqual({ kind: 'unknown', reason: 'incomplete' });
  });
});
