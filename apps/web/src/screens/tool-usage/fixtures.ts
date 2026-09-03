import type { Mold, OperationPolicyEffective } from './types';

/**
 * 지어낸 값만 쓴다 — 실 운영 코드·사번을 넣지 않는다(V3 워크플로 공개 저장소 경계).
 */

export const TOOL_CODE = 'MLD-0207';

export const makeTool = (patch: Partial<Mold> = {}): Mold => ({
  moldId: 1001,
  plantId: 1,
  moldCode: TOOL_CODE,
  moldName: '하우징 상부 금형',
  toolTypeCode: 'MOLD',
  cavityCount: 4,
  guaranteedShotCount: 500000,
  currentShotCount: 412300,
  statusCode: 'IN_SERVICE',
  isActive: true,
  pmTriggerTypeCode: 'NONE',
  ...patch,
});

export const moldListResponse = (items: Mold[]) => ({
  items,
  page: { page: 1, size: 20, total: items.length },
});

export const effectivePolicy = (
  policyCode: OperationPolicyEffective['policyCode'],
  patch: Partial<OperationPolicyEffective> = {},
): OperationPolicyEffective => ({
  policyCode,
  resolved: true,
  ...patch,
});

/** 환산을 쓰고 비율이 2.5 인 범위. 스펙 §3 의 예시와 같은 값이다. */
export const conversionOnPolicies = {
  enabled: effectivePolicy('SHOT_CONVERSION_ENABLED', { valueBoolean: true }),
  ratio: effectivePolicy('SHOT_CONVERSION_RATIO', { valueNumeric: 2.5 }),
};

/** 맞는 정책이 없는 범위 — 계약이 「기본값을 지어내지 않는다」고 못박은 자리다. */
export const unresolvedPolicies = {
  enabled: effectivePolicy('SHOT_CONVERSION_ENABLED', { resolved: false }),
  ratio: effectivePolicy('SHOT_CONVERSION_RATIO', { resolved: false }),
};
