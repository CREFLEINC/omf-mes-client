import type { components } from '@omf-mes/api-client';

/** W-05-01 화면 슬라이스의 계약. */
export type OperationPolicy = components['schemas']['OperationPolicy'];
export type OperationPolicyEffective = components['schemas']['OperationPolicyEffective'];
export type PageMeta = components['schemas']['PageMeta'];
export type Mold = components['schemas']['Mold'];

/**
 * 계약이 못박은 정책 코드 목록.
 *
 * ⭐ **코드가 자유 문자열이 아니라 열거다** — 계약이 「코드 목록을 계약이 갖는다」를 실제로
 * 지켰다(스펙 §9-1). 그래서 이 화면이 남의 코드를 잘못 부르면 **타입 검사에서 걸린다.**
 */
export type PolicyCode = OperationPolicy['policyCode'];

/**
 * 이 화면이 쓰는 정책 코드 **둘.**
 *
 * ⛔ **사용자에게 묻지 않는다**(스펙 §5-1). `operation_policy` 는 범용 표라 코드를 자유롭게
 * 넣을 수 있지만, 이 화면이 다루는 것은 둘뿐이고 **기계가 정할 수 있는 것을 사람에게 묻지
 * 않는다.** 화면에 「정책 코드」 입력란이 없는 이유다.
 *
 * ⚠ **같은 표를 다른 화면도 쓴다** — 작업 통제 3단계·경미 정지 임계가 같은 자리에 온다.
 * 코드가 겹치거나 뜻이 갈리면 조용히 틀리므로, 이 상수가 **이 화면의 경계**를 긋는다.
 */
export const POLICY_CODES = {
  /** 환산을 쓸지 — `valueBoolean` 을 쓴다 */
  enabled: 'SHOT_CONVERSION_ENABLED',
  /** 수량 대비 타발수 비율 — `valueNumeric` 을 쓰며 0보다 커야 한다 */
  ratio: 'SHOT_CONVERSION_RATIO',
} as const satisfies Record<string, PolicyCode>;

/**
 * 범위 축 넷. **비면 「지정 없음」이고 그것은 전체를 뜻한다.**
 *
 * ⭐ **차례가 곧 우선순위다** — 여럿이 동시에 맞으면 **더 좁은 것이 이기며**, 축 우선순위는
 * 품목 · 공정 · 공장 · 사업부다(스펙 §5-2 · 공유계약 B-17).
 *
 * ⛔ **화면이 그 판정을 다시 구현하지 않는다** — `effective` 경로가 답을 준다. 다시 짜면
 * 같은 표가 화면마다 다르게 읽힌다.
 */
export const SCOPE_AXES = ['itemId', 'processId', 'plantId', 'businessUnitId'] as const;

export type ScopeAxis = (typeof SCOPE_AXES)[number];

/** 범위 축의 값. 고르지 않았으면 빈 문자열이며 그것이 「지정 없음」이다. */
export type ScopeValues = Record<ScopeAxis, string>;

/**
 * 정책 창이 들고 있는 값.
 *
 * ⛔ **정책 코드가 여기 없다** — 화면이 붙인다.
 * ⛔ **`valueText` 도 없다** — 이 화면의 두 코드가 쓰지 않는 칸이다.
 */
export interface RatioFormValues {
  scope: ScopeValues;
  /** **수는 문자열로 든다** — 빈 칸과 `0` 을 가르고, 지우는 도중의 「`0.`」을 억지로 바꾸지 않는다 */
  ratio: string;
  effectiveFrom: string;
  /** 비면 끝이 없다 */
  effectiveTo: string;
}

/** 목록을 좁히는 조건. */
export interface PolicyFilters {
  /** 이 날에 유효한 것만 본다. 비우면 **끝난 것까지** 함께 본다 */
  effectiveOn: string;
}
