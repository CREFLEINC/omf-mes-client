import type { components } from '@omf-mes/api-client';

/**
 * W-04-06 화면 슬라이스의 계약.
 *
 * ⭐ 한 화면이 두 계약을 쓴다 — 원 출하 조회는 04(출하), 입고 처리는 01(자재창고). 생성물은 한 벌로
 * 합쳐져 있어 여기서는 스키마 이름만 가른다.
 *
 * 이 파일은 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 파일을 참조하지 않는다.
 */

export type PageMeta = components['schemas']['PageMeta'];
export type Shipment = components['schemas']['Shipment'];
export type ShipmentLotAllocation = components['schemas']['ShipmentLotAllocation'];
export type Lot = components['schemas']['Lot'];
export type GoodsReceiptCreate = components['schemas']['GoodsReceiptCreate'];
export type GoodsReceiptLineCreate = components['schemas']['GoodsReceiptLineCreate'];
export type GoodsReceiptDetailResponse = components['schemas']['GoodsReceiptDetailResponse'];
export type WarehouseResponse = components['schemas']['Warehouse'];
export type LocationResponse = components['schemas']['Location'];

export const formatQty = (value: number | null | undefined): string =>
  value === null || value === undefined ? '' : String(value);

/** ISO 일시의 날짜 부분. 서버가 offset 을 실어 보내므로 앞 10자가 그 지역의 날짜다. */
export const formatDate = (value: string | null | undefined): string =>
  value === null || value === undefined || value === '' ? '' : value.slice(0, 10);

export interface ShipmentLotSummary {
  lotId: number;
  lotNo: string;
  itemCode: string;
  qty: number;
}

/**
 * 원 출하 목록의 한 줄.
 *
 * ⚠ 목록 응답의 `lines`·`allocations` 는 선택 필드다 — 없으면 「없다」가 아니라 **모른다**다.
 * `null` 로 들고 있다가 표시 지점에서 「선택하면 보인다」를 적는다. 빈 배열로 접으면 배분이
 * 없는 출하처럼 보인다.
 */
export interface ShipmentRow {
  shipmentId: number;
  shipmentNo: string;
  shippedAtText: string;
  statusCode: string;
  /** 「품목코드 · 수량」을 라인마다 — 라인이 안 오면 `null` */
  itemSummary: string | null;
  lots: ShipmentLotSummary[] | null;
}

export const toShipmentRow = (data: Shipment): ShipmentRow => {
  const lines = data.lines;
  if (lines === undefined) {
    return {
      shipmentId: data.shipmentId,
      shipmentNo: data.shipmentNo,
      shippedAtText: formatDate(data.shippedAt),
      statusCode: data.statusCode,
      itemSummary: null,
      lots: null,
    };
  }

  const allocations = lines.flatMap((line) => line.allocations ?? []);
  const itemSummary = lines
    .map((line) => {
      const code = line.allocations?.[0]?.itemCode ?? String(line.itemId);
      return `${code} · ${formatQty(line.shippedQty)}`;
    })
    .join(' / ');

  return {
    shipmentId: data.shipmentId,
    shipmentNo: data.shipmentNo,
    shippedAtText: formatDate(data.shippedAt),
    statusCode: data.statusCode,
    itemSummary,
    lots: lines.some((line) => line.allocations === undefined)
      ? null
      : allocations.map((allocation) => ({
          lotId: allocation.lotId,
          lotNo: allocation.lotNo ?? String(allocation.lotId),
          itemCode: allocation.itemCode,
          qty: allocation.allocatedQty,
        })),
  };
};

/**
 * 반품 라인의 근원 — **원 출하의 배분 한 줄**이거나 **직접 찾은 LOT 하나**다.
 *
 * ⭐ 배분(`shipmentLotAllocationId`)이 있어야 「어느 출하의 어느 LOT 이 돌아왔는지」가 이어진다
 * (`originalShipmentLotAllocationId`). 한 LOT 이 여러 출하에 나뉘어 나가므로 서버는 `lotId` 만으로
 * 못 잇는다 — 이 값은 등록 시점에만 알 수 있다(스펙 §5-3).
 */
export interface ReturnLineSource {
  /** 줄 식별 — `alloc:<배분>` 또는 `lot:<LOT>` */
  key: string;
  allocationId: number | null;
  itemId: number;
  itemCode: string | null;
  lotId: number;
  lotNo: string;
  uomId: number;
  /** 원 출하가 있을 때만 — 반품 수량의 상한이다. 직접 입력은 상한이 없다 */
  shippedQty: number | null;
}

export const toReturnLineSources = (detail: Shipment): ReturnLineSource[] =>
  (detail.lines ?? []).flatMap((line) =>
    (line.allocations ?? []).map((allocation) => ({
      key: `alloc:${String(allocation.shipmentLotAllocationId)}`,
      allocationId: allocation.shipmentLotAllocationId,
      itemId: allocation.itemId,
      itemCode: allocation.itemCode,
      lotId: allocation.lotId,
      lotNo: allocation.lotNo ?? String(allocation.lotId),
      uomId: allocation.uomId,
      shippedQty: allocation.allocatedQty,
    })),
  );

/** 직접 찾은 LOT — 품목·단위는 LOT 이 정한다. 원 출하 수량은 모른다. */
export const toLotLineSource = (lot: Lot): ReturnLineSource => ({
  key: `lot:${String(lot.lotId)}`,
  allocationId: null,
  itemId: lot.itemId,
  itemCode: null,
  lotId: lot.lotId,
  lotNo: lot.lotNo,
  uomId: lot.uomId,
  shippedQty: null,
});

export interface WarehouseView {
  warehouseId: number;
  plantId: number;
  warehouseCode: string;
  warehouseName: string;
  isDefect: boolean;
  isActive: boolean;
}

export const toWarehouseView = (data: WarehouseResponse): WarehouseView => ({
  warehouseId: data.warehouseId,
  plantId: data.plantId,
  warehouseCode: data.warehouseCode,
  warehouseName: data.warehouseName,
  isDefect: data.isDefect,
  isActive: data.isActive,
});

export interface LocationView {
  locationId: number;
  locationCode: string;
  locationName: string;
  parentLocationId: number | null;
  isActive: boolean;
}

export const toLocationView = (data: LocationResponse): LocationView => ({
  locationId: data.locationId,
  locationCode: data.locationCode,
  locationName: data.locationName,
  parentLocationId: data.parentLocationId ?? null,
  isActive: data.isActive,
});
