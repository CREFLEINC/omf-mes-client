import type { components } from '@omf-mes/api-client';

/**
 * W-04-05 화면 슬라이스의 계약.
 *
 * `api-client`는 `import type`으로만 참조한다 — 런타임 코드를 끌어오지 않아야 화면의 순수성이
 * 유지된다.
 *
 * 이 파일은 이 화면이 소유한다 — 다른 화면 슬라이스(`shipment-processing`·`shipment-schedule`)의
 * 같은 이름 파일을 참조하지 않는다. 타입 모양이 겹쳐도 각자 새로 쓴다.
 */

type LotResponse = components['schemas']['Lot'];
type ShipmentRequestResponse = components['schemas']['ShipmentRequest'];
type ShipmentRequestLineResponse = components['schemas']['ShipmentRequestLine'];

/**
 * ① 대상 제품 LOT — 「생산 완료분이면서 아직 입고 전표에 실리지 않은」 LOT 한 건.
 *
 * ⚠ **`held`는 선택 필드다.** 서버가 안 내리면 「보류 아님」이 아니라 **모른다**인데, 화면이
 * 그것을 「아님」으로 접으면 보류 LOT을 출하 가능처럼 보이게 한다. 그래서 `undefined`를
 * 그대로 들고 있다가 판정 지점(`lot-release.ts`)에서 가른다.
 */
export interface ProductionLotCandidate {
  lotId: number;
  lotNo: string;
  itemId: number;
  initialQty: number;
  uomId: number;
  statusCode: string;
  held: boolean | undefined;
}

export const toProductionLotCandidate = (lot: LotResponse): ProductionLotCandidate => ({
  lotId: lot.lotId,
  lotNo: lot.lotNo,
  itemId: lot.itemId,
  initialQty: lot.initialQty,
  uomId: lot.uomId,
  statusCode: lot.statusCode,
  held: lot.held,
});

/**
 * ② 출하 대상 — 출하작업지시 한 라인.
 *
 * ⭐ **배정 잔여를 화면이 뺄셈으로 낸다** — 계약에 잔여 필드가 없고 `allocatedQty`·`shippedQty`
 * 두 값만 온다. 참고값이며 최종 판정은 서버가 한다(공유계약 A-9 ⓑ와 같은 형태).
 */
export interface ShipmentRequestTargetLine {
  shipmentRequestLineId: number;
  lineNo: number;
  itemId: number;
  allocatedQty: number;
  shippedQty: number;
  uomId: number;
}

export const toShipmentRequestTargetLine = (
  line: ShipmentRequestLineResponse,
): ShipmentRequestTargetLine => ({
  shipmentRequestLineId: line.shipmentRequestLineId,
  lineNo: line.lineNo,
  itemId: line.itemId,
  allocatedQty: line.allocatedQty,
  shippedQty: line.shippedQty,
  uomId: line.uomId,
});

/**
 * 출하작업지시 한 건.
 *
 * **`lines`가 `null`이면 「이번 응답이 라인을 내려주지 않았다」는 뜻이다** — 라인이 실제로 0건인
 * 빈 배열과 구분한다. 목록 조회는 계약상 `lines`가 선택 필드라 응답마다 있을 수도 없을 수도
 * 있고, 이 구분을 접으면 「라인을 못 받았다」가 「맞는 라인이 없다」로 둔갑한다.
 */
export interface ShipmentRequestTarget {
  shipmentRequestId: number;
  shipmentRequestNo: string;
  requestedShipDate: string;
  lines: ShipmentRequestTargetLine[] | null;
}

export const toShipmentRequestTarget = (data: ShipmentRequestResponse): ShipmentRequestTarget => ({
  shipmentRequestId: data.shipmentRequestId,
  shipmentRequestNo: data.shipmentRequestNo,
  requestedShipDate: data.requestedShipDate,
  lines: data.lines === undefined ? null : data.lines.map(toShipmentRequestTargetLine),
});

/** 고른 LOT의 품목과 맞는 라인. 없으면 그 지시로는 이 LOT을 낼 수 없다. */
export const lineForItem = (
  target: ShipmentRequestTarget,
  itemId: number,
): ShipmentRequestTargetLine | null => target.lines?.find((line) => line.itemId === itemId) ?? null;

/**
 * 배정 잔여 — 배정에서 이미 출하된 만큼을 뺀다.
 *
 * ⚠ 음수가 나오면 0으로 접는다. 서버가 과출하를 허용한 흔적일 수 있는데, 음수 상한을 화면에
 * 보이면 「−20을 넘을 수 없습니다」 같은 말이 된다.
 */
export const remainingQtyOf = (line: ShipmentRequestTargetLine): number =>
  Math.max(0, line.allocatedQty - line.shippedQty);
