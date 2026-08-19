import { describe, expect, it } from 'vitest';

import { judgeDuplicate, type DuplicateProbe, type DuplicateTarget } from './duplicate-check';
import { ruleFixtureAt } from './fixtures';
import type { PutawayRule } from './types';

/** 규칙 9001 — 품목 9101 · 창고 9201 · 위치 9301 · 우선순위 10 · 사용 중. */
const EXISTING = ruleFixtureAt(9001);

const probe = (
  items: readonly PutawayRule[],
  patch: Partial<DuplicateProbe> = {},
): DuplicateProbe => ({
  items,
  total: items.length,
  isLoading: false,
  isError: false,
  ...patch,
});

/** 9001과 **같은 조합**을 겨눈다. 갈래마다 축 하나만 어긋나게 한다. */
const target = (patch: Partial<DuplicateTarget> = {}): DuplicateTarget => ({
  itemId: 9101,
  warehouseId: 9201,
  locationId: 9301,
  priorityNo: 10,
  selfRuleId: null,
  ...patch,
});

describe('judgeDuplicate — 판정하지 못하는 갈래가 먼저다', () => {
  /**
   * ⭐ **미완성이 조회 상태보다 앞선다.** 겨눌 조합이 없으면 조회가 열리지도 않는다 —
   * 뒤에 두면 **열리지 않은 조회의 「불러오는 중」**이 미완성을 가려, 갓 연 빈 폼이
   * 「확인하지 못했습니다」라고 말하게 된다.
   *
   * 짝을 이루는 두 사실을 **한 탐침에 함께 심는다** — 미도착이면서 미완성인 상태다.
   */
  it('미도착이면서 미완성이면 미완성이다', () => {
    expect(judgeDuplicate(probe([], { isLoading: true }), target({ itemId: null }))).toEqual({
      kind: 'unknown',
      reason: 'incomplete',
    });
  });

  /** 실패·잘림보다도 앞선다 — 셋 다 「조회의 사정」이고 미완성은 그 앞의 사정이다. */
  it.each([
    ['실패', { isError: true }],
    ['잘림', { total: 3 }],
  ])('%s이면서 미완성이어도 미완성이다', (_name, patch) => {
    expect(judgeDuplicate(probe([], patch), target({ priorityNo: null }))).toEqual({
      kind: 'unknown',
      reason: 'incomplete',
    });
  });

  /** 셋 중 하나라도 참인데 「중복 없음」이라 답하면 확인하지 않은 것을 확인했다고 말하는 것이다. */
  it('겨눈 것이 있으면 실패가 가장 앞선다', () => {
    expect(judgeDuplicate(probe([EXISTING], { isError: true, isLoading: true }), target())).toEqual(
      {
        kind: 'unknown',
        reason: 'failed',
      },
    );
  });

  it('미도착이 중복 판정보다 앞선다', () => {
    expect(judgeDuplicate(probe([EXISTING], { isLoading: true }), target())).toEqual({
      kind: 'unknown',
      reason: 'loading',
    });
  });

  /** 잘린 목록에서 「없다」는 못 본 것이다 — 서버가 밝힌 전체 건수와 견준다. */
  it('잘림이 중복 판정보다 앞선다', () => {
    expect(judgeDuplicate(probe([], { total: 3 }), target())).toEqual({
      kind: 'unknown',
      reason: 'truncated',
    });
  });

  /** 겨눌 조합이 아직 없다 — 만들지도 않은 조합을 확인했다고 말하지 않는다. */
  it.each([
    ['품목', { itemId: null }],
    ['창고', { warehouseId: null }],
    ['우선순위', { priorityNo: null }],
  ])('%s이 정해지지 않으면 미완성이다', (_name, patch) => {
    expect(judgeDuplicate(probe([]), target(patch))).toEqual({
      kind: 'unknown',
      reason: 'incomplete',
    });
  });

  /** 위치의 `null`은 **「창고 전체」라는 확정된 값**이라 미완성이 아니다. */
  it('위치가 비어 있는 것은 미완성이 아니다', () => {
    expect(judgeDuplicate(probe([]), target({ locationId: null })).kind).toBe('clear');
  });
});

