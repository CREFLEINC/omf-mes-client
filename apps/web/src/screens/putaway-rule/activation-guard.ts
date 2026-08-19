import { messages } from '@omf-mes/i18n';

import type { DuplicateCheck, DuplicateProbe } from './duplicate-check';

const t = messages.putawayRule;

/**
 * 사용 전환의 **판정 한 곳**. 두 물음에 답한다.
 *
 * | 물음 | 함수 |
 * | --- | --- |
 * | 지금 낼 수 있는 전환이 무엇이고 막혔는가 | `activationIntentOf` · `activationBlockedReason` |
 * | **끄고 나면 이 품목에 덮개가 남는가** | `judgeRemainingCoverage` |
 *
 * 둘 다 **조준 조회 하나**를 읽는다(`duplicate-check.ts`의 `DuplicateProbe`) — 그 조회는 이미
 * 등록·수정을 위해 나가 있고, 창고·품목으로 좁혀 **사용 중인 규칙만** 실어 온다. 켜기의 중복
 * 판정과 끄기의 덮개 판정이 같은 자료를 보는 것은 우연이 아니다: 둘 다 「이 창고·이 품목에
 * 지금 효력이 있는 규칙이 무엇인가」를 묻는다.
 *
 * ## 두 전환이 대칭이 아니다
 *
 * - **끄기**는 계약에 400이 **없다**(업무 규칙으로 막지 않는다) → 화면도 막지 않는다.
 *   화면이 대신 막으면 계약에 없는 규칙을 화면이 지어내는 것이다.
 * - **켜기**는 활성 중복이 400이다 → 화면이 먼저 막는다. 확인 창까지 지나간 뒤 거절을 받으면
 *   사용자는 무엇이 잘못됐는지 알 수 없다.
 *
 * 그래서 끄기의 방어는 **막는 것이 아니라 정확히 말하는 것**이고, 그 문면을 가르는 것이
 * `judgeRemainingCoverage`다.
 *
 * ## ⚠ 겨누는 값이 폼 값이 아니라 **서버 값**이다
 *
 * 전환은 폼을 저장하지 않는다 — 고치던 값이 아니라 **지금 서버에 있는 규칙**이 켜지고 꺼진다.
 * 그러므로 네 축(품목·창고·위치·우선순위)을 폼 초안에서 읽으면 안 된다. 위치·우선순위는 폼에서
 * 고칠 수 있어, 고친 채 켜면 **저장하지도 않은 조합**으로 중복을 판정하게 된다.
 *
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 파일을 참조하지 않는다.
 */

/** 무엇을 하려는가. 두 조작이 말해야 하는 사실이 서로 달라 확인 창 하나를 갈래로 쓴다. */
export type ActivationIntent = 'deactivate' | 'activate';

/**
 * 지금 대상에 뜻이 있는 전환.
 *
 * **`null`은 「상세가 아직 오지 않았다」**이며 그때는 어느 쪽도 낼 수 없다. 목록 응답에는
 * 잠금 토큰이 없어 행에서 곧바로 끄거나 켤 수 없고(위험 R2 · `:activate`에도 `If-Match`가
 * 필수다), 사용 여부 자체도 확인되지 않은 상태다 — 그것을 `false`로 접으면 화면이 「다시
 * 사용」을 세우고, 그대로 누르면 이미 켜진 규칙에 `:activate`가 나가 400이 된다.
 */
export const activationIntentOf = (isActive: boolean | null): ActivationIntent | null => {
  if (isActive === null) return null;

  return isActive ? 'deactivate' : 'activate';
};

export interface ActivationGate {
  /** 지금 낼 수 있는 전환. `null`이면 상세가 아직 오지 않았다. */
  intent: ActivationIntent | null;
  /** **켜기가 만들 조합**의 활성 중복. 끄기는 이 값을 보지 않는다. */
  duplicate: DuplicateCheck;
}

/**
 * 전환 손잡이의 지금 상태.
 *
 * ⭐ **막힘과 사유가 한 값에서 나온다.** 둘을 따로 넘기면 「잠겼는데 사유가 없다」가 타입으로
 * 표현되고, 받는 쪽이 그 빈자리를 메우려 **사유를 한 벌 더 갖게 된다** — 같은 값을 두 자리에서
 * 말하면 언젠가 둘이 갈린다. 비활성 액션에는 반드시 사유가 붙는다(배치 규범 4).
 *
 * `intent`가 `null`인 `blocked`가 **상세 미도착**이며, 그때는 중립 이름이 선다.
 */
export type ActivationAction =
  | { kind: 'open'; intent: ActivationIntent }
  | { kind: 'blocked'; intent: ActivationIntent | null; reason: string };

/**
 * 지금 낼 수 있는 손잡이 하나.
 *
 * **잠금 토큰을 먼저 본다** — 토큰이 없으면 중복이 있든 없든 요청 자체가 나갈 수 없고,
 * 그때 중복 사유를 내면 사용자가 고칠 수 없는 것을 고치려 든다.
 */
