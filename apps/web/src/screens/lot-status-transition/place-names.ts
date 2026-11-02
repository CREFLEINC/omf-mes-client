import {
  useLocationNameSources,
  useWarehouseReferenceOptions,
} from '../lot-status-history/reference-options';

/**
 * 보류 등록 · 해제 확인 창의 「대상 위치」 — 창고 · 위치 번호를 이름으로 푼다. 아직 받는 중이거나 목록에 없으면 번호 그대로
 * 둔다(짐작한 이름을 보이지 않는다). 전에는 늘 번호(「창고 13 · 위치 25」)로 보였다(점검 2026-11-02).
 */
export const usePlaceNames = (
  warehouseId: number | undefined,
  locationId: number | undefined,
): { warehouse: string | null; location: string | null } => {
  const warehouses = useWarehouseReferenceOptions();
  const locations = useLocationNameSources(warehouseId === undefined ? [] : [warehouseId]);
  const nameOf = (
    entries: readonly { value: string; label: string }[] | undefined,
    id: number | undefined,
  ): string | null =>
    id === undefined
      ? null
      : (entries?.find((entry) => entry.value === String(id))?.label ?? String(id));
  return {
    warehouse: nameOf(warehouses.data?.entries, warehouseId),
    location: nameOf(
      warehouseId === undefined ? undefined : locations.get(warehouseId)?.data?.entries,
      locationId,
    ),
  };
};