describe('judgeDuplicate — 네 축을 함께 본다', () => {
  it('네 축이 모두 같으면 막는다', () => {
    expect(judgeDuplicate(probe([EXISTING]), target())).toEqual({
      kind: 'blocked',
      existingCount: 1,
    });
  });

  it.each([
    ['품목', { itemId: 9102 }],
    ['창고', { warehouseId: 9202 }],
    ['위치', { locationId: 9302 }],
    ['우선순위', { priorityNo: 20 }],
  ])('%s이 다르면 막지 않는다', (_name, patch) => {
    expect(judgeDuplicate(probe([EXISTING]), target(patch)).kind).toBe('clear');
  });

  /**
   * ⚠ 우선순위를 축에 넣은 것은 **채택한 기본값**이다(승인 기록 Q2 — 계약 문면이 갈린다).
   * 목록 표식(`duplicate-badge.ts`)과 **같은 축**이어야 하며, 3키로 확정되면 둘을 함께 고친다.
   */
  it('우선순위만 다른 조합을 중복으로 보지 않는다', () => {
    expect(judgeDuplicate(probe([EXISTING]), target({ priorityNo: 999 })).kind).toBe('clear');
  });

  /** 위치를 비운 규칙끼리는 **같은 값**으로 겹친다. */
  it('창고 전체 규칙끼리 겹치면 막는다', () => {
    const wide: PutawayRule = { ...EXISTING, putawayRuleId: 9005, locationId: null };

    expect(judgeDuplicate(probe([wide]), target({ locationId: null })).kind).toBe('blocked');
  });

  /** 계약의 세 상태(없음·`null`·값) 중 앞 둘은 화면에서 같은 뜻이다. */
  it('위치 키가 아예 없는 응답도 창고 전체로 본다', () => {
    const { locationId: _dropped, ...withoutLocation } = EXISTING;
    const wide = { ...withoutLocation, putawayRuleId: 9005 } as PutawayRule;

    expect(judgeDuplicate(probe([wide]), target({ locationId: null })).kind).toBe('blocked');
  });
});

describe('judgeDuplicate — 세지 않는 것', () => {
  /** 계약이 막는 것은 활성 중복이다. 끄고 새로 등록해 두는 것이 정상 운용이다. */
  it('꺼진 규칙은 중복이 아니다', () => {
    const inactive: PutawayRule = { ...EXISTING, putawayRuleId: 9005, isActive: false };

    expect(judgeDuplicate(probe([inactive]), target()).kind).toBe('clear');
  });

  /** 빼지 않으면 수정이 **늘 자기 때문에** 막힌다. */
  it('자기 자신을 판정에서 뺀다', () => {
    expect(judgeDuplicate(probe([EXISTING]), target({ selfRuleId: 9001 })).kind).toBe('clear');
  });
});

describe('judgeDuplicate — 막을 때 무엇을 함께 내는가', () => {
  /**
   * **건수를 낸다** — 막힘 사유 문장이 그 수를 실어 「지금 보는 쪽에 없을 수 있다」까지 말한다.
   * 겹친 상대의 **번호는 내지 않는다**: 이 화면에는 그 번호로 옮겨 가는 길이 없고, 쓰지 않는
   * 값을 타입에 남기면 죽은 통로가 된다(사본 체크리스트 7번).
   */
  it('겹친 건수를 낸다', () => {
    const second: PutawayRule = { ...EXISTING, putawayRuleId: 9006 };

    expect(judgeDuplicate(probe([EXISTING, second]), target())).toEqual({
      kind: 'blocked',
      existingCount: 2,
    });
  });
});
