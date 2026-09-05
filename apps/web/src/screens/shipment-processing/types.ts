import type { components } from '@omf-mes/api-client';

/**
 * W-04-04 화면 슬라이스의 계약.
 *
 * `api-client`는 `import type`으로만 참조한다 — 런타임 코드를 끌어오지 않아야 화면의 순수성이 유지된다.
 *
 * 이 파일은 이 화면이 소유한다 — 다른 화면 슬라이스(`shipment-schedule`·`shipment-request-create`)의
 * 같은 이름 파일을 참조하지 않는다. 타입 모양이 겹쳐도 각자 새로 쓴다.
 */

type ShipmentRequestResponse = components['schemas']['ShipmentRequest'];
type ShipmentRequestLineResponse = components['schemas']['ShipmentRequestLine'];

export type ShipmentProgressCode = ShipmentRequestResponse['shipmentProgressCode'];

/** 출하작업지시 한 라인. `pickedQty`만 있고 `picks[]`(LOT별 내역)는 baseline에 없다(계획서 미결 항목). */
export interface ShipmentRequestLineCandidate {
  shipmentRequestLineId: number;
  lineNo: number;
  itemId: number;
  requestedQty: number;
  allocatedQty: number;
  pickedQty: number;
  shippedQty: number;
  uomId: number;
  shippingInspectionRequired: boolean;
}

export const toShipmentRequestLineCandidate = (
  line: ShipmentRequestLineResponse,
): ShipmentRequestLineCandidate => ({
  shipmentRequestLineId: line.shipmentRequestLineId,
  lineNo: line.lineNo,
  itemId: line.itemId,
  requestedQty: line.requestedQty,
  allocatedQty: line.allocatedQty,
  pickedQty: line.pickedQty,
  shippedQty: line.shippedQty,
  uomId: line.uomId,
  shippingInspectionRequired: line.shippingInspectionRequired,
});

/**
 * 출하작업지시 한 건.
 *
 * **`lines`가 `null`이면 「이번 응답이 라인을 내려주지 않았다」는 뜻이다** — 빈 배열(라인이 실제로
 * 0건)과 구분한다. 목록 조회는 계약상 `lines`가 선택 필드라 응답마다 있을 수도 없을 수도 있다
 * (`shipment-schedule`의 같은 처리를 따른다). 게이트 판정(`candidate-gate.ts`)이 이 구분으로
 * 「판정 불가」와 「판정 결과 라인이 없다」를 가른다.
 */
export interface ShipmentRequestCandidate {
  shipmentRequestId: number;
  shipmentRequestNo: string;
  customerId: number;
  shipToPartnerId: number;
  requestedShipDate: string;
  shipmentProgressCode: ShipmentProgressCode;
  shippingInspectionStatusCode: ShipmentRequestResponse['shippingInspectionStatusCode'];
  lines: ShipmentRequestLineCandidate[] | null;
}

/** 응답 한 건을 화면 타입으로 옮기는 유일한 지점이다. */
export const toShipmentRequestCandidate = (
  data: ShipmentRequestResponse,
): ShipmentRequestCandidate => ({
  shipmentRequestId: data.shipmentRequestId,
  shipmentRequestNo: data.shipmentRequestNo,
  customerId: data.customerId,
  shipToPartnerId: data.shipToPartnerId,
  requestedShipDate: data.requestedShipDate,
  shipmentProgressCode: data.shipmentProgressCode,
  shippingInspectionStatusCode: data.shippingInspectionStatusCode,
  lines: data.lines === undefined ? null : data.lines.map(toShipmentRequestLineCandidate),
});
