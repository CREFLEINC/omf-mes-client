import type { components } from '@omf-mes/api-client';

/**
 * W-04-02 화면 슬라이스의 계약.
 *
 * `api-client`는 `import type`으로만 참조한다 — 런타임 코드를 끌어오지 않아야 화면의 순수성이 유지된다.
 *
 * 이 화면은 **읽기만 한다.** `GET /logistics/shipment-requests`만 부른다 — 행 클릭으로
 * 편성(`W-04-01`)·출하 확정(`W-04-04`)으로 이동하는 액션은 그 화면들이 이 저장소에 아직 없어
 * 이번 슬라이스에 없다(계획서 미결 항목).
 *
 * 이 파일은 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 파일을 참조하지 않는다.
 */

type ShipmentRequestResponse = components['schemas']['ShipmentRequest'];
type ShipmentRequestLineResponse = components['schemas']['ShipmentRequestLine'];

export type ShipmentProgressCode = ShipmentRequestResponse['shipmentProgressCode'];

export type PageMeta = components['schemas']['PageMeta'];

/** 한 행의 요청/배정/출하 합계 — **그 행 자신의 `lines`만 더한다**(다른 행·페이지를 넘나들지 않는다). */
export interface LineQtyTotals {
  requestedQty: number;
  allocatedQty: number;
  shippedQty: number;
}

/**
 * `lines`를 세 합계로 접는다. 계약에서 `lines`는 선택 필드다 — 비어 있거나 없으면 `null`을 낸다.
 * **0/0/0을 내지 않는다** — 그러면 「수량이 0」과 「받지 못했다」가 같은 모양이 된다.
 */
export const toLineQtyTotals = (
  lines: ShipmentRequestLineResponse[] | undefined,
): LineQtyTotals | null => {
  if (lines === undefined || lines.length === 0) return null;

  return lines.reduce<LineQtyTotals>(
    (totals, line) => ({
      requestedQty: totals.requestedQty + line.requestedQty,
      allocatedQty: totals.allocatedQty + line.allocatedQty,
      shippedQty: totals.shippedQty + line.shippedQty,
    }),
    { requestedQty: 0, allocatedQty: 0, shippedQty: 0 },
  );
};

/**
 * 화면이 다루는 출하작업지시 한 건.
 *
 * **`검사`는 서버가 롤업한 값을 그대로 옮긴다** — 화면이 `lines`를 순회해 스스로 판정하지
 * 않는다(계약 주석 W-04-02 §5-3 · omf-mes#232 · omf-mes#235). `REJECTED`·`HELD`는 이번
 * 슬라이스에서 전용 배지를 두지 않고 `PENDING`과 같게 표시한다 — 렌더 쪽(`shipment-table.tsx`)
 * 판단이며, 값 자체는 그대로 옮긴다.
 */
export interface ShipmentRequestView {
  shipmentRequestId: number;
  shipmentRequestNo: string;
  customerId: number;
  shipToPartnerId: number;
  requestedShipDate: string;
  shipmentProgressCode: ShipmentProgressCode;
  inspectionStatus: ShipmentRequestResponse['shippingInspectionStatusCode'];
  lineTotals: LineQtyTotals | null;
}

/** 응답 한 건을 화면 타입으로 옮기는 **유일한 지점**이다. */
export const toShipmentRequestView = (data: ShipmentRequestResponse): ShipmentRequestView => ({
  shipmentRequestId: data.shipmentRequestId,
  shipmentRequestNo: data.shipmentRequestNo,
  customerId: data.customerId,
  shipToPartnerId: data.shipToPartnerId,
  requestedShipDate: data.requestedShipDate,
  shipmentProgressCode: data.shipmentProgressCode,
  inspectionStatus: data.shippingInspectionStatusCode,
  lineTotals: toLineQtyTotals(data.lines),
});

/** 목록 조회 결과. `page`는 쪽 이동과 위치 표시의 정본이다. */
export interface ShipmentScheduleListResult {
  items: ShipmentRequestView[];
  page: PageMeta;
}

export interface LookupEntry {
  value: string;
  label: string;
  isActive: boolean;
}

export interface SelectOption {
  value: string;
  label: string;
}
