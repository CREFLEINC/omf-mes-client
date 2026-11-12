import type { components } from '@omf-mes/api-client';

import type { LocationView } from './types';

/** 재고 잔량 한 줄 — `groupBy=LOCATION` 이라 (품목 · 소유 · LOT · 위치) 하나다. */
export type StockBalance = components['schemas']['InventoryBalance'];

/** 고른 위치의 재고 표 한 줄. 수량을 더하지 않는다 — 위치가 다르면 다른 줄이다(FR-013 · R-8). */
export interface LocationStockRow {
  key: string;
  locationId: number;
  locationCode: string;
  itemCode: string;
  itemName: string;
  lotNo: string | null;
  onHandQty: number;
  uomId: number;
  qualityStatusCode: string | null;
}

export interface LocationStock {
  /** 재고가 있는 위치 — 재고 줄의 위치와 **그 조상 전부**(구역 · 랙 표식은 아래에 재고가 있으면 「있음」, R-6). */
  stockedLocationIds: ReadonlySet<number>;
  /** 그 위치와 하위 위치의 재고 줄. 정렬은 위치 코드 → 품목 코드 → LOT. */
  rowsFor: (locationId: number) => LocationStockRow[];
  /** 받은 줄이 쪽 상한에 걸렸다 — 「재고 일부만 보입니다」. */
  truncated: boolean;
}

const compare = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

/**
 * 창고 하나의 재고 줄을 위치별로 나눈다(피처 006 R-7 · data-model 「위치별 재고」).
 *
 * ⭐ **「있음」은 `onHandQty > 0` 이다**(원래 설계 §6-1). 보류 · 불량도 물건이 있으면 있음이다. 0 · 음수는 없음이다.
 * ⭐ **조상은 위치 목록의 `parentLocationId` 를 따라 올라간다.** 목록에 없는 위치(중지 위치를 숨겼거나 지워진 위치)의 재고는
 * 버리지 않고 그 위치 id 만 「있음」으로 둔다.
 * ⛔ **수량을 더하지 않는다.** 같은 품목 · LOT 이 여러 셀에 있으면 셀마다 한 줄 — 더하면 어느 셀로 가야 하는지 사라진다.
 */
export const buildLocationStock = (
  balances: readonly StockBalance[],
  locations: readonly LocationView[],
  truncated: boolean,
): LocationStock => {
  const parentOf = new Map<number, number | null>();
  const childrenOf = new Map<number, number[]>();
  const codeOf = new Map<number, string>();

  for (const location of locations) {
    const parent = location.parentLocationId ?? null;

    parentOf.set(location.locationId, parent);
    codeOf.set(location.locationId, location.locationCode);
    if (parent !== null)
      childrenOf.set(parent, [...(childrenOf.get(parent) ?? []), location.locationId]);
  }

  const stocked = new Set<number>();
  const rows: LocationStockRow[] = [];

  balances.forEach((balance, index) => {
    const locationId = balance.locationId;

    if (locationId === null || locationId === undefined) return;

    rows.push({
      key: `${String(locationId)}-${String(index)}`,
      locationId,
      locationCode: balance.locationCode ?? codeOf.get(locationId) ?? String(locationId),
      itemCode: balance.itemCode ?? '',
      itemName: balance.itemName ?? '',
      lotNo: balance.lotNo ?? null,
      onHandQty: balance.onHandQty,
      uomId: balance.uomId,
      qualityStatusCode: balance.qualityStatusCode ?? null,
    });

    if (!(balance.onHandQty > 0)) return;

    /* 조상으로 올라간다 — 목록이 어긋나 고리가 생겨도 멈춘다. */
    let current: number | null = locationId;
    while (current !== null && !stocked.has(current)) {
      stocked.add(current);
      current = parentOf.get(current) ?? null;
    }
  });

  rows.sort(
    (a, b) =>
      compare(a.locationCode, b.locationCode) ||
      compare(a.itemCode, b.itemCode) ||
      compare(a.lotNo ?? '', b.lotNo ?? ''),
  );

  const rowsFor = (locationId: number): LocationStockRow[] => {
    const within = new Set<number>([locationId]);
    const queue = [locationId];

    for (let next = queue.shift(); next !== undefined; next = queue.shift()) {
      for (const child of childrenOf.get(next) ?? []) {
        if (within.has(child)) continue;
        within.add(child);
        queue.push(child);
      }
    }

    return rows.filter((row) => within.has(row.locationId));
  };

  return { stockedLocationIds: stocked, rowsFor, truncated };
};
