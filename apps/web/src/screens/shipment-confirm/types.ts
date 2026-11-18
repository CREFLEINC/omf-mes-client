import type { components } from '@omf-mes/api-client';

/**
 * W-04-12 출하 내역 화면 슬라이스의 계약(피처 010 · omf-all-around#305).
 *
 * `api-client`는 `import type`으로만 참조한다 — 런타임 코드를 끌어오지 않아야 화면의 순수성이
 * 유지된다. 이 파일은 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 파일을 참조하지 않는다.
 */

type ShipmentResponse = components['schemas']['Shipment'];
type ShipmentRequestResponse = components['schemas']['ShipmentRequest'];

export type ErpSendStatus = NonNullable<ShipmentResponse['erpSendStatus']>;

/** 계약 6값의 차례 — 거르기 칩과 표시가 이 차례를 따른다(시안 W0412-After). */
export const ERP_SEND_STATUSES: readonly ErpSendStatus[] = [
  'PENDING',
  'SENT',
  'SEND_ERROR',
  'NOT_SENT_NO_SALES_ORDER',
  'CANCELLED',
  'NOT_QUEUED',
];

/** 재고가 빠진 창고 하나 — 출고 전표(창고마다 한 장)·빠진 수량·위치별 수량(시안 W0412 「재고가 빠진 창고」). */
export interface WarehouseRef {
  warehouseId: number;
  warehouseName: string;
  warehouseCode: string;
  goodsIssueNos: string[];
  /** 빠진 수량. 응답에 칸이 없으면(옛 서버) null — 0 으로 지어내지 않는다. */
  qty: number | null;
  locations: { locationCode: string; staging: boolean; qty: number }[];
}

/** 적치 대기 자리(위치 시스템 역할). */
const STAGING_ROLE = 'PUTAWAY_STAGING';

/**
 * 출하 한 건(목록 행).
 *
 * ⚠ **`shippedAt`이 선택 필드다.** 경과가 이 값에서 나오므로 없으면 「0시간 경과」가 아니라
 * 셀 수 없는 것이다 — `null`로 들고 있다가 표시 지점에서 사실을 적는다.
 */
export interface ShipmentRow {
  shipmentId: number;
  shipmentNo: string;
  shipmentRequestId: number;
  shippedAt: string | null;
  statusCode: string;
  expedited: boolean;
  erpDeliveryNo: string | null;
  /** 출하 지시서·고객·납품처·수주(목록 「고객 · 지시서」 칸). 옛 응답이면 null. */
  shipmentRequestNo: string | null;
  customerName: string | null;
  shipToName: string | null;
  salesOrderNo: string | null;
  /** 서버 판정 그대로. 옛 서버가 안 내리면 `null` — 화면이 지어내지 않는다. */
  erpSendStatus: ErpSendStatus | null;
  cancelRequestPending: boolean;
  completedTerminalCode: string | null;
  completedWorker: { workerNo: string; workerName: string } | null;
  /** 재고가 빠진 창고들. 새 흐름 출하는 `warehouse` 가 null 이고 이것만 있다(D-15). */
  warehouses: WarehouseRef[];
  /** 출하 수량 합. 라인이 안 오면 셀 수 없다 — 0과 구분한다. */
  totalQty: number | null;
}

const sumShippedQty = (lines: ShipmentResponse['lines']): number | null => {
  if (lines === undefined) return null;
  return lines.reduce((sum, line) => sum + line.shippedQty, 0);
};

export const toShipmentRow = (data: ShipmentResponse): ShipmentRow => ({
  shipmentId: data.shipmentId,
  shipmentNo: data.shipmentNo,
  shipmentRequestId: data.shipmentRequestId,
  shippedAt: data.shippedAt ?? null,
  statusCode: data.statusCode,
  expedited: data.expedited,
  erpDeliveryNo: data.erpDeliveryNo ?? null,
  shipmentRequestNo: data.shipmentRequestNo ?? null,
  customerName: data.customer?.partnerName ?? null,
  shipToName: data.shipTo?.partnerName ?? null,
  salesOrderNo: data.salesOrderNo ?? null,
  erpSendStatus: data.erpSendStatus ?? null,
  cancelRequestPending: data.cancelRequestPending ?? false,
  completedTerminalCode: data.completedTerminal?.terminalCode ?? null,
  completedWorker:
    data.completedWorker == null
      ? null
      : { workerNo: data.completedWorker.workerNo, workerName: data.completedWorker.workerName },
  warehouses: (data.warehouses ?? []).map((warehouse) => ({
    warehouseId: warehouse.warehouseId,
    warehouseName: warehouse.warehouseName,
    warehouseCode: warehouse.warehouseCode,
    goodsIssueNos: warehouse.goodsIssueNos ?? [],
    qty: warehouse.qty ?? null,
    locations: (warehouse.locations ?? []).map((location) => ({
      locationCode: location.locationCode,
      staging: location.locationSystemRoleCode === STAGING_ROLE,
      qty: location.qty,
    })),
  })),
  totalQty: sumShippedQty(data.lines),
});

