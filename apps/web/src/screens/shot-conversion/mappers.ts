import type { components } from '@omf-mes/api-client';

import { emptyScope } from './options';
import { parseRatio } from './ratio-validation';
import {
  SCOPE_AXES,
  POLICY_CODES,
  type OperationPolicy,
  type RatioFormValues,
  type ScopeValues,
} from './types';

type OperationPolicyCreate = components['schemas']['OperationPolicyCreate'];
type OperationPolicyUpdate = components['schemas']['OperationPolicyUpdate'];

/** 고른 축 값을 식별자로. 고르지 않았으면 `null` 이고 그것이 「전체」다. */
const axisId = (value: string): number | null => {
  if (value === '') return null;

  const parsed = Number(value);

  /*
   * ⛔ **읽을 수 없는 값을 조건으로 내보내지 않는다** — `NaN` 이 나가면 서버가 400 으로
   * 되받고 화면에는 「저장하지 못했습니다」만 남아 무엇이 잘못됐는지 아무도 모른다.
   * 고르지 않은 것으로 다루면 적어도 「전체」라는 사실이 창에 그대로 보인다.
   */
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
};

/** 받아 온 정책으로 범위 칸을 채운다. */
export const scopeFrom = (policy: OperationPolicy): ScopeValues => {
  const scope: ScopeValues = { ...emptyScope };

  for (const axis of SCOPE_AXES) {
    const value = policy[axis];

    scope[axis] = value === null || value === undefined ? '' : String(value);
  }

  return scope;
};

/**
 * 받아 온 정책으로 폼을 채운다.
 *
 * ⭐ **수를 문자열로 옮긴다** — 폼이 문자열로 들기 때문이고, 그래야 지우는 도중의 「0.」이
 * 숫자로 억지로 바뀌지 않는다.
 */
export const formValuesFrom = (policy: OperationPolicy): RatioFormValues => ({
  scope: scopeFrom(policy),
  ratio:
    policy.valueNumeric === null || policy.valueNumeric === undefined
      ? ''
      : String(policy.valueNumeric),
  effectiveFrom: policy.effectiveFrom,
  effectiveTo: policy.effectiveTo ?? '',
});

/**
 * 등록 본문.
 *
 * ⛔ **정책 코드를 화면이 붙인다** — 사용자에게 묻지 않는다(스펙 §5-1).
 *
 * ⛔ **값 칸 셋 중 하나만 채운다.** 물리 제약이 「하나 이상」이라 셋 다 채워도 통과하지만,
 * 어느 칸을 쓰는지는 정책 코드가 정한다 — **쓰지 않는 칸을 채우면 읽는 쪽이 헷갈린다.**
 * 이 코드가 쓰는 칸은 `valueNumeric` 하나이므로 `valueText`·`valueBoolean` 은 싣지 않는다.
 */
export const toRatioCreate = (values: RatioFormValues): OperationPolicyCreate => ({
  policyCode: POLICY_CODES.ratio,
  valueNumeric: parseRatio(values.ratio),
  itemId: axisId(values.scope.itemId),
  processId: axisId(values.scope.processId),
  plantId: axisId(values.scope.plantId),
  businessUnitId: axisId(values.scope.businessUnitId),
  effectiveFrom: values.effectiveFrom,
  effectiveTo: values.effectiveTo === '' ? null : values.effectiveTo,
});

/**
 * 수정 본문.
 *
 * ⛔ **정책 코드와 범위 축을 싣지 않는다** — 계약의 수정 본문에 없다. 「바꾸면 다른 정책이
 * 된다」가 그 이유이며, 범위를 옮기려면 이 정책을 끝내고 새로 등록한다.
 *
 * ⭐ **쓰지 않는 값 칸을 `null` 로 못박는다.** 등록과 달리 수정은 **이미 있는 행을 덮으므로**,
 * 다른 화면이 실수로 채워 둔 칸이 남아 있으면 이 화면이 그것을 그대로 두게 된다.
 */
export const toRatioUpdate = (values: RatioFormValues): OperationPolicyUpdate => ({
  valueNumeric: parseRatio(values.ratio),
  valueText: null,
  valueBoolean: null,
  effectiveFrom: values.effectiveFrom,
  effectiveTo: values.effectiveTo === '' ? null : values.effectiveTo,
});
