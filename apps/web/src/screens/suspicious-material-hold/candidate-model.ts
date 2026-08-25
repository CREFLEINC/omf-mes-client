import type { components, paths } from '@omf-mes/api-client';

type LotQualityStatus = components['schemas']['LotQualityStatus'];
type LotStatusQuery = NonNullable<
  NonNullable<paths['/quality/lot-statuses']['get']>['parameters']['query']
>;

export interface SuspiciousMaterialFilters {
  q: string;
  itemId: string;
  warehouseId: string;
  lotStatusCode: string;
}

export const EMPTY_SUSPICIOUS_MATERIAL_FILTERS: SuspiciousMaterialFilters = {
  q: '',
  itemId: '',
  warehouseId: '',
  lotStatusCode: '',
};

export interface SelectedLotSnapshot {
  lotId: number;
  lotNo: string;
  itemId: number;
  versionNo: number;
  warehouseId?: number;
  locationId?: number;
  onHandQty?: number;
  uomId?: number;
  lotStatusCode: string;
  latestTransitionAt?: string;
  locationLabel?: string | null;
  uomLabel?: string | null;
}

export type SuspiciousMaterialCandidateResponse =
  | { kind: 'SUCCESS'; items: LotQualityStatus[] }
  | { kind: 'UNAVAILABLE'; reason: 'PENDING' | 'ERROR' | 'ABSENT' };

const positiveInteger = (value: string): number | undefined => {
  if (!/^\d+$/.test(value)) return undefined;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : undefined;
};

export const toSuspiciousMaterialQuery = (
  filters: SuspiciousMaterialFilters,
  page: number,
): LotStatusQuery => ({
  ...(filters.q === '' ? {} : { q: filters.q }),
  ...(positiveInteger(filters.itemId) === undefined
    ? {}
    : { itemId: positiveInteger(filters.itemId) }),
  ...(positiveInteger(filters.warehouseId) === undefined
    ? {}
    : { warehouseId: positiveInteger(filters.warehouseId) }),
  ...(filters.lotStatusCode === '' ? {} : { lotStatusCode: filters.lotStatusCode }),
  ...(Number.isSafeInteger(page) && page > 1 ? { page } : {}),
});

export const toSelectedLotSnapshot = (row: LotQualityStatus): SelectedLotSnapshot | null => {
  const versionNo = row.versionNo;
  if (
    row.fullyHeld ||
    !Number.isSafeInteger(row.lotId) ||
    row.lotId <= 0 ||
    typeof versionNo !== 'number' ||
    !Number.isSafeInteger(versionNo) ||
    versionNo <= 0
  )
    return null;
  return {
    lotId: row.lotId,
    lotNo: row.lotNo,
    itemId: row.itemId,
    versionNo,
    warehouseId: row.warehouseId,
    locationId: row.locationId,
    onHandQty: row.onHandQty,
    uomId: row.uomId,
    lotStatusCode: row.lotStatusCode,
    latestTransitionAt: row.latestTransitionAt,
  };
};

export const reconcileSuspiciousMaterialSelection = (
  current: SelectedLotSnapshot[],
  response: SuspiciousMaterialCandidateResponse,
): SelectedLotSnapshot[] => {
  if (response.kind !== 'SUCCESS') return [];
  const latest = new Map(
    response.items.map((row) => [row.lotId, toSelectedLotSnapshot(row)] as const),
  );
  return current.flatMap((selected) => {
    const replacement = latest.get(selected.lotId);
    return replacement === null || replacement === undefined ? [] : [replacement];
  });
};
