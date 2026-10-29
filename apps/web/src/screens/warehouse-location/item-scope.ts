/**
 * 창고 유형에 따라 위치에 둘 수 있는 품목 유형(사용자 확정 2026-10-29) — 보관 품목을 고르는 칸이 이 유형만 보인다.
 *
 * - 자재창고: 원자재 · 부자재 · 제품창고: 제품 · 반제품 · 상품 · 일반창고: 제한 없음
 * - 예비품창고: 예비품은 품목 마스터 밖(예비품 마스터)이라 보관 품목 칸을 두지 않는다.
 *
 * 표에 없는 창고 유형(고객이 늘린 값)은 제한 없이 둔다.
 */
const ITEM_TYPES_BY_WAREHOUSE_TYPE: Record<string, readonly string[] | null> = {
  MATERIAL: ['RAW_MATERIAL', 'SUBSIDIARY_MATERIAL'],
  PRODUCT: ['FINISHED', 'SEMI_FINISHED', 'MERCHANDISE'],
  GENERAL: [],
  SPARE_PART: null,
};

/** 고를 수 있는 품목 유형. 빈 배열은 제한 없음, null 은 보관 품목을 두지 않음. */
export const itemTypesForWarehouse = (
  warehouseTypeCode: string | undefined,
): readonly string[] | null => {
  if (warehouseTypeCode === undefined) return [];
  const scope = ITEM_TYPES_BY_WAREHOUSE_TYPE[warehouseTypeCode];
  /* 예비품창고는 null(칸 없음) — `??` 로 합치면 「제한 없음」이 돼 버린다. */
  return scope === undefined ? [] : scope;
};