/** 라인의 LOT 한 줄 — 잔액 행마다 나뉜 배분을 LOT 하나로 모은다. */
export interface ShippedLot {
  lotId: number;
  lotNo: string;
  qty: number;
  managementCode: string | null;
  /** 재고가 빠진 곳 — 창고별 몫(배분 기준). 지시서에 위치 몫이 있으면 그것을 쓴다. */
  places: { label: string; qty: number }[];
  oqcLotStatus: OqcLotStatus | null;
}

export type OqcLotStatus = NonNullable<components['schemas']['ShipmentRequestLot']['oqcLotStatus']>;

export interface ReplacedLot {
  lotNo: string;
  replacedAt: string;
  nonconformanceNo: string | null;
}

export interface ShipmentDetailLine {
  lineNo: number;
  itemCode: string;
  shippedQty: number;
  /** 목표(지시서 라인 배정 수량). 지시서를 못 받았으면 `null`. */
  targetQty: number | null;
  overQty: number;
  lots: ShippedLot[];
  replaced: ReplacedLot[];
}

export interface ShipmentDetail {
  row: ShipmentRow;
  /** 지시서 번호. 지시서를 못 받았으면 `null`. */
  shipmentRequestNo: string | null;
  lines: ShipmentDetailLine[];
}

export interface ShipmentRequestSummary {
  shipmentRequestNo: string;
  lines: ShipmentRequestResponse['lines'];
}

/**
 * 출하 상세와 그 지시서를 합쳐 라인·LOT 표를 만든다.
 *
 * ⭐ 출하 배분은 **잔액 행마다** 생긴다(D-15) — 한 LOT 이 두 창고에서 나가면 배분이 둘이다.
 * 화면은 LOT 하나로 모으고 창고별 몫을 함께 적는다. 위치(로케이션)는 출하 응답에 없어, 지시서의
 * 피킹 LOT 몫(`portions`)이 있으면 그것으로 적는다.
 */
export const toShipmentDetail = (
  data: ShipmentResponse,
  request: ShipmentRequestSummary | null,
): ShipmentDetail => {
  const row = toShipmentRow(data);
  const warehouseName = new Map(row.warehouses.map((w) => [w.warehouseId, w.warehouseName]));

  const lines = (data.lines ?? []).map((line): ShipmentDetailLine => {
    const requestLine = request?.lines?.find(
      (candidate) => candidate.shipmentRequestLineId === line.shipmentRequestLineId,
    );
    const requestLots = requestLine?.lots ?? [];
    const lots = new Map<number, ShippedLot>();
    let itemCode = '';

    for (const allocation of line.allocations ?? []) {
      itemCode = allocation.itemCode;
      const place = {
        label: warehouseName.get(allocation.warehouseId) ?? String(allocation.warehouseId),
        qty: allocation.allocatedQty,
      };
      const existing = lots.get(allocation.lotId);
      if (existing === undefined) {
        lots.set(allocation.lotId, {
          lotId: allocation.lotId,
          lotNo: allocation.lotNo ?? String(allocation.lotId),
          qty: allocation.allocatedQty,
          managementCode: allocation.managementCode ?? null,
          places: [place],
          oqcLotStatus: null,
        });
      } else {
        existing.qty += allocation.allocatedQty;
        existing.managementCode ??= allocation.managementCode ?? null;
        const same = existing.places.find((one) => one.label === place.label);
        if (same === undefined) existing.places.push(place);
        else same.qty += place.qty;
      }
    }

    for (const lot of lots.values()) {
      const picked = requestLots.find(
        (candidate) => candidate.lotId === lot.lotId && candidate.statusCode !== 'REPLACED',
      );
      if (picked === undefined) continue;
      lot.oqcLotStatus = picked.oqcLotStatus;
      const located = picked.portions.filter((portion) => portion.locationCode !== null);
      if (located.length > 0) {
        lot.places = picked.portions.map((portion) => ({
          label:
            portion.locationCode === null
              ? portion.warehouseName
              : `${portion.warehouseName} ${portion.locationCode}`,
          qty: portion.qty,
        }));
      }
    }

    return {
      lineNo: line.lineNo,
      itemCode,
      shippedQty: line.shippedQty,
      targetQty: requestLine?.allocatedQty ?? null,
      overQty: requestLine?.overQty ?? 0,
      lots: [...lots.values()],
      replaced: requestLots
        .filter((lot) => lot.statusCode === 'REPLACED' && lot.replacement !== null)
        .map((lot) => ({
          lotNo: lot.lotNo,
          replacedAt: lot.replacement?.replacedAt ?? '',
          nonconformanceNo: lot.replacement?.nonconformanceNo ?? null,
        })),
    };
  });

  return {
    row,
    shipmentRequestNo: row.shipmentRequestNo ?? request?.shipmentRequestNo ?? null,
    lines,
  };
};
