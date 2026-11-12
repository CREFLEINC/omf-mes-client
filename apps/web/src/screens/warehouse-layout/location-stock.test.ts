import { describe, expect, it } from 'vitest';

import { buildLocationStock, type StockBalance } from './location-stock';
import type { LocationView } from './types';

/*
 * 재고 줄 → 위치별 유무 · 고른 위치의 줄(피처 006 FR-011 · FR-013). 화면 없이 값으로 잰다.
 * 계층: 구역 Z01(1) › 랙 R001(2) › 층 L01(3) › 셀 C01(4) · C02(5), 랙 R002(6).
 */

const location = (
  locationId: number,
  locationCode: string,
  parentLocationId: number | null,
): LocationView => ({
  locationId,
  warehouseId: 12,
  parentLocationId,
  locationCode,
  locationName: locationCode,
  aliasName: null,
  locationLevelCode: 'ZONE',
  systemRoleCode: null,
  isActive: true,
  isLeaf: true,
  hasItemRestriction: false,
});

const LOCATIONS: LocationView[] = [
  location(1, 'Z01', null),
  location(2, 'Z01-R001', 1),
  location(3, 'Z01-R001-L01', 2),
  location(4, 'Z01-R001-L01-C01', 3),
  location(5, 'Z01-R001-L01-C02', 3),
  location(6, 'Z01-R002', 1),
];

const balance = (
  locationId: number | null,
  itemCode: string,
  lotNo: string | null,
  onHandQty: number,
): StockBalance => ({
  groupBy: 'LOCATION',
  locationId,
  itemId: 1,
  itemCode,
  itemName: `${itemCode} 이름`,
  lotNo,
  ownershipTypeCode: 'OWNED',
  onHandQty,
  reservedQty: 0,
  pickedQty: 0,
  blockedQty: 0,
  availableQty: onHandQty,
  uomId: 7,
  qualityStatusCode: 'NORMAL',
});

describe('위치별 재고 — 있음/없음 (US2-4)', () => {
  it('US2-4 ⭐ 재고가 있는 위치와 그 조상 전부가 「있음」이다', () => {
    const stock = buildLocationStock([balance(4, 'ITEM-A', 'LOT-1', 10)], LOCATIONS, false);

    expect([...stock.stockedLocationIds].sort()).toEqual([1, 2, 3, 4]);
  });

  it('US2-4 ⛔ 0 이거나 음수이거나 줄이 없는 위치는 「없음」이다', () => {
    const stock = buildLocationStock(
      [balance(5, 'ITEM-A', 'LOT-1', 0), balance(6, 'ITEM-B', null, -3)],
      LOCATIONS,
      false,
    );

    expect(stock.stockedLocationIds.size).toBe(0);
  });

  it('US2-4 ⭐ 목록에 없는 위치 id 의 재고는 버리지 않고 그 id 만 「있음」이다', () => {
    const stock = buildLocationStock([balance(99, 'ITEM-A', 'LOT-1', 1)], LOCATIONS, false);

    expect([...stock.stockedLocationIds]).toEqual([99]);
    expect(stock.rowsFor(99)).toHaveLength(1);
  });
});

describe('위치별 재고 — 고른 위치의 줄 (US2-5)', () => {
  const BALANCES = [
    balance(5, 'ITEM-B', 'LOT-2', 4),
    balance(4, 'ITEM-B', 'LOT-2', 6),
    balance(4, 'ITEM-A', 'LOT-9', 1),
    balance(4, 'ITEM-A', 'LOT-1', 2),
    balance(6, 'ITEM-C', null, 8),
    balance(null, 'ITEM-Z', null, 5),
  ];

  it('US2-5 ⭐ 셀은 그 셀의 줄만 — 위치 코드 → 품목 코드 → LOT 순이다', () => {
    const rows = buildLocationStock(BALANCES, LOCATIONS, false).rowsFor(4);

    expect(rows.map((row) => [row.itemCode, row.lotNo, row.onHandQty])).toEqual([
      ['ITEM-A', 'LOT-1', 2],
      ['ITEM-A', 'LOT-9', 1],
      ['ITEM-B', 'LOT-2', 6],
    ]);
    expect(rows[0]).toMatchObject({
      locationCode: 'Z01-R001-L01-C01',
      itemName: 'ITEM-A 이름',
      uomId: 7,
      qualityStatusCode: 'NORMAL',
    });
  });

  it('US2-5 ⭐ 랙은 하위 위치의 줄을 모은다 — 같은 품목 · LOT 이라도 위치가 다르면 더하지 않는다', () => {
    const rows = buildLocationStock(BALANCES, LOCATIONS, false).rowsFor(2);

    expect(rows.map((row) => [row.locationCode, row.itemCode, row.lotNo, row.onHandQty])).toEqual([
      ['Z01-R001-L01-C01', 'ITEM-A', 'LOT-1', 2],
      ['Z01-R001-L01-C01', 'ITEM-A', 'LOT-9', 1],
      ['Z01-R001-L01-C01', 'ITEM-B', 'LOT-2', 6],
      ['Z01-R001-L01-C02', 'ITEM-B', 'LOT-2', 4],
    ]);
  });

  it('US2-5 구역은 모든 하위를, 빈 위치는 빈 목록을 준다 — 위치가 없는 줄은 어디에도 들지 않는다', () => {
    const stock = buildLocationStock(BALANCES, LOCATIONS, false);

    expect(stock.rowsFor(1)).toHaveLength(5);
    expect(stock.rowsFor(3).every((row) => row.locationId === 4 || row.locationId === 5)).toBe(
      true,
    );
    expect(buildLocationStock([], LOCATIONS, false).rowsFor(4)).toEqual([]);
  });

  it('US2-5 쪽 상한에 걸렸으면 `truncated` 다', () => {
    expect(buildLocationStock(BALANCES, LOCATIONS, true).truncated).toBe(true);
    expect(buildLocationStock(BALANCES, LOCATIONS, false).truncated).toBe(false);
  });
});
