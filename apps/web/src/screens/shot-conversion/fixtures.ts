import type { Mold, OperationPolicy, OperationPolicyEffective, PageMeta } from './types';

/** 값은 전부 합성이다. 실 운영 값을 쓰지 않는다. */

export const pageMeta = (total: number, size = 200): PageMeta => ({ page: 1, size, total });

export const makeRatio = (
  operationPolicyId: number,
  valueNumeric: number,
  overrides: Partial<OperationPolicy> = {},
): OperationPolicy => ({
  operationPolicyId,
  policyCode: 'SHOT_CONVERSION_RATIO',
  valueNumeric,
  effectiveFrom: '2026-01-01',
  ...overrides,
});

/**
 * 네 줄이 **서로 다른 넓이**다 — 표가 그 차이를 그리는지 보는 자리다.
 * 전체 → 사업부 → 공장 → 공정 → 품목 차례로 좁아진다.
 */
export const ratioItems: OperationPolicy[] = [
  makeRatio(9001, 1, {}),
  makeRatio(9002, 1, { plantId: 11 }),
  makeRatio(9003, 0.25, { itemId: 21 }),
  makeRatio(9004, 1, { processId: 31, effectiveTo: '2026-12-31' }),
];

export const ratioListResponse = (
  items: OperationPolicy[] = ratioItems,
  total: number = items.length,
) => ({ items, page: pageMeta(total) });

export const itemsResponse = () => ({
  items: [
    { itemId: 21, itemCode: 'ITM-201', itemName: '가상 하우징', isActive: true },
    { itemId: 22, itemCode: 'ITM-202', itemName: '가상 커버', isActive: true },
  ],
  page: pageMeta(2, 100),
});

export const processesResponse = () => ({
  items: [
    { processId: 31, processCode: 'PRC-301', processName: '가상 프레스', isActive: true },
    { processId: 32, processCode: 'PRC-302', processName: '가상 조립', isActive: true },
  ],
  page: pageMeta(2, 100),
});

export const plantsResponse = () => ({
  items: [
    { plantId: 11, plantCode: 'P1', plantName: '가상 1공장', isActive: true },
    { plantId: 12, plantCode: 'P2', plantName: '가상 2공장', isActive: true },
  ],
  page: pageMeta(2, 100),
});

export const businessUnitsResponse = () => ({
  items: [
    {
      businessUnitId: 1,
      businessUnitCode: 'BU-1',
      businessUnitName: '가상 사업부',
      isActive: true,
    },
  ],
  page: pageMeta(1, 100),
});

export const makeEnabled = (
  operationPolicyId: number,
  valueBoolean: boolean | null,
  overrides: Partial<OperationPolicy> = {},
): OperationPolicy => ({
  operationPolicyId,
  policyCode: 'SHOT_CONVERSION_ENABLED',
  valueBoolean,
  effectiveFrom: '2026-01-01',
  ...overrides,
});

export const enabledListResponse = (items: OperationPolicy[] = []) => ({
  items,
  page: pageMeta(items.length),
});

/** 요청의 정책 코드로 갈라 준다 — 두 조회가 같은 경로를 쓴다. */
export const policyCodeOf = (request: Request): string | null =>
  new URL(request.url).searchParams.get('policyCode');

/** ⭐ 계약이 `cavityCount` 를 필수(최솟값 1)로 두어 「없는 툴」은 만들 수 없다. */
export const makeMold = (moldId: number, moldCode: string, cavityCount: number): Mold => ({
  moldId,
  plantId: 11,
  moldCode,
  moldName: `${moldCode} 금형`,
  toolTypeCode: 'MOLD',
  cavityCount,
  currentShotCount: 0,
  pmTriggerTypeCode: 'SHOT',
  statusCode: 'IN_SERVICE',
  isActive: true,
});

export const moldListResponse = (items: Mold[] = [makeMold(7001, 'MLD-0207', 4)]) => ({
  items,
  page: pageMeta(items.length, 100),
});

export const effectiveResponse = (
  overrides: Partial<OperationPolicyEffective> = {},
): OperationPolicyEffective => ({
  policyCode: 'SHOT_CONVERSION_RATIO',
  resolved: true,
  operationPolicyId: 9003,
  valueNumeric: 0.25,
  matchedScopeCode: 'ITEM',
  ...overrides,
});