export const activationActionOf = (gate: ActivationGate): ActivationAction => {
  if (gate.intent === null) {
    return { kind: 'blocked', intent: null, reason: t.actionReasons.activationNeedsDetail };
  }

  /*
   * 끄기는 계약이 막지 않는다 — 화면도 막지 않고 확인 창이 파급을 말하는 것으로 대신한다.
   *
   * **판정 불가도 막지 않는다**(C3-9와 같은 잣대). 계약이 같은 조건을 다시 검사하므로,
   * 확인하지 못한 것을 이유로 막으면 조회 실패 하나가 마스터 관리를 멈춘다.
   */
  if (gate.intent === 'activate' && gate.duplicate.kind === 'blocked') {
    return {
      kind: 'blocked',
      intent: 'activate',
      reason: t.actionReasons.activateDuplicate(gate.duplicate.existingCount),
    };
  }

  return { kind: 'open', intent: gate.intent };
};

/**
 * 끄려는 대상. **`null`은 「아직 정해지지 않았다」**이며 `DuplicateTarget`과 같은 규율이다.
 */
export interface CoverageTarget {
  itemId: number | null;
  warehouseId: number | null;
  /** 끄려는 규칙 자신. **빼지 않으면 자기가 자기를 덮는다.** */
  selfRuleId: number | null;
}

/**
 * 끄고 난 뒤 이 창고·이 품목에 남는 **사용 중인 규칙**.
 *
 * **「판정하지 못했다」가 세 번째 값이다.** 「없다」로 뭉개면 화면이 「끄면 위치 검증 없이
 * 통과합니다」라고 단언하고, 「있다」로 뭉개면 정반대의 거짓을 말한다.
 */
export type RemainingCoverage =
  /** 이것이 마지막이다 — 끄면 그 품목이 현장에서 위치 검증 없이 통과한다(공유계약 G-12). */
  | { kind: 'none' }
  /** 남는 규칙이 있다 — 이 갈래에서 「위치 검증 없이 통과」는 참이 아니다. */
  | { kind: 'some'; count: number }
  | {
      kind: 'unknown';
      reason: 'loading' | 'failed' | 'truncated' | 'incomplete' | 'outOfScope';
    };

/**
 * 조준 조회 결과를 덮개 판정으로 옮긴다.
 *
 * 순서가 뜻을 정한다 — **미완성 · 실패 · 미도착 · 잘림 · 범위 어긋남이 셈보다 앞선다**
 * (`judgeDuplicate`와 같은 순서·같은 이유). 그중에서도 미완성이 맨 앞이다: 겨눌 조합이 없으면
 * 조회가 열리지도 않으므로, 뒤에 두면 **열리지 않은 조회의 상태**를 답으로 내게 된다.
 *
 * ## ⚠ 이 함수는 조준 조회가 **어느 축으로 열렸는지 모른다**
 *
 * 조회는 **폼 값**(`formWarehouseId`·`formItemId`)으로 열리고 판정은 **서버 값**
 * (`rule.warehouseId`·`rule.itemId`)으로 겨눈다. 지금은 둘이 갈릴 수 없다 — 수정에서
 * 품목·창고 입력이 잠겨 있고(계약이 수정 본문에서 두 키를 뺐다) 초안은 렌더 중에 상세로부터
 * 심어진다. **그 잠금이 풀리는 회차는 이 자리를 함께 본다.**
 *
 * 그날을 대비해 재검을 **가장 약한 쪽으로** 접는다: 창고·품목이 어긋난 행이 하나라도 오면
 * 세지 않고 `outOfScope`를 낸다. 어긋난 행을 조용히 떨어뜨리면 셈이 0이 되어
 * **세 갈래 중 가장 센 단언**(`none` — 「이것뿐입니다 · 검증 없이 통과합니다」)이 나가는데,
 * 안전장치가 틀리는 방향을 가장 나쁜 쪽으로 고정해서는 안 된다.
 *
 * ⛔ **남는 구멍 하나**: 어긋난 축의 조회가 **0건**을 돌려주면 어긋남을 여기서 알 수 없다
 * (`items`가 비어 어긋남의 증거가 없다). 그 갈래까지 닫으려면 조회가 **자기가 쓴 축**을
 * 값으로 함께 실어야 한다(`DuplicateProbe`에 조회 축을 더한다) — 잠금이 풀리는 회차의 몫이다.
 */
export const judgeRemainingCoverage = (
  probe: DuplicateProbe,
  target: CoverageTarget,
): RemainingCoverage => {
  const { itemId, warehouseId } = target;

  if (itemId === null || warehouseId === null) return { kind: 'unknown', reason: 'incomplete' };

  if (probe.isError) return { kind: 'unknown', reason: 'failed' };
  if (probe.isLoading) return { kind: 'unknown', reason: 'loading' };
  if (probe.total > probe.items.length) return { kind: 'unknown', reason: 'truncated' };

  /*
   * **꺼진 규칙은 어긋남이 아니다.** 조회가 `includeInactive:false`로 열려도 서버가 꺼진 행을
   * 함께 줄 수 있고, 그것은 「축이 다르다」가 아니라 「덮개가 아니다」다 — 둘을 한 갈래로
   * 뭉치면 정상 자료 하나가 판정을 통째로 멈춘다.
   */
  const isOutOfScope = probe.items.some(
    (item) => item.itemId !== itemId || item.warehouseId !== warehouseId,
  );

  if (isOutOfScope) return { kind: 'unknown', reason: 'outOfScope' };

  const remaining = probe.items.filter(
    (item) => item.isActive && item.putawayRuleId !== target.selfRuleId,
  );

  return remaining.length === 0 ? { kind: 'none' } : { kind: 'some', count: remaining.length };
};
