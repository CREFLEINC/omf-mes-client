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
 * **`검사`는 두 상태뿐이다**(대상/대상 아님) — 계약에 검사 *결과*를 이을 필드가 없어
 * L-8이 요구하는 「대상 아님 · 대기 · 합격」 세 상태를 낼 수 없다(설계 검토 요청 omf-mes#232).
 * `lines`가 비어 있으면(선택 필드) 「대상 아님」과 같은 모양이 된다 — 목 서버(`pnpm mock`)의
 * `GET /logistics/shipment-requests`가 목록 응답에 `lines`를 채우는 것을 실측했다(2026-08-25).
 * 실 서버가 같게 채우는지는 목만으로 확정할 수 없다 — 비워서 낼 경우 이 화면은 빈 것으로만
 * 그리고 값을 지어내지 않으므로 위험 방향이 안전 쪽이다.
 */
export interface ShipmentRequestView {
  shipmentRequestId: number;
  shipmentRequestNo: string;
  customerId: number;
  shipToPartnerId: number;
  requestedShipDate: string;
  statusCode: string;
  hasInspectionRequiredLine: boolean;
  lineTotals: LineQtyTotals | null;
}

/** 응답 한 건을 화면 타입으로 옮기는 **유일한 지점**이다. */
export const toShipmentRequestView = (data: ShipmentRequestResponse): ShipmentRequestView => ({
  shipmentRequestId: data.shipmentRequestId,
  shipmentRequestNo: data.shipmentRequestNo,
  customerId: data.customerId,
  shipToPartnerId: data.shipToPartnerId,
  requestedShipDate: data.requestedShipDate,
  statusCode: data.statusCode,
  hasInspectionRequiredLine: (data.lines ?? []).some((line) => line.shippingInspectionRequired),
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
