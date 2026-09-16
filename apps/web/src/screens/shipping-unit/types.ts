/**
 * P-04-05 출하 단위 구성이 다루는 값들.
 *
 * ⚠⚠ **계약 타입을 아직 쓰지 못한다.** `/logistics/shipping-units` 경로는 전달본에 **한 건도
 *    없다**(실측 — `SHIPPING_UNIT` 문자열이 `api.d.ts` 에 0건). 서버가 먼저 올리고 전달본이
 *    오면 이 파일의 모양을 **그때 계약에서 끌어온다.**
 *
 * ⛔ **그때까지 이 모양을 «계약처럼» 다루지 않는다.** 여기 적은 이름은 설계 선행 문서 §4-3 을
 *    보고 세운 것이라 전달본과 어긋날 수 있다. 어긋나면 고치는 자리는 이 파일 하나다 —
 *    화면·라벨은 이 타입만 본다.
 *
 * ⛔ **계약에 없는 값을 지어내지 않는다.** 설계가 적지 않은 칸은 여기에도 두지 않는다 —
 *    자리를 만들어 두면 언젠가 그 자리를 채우려고 없는 조회를 부르게 된다.
 */

/** 출하 단위의 상태. 편도다 — 마감은 되돌릴 수 없다(설계 §4-6). */
export type ShippingUnitStatus = 'OPEN' | 'CLOSED';

export interface ShippingUnitPartner {
  partnerId: number;
  partnerCode: string;
  partnerName: string;
}

/** 상자에 든 것 한 줄. */
export interface ShippingUnitContent {
  itemId: number;
  itemCode: string;
  itemName: string;
  lotId: number;
  lotNo: string;
  qty: number;
  uomId: number;
  uomCode: string;
}

/** 이 출하 단위에 등록된 상자 한 개. */
export interface ShippingUnitBox {
  handlingUnitId: number;
  handlingUnitNo: string;
  /** 스캔해 넣은 차례. 화면 목록의 번호가 이 값이다. */
  seq: number;
  contents: ShippingUnitContent[];
}

/**
 * 품목별 합 — **납품 라벨의 본문**이다(설계 §4-3).
 *
 * ⛔ **화면이 합하지 않는다.** 서버가 상자 내용물을 품목·단위별로 합해 준다. 화면이 세면
 *    받은 상자 목록이 일부일 때(쪽 나눔·조회 실패) **틀린 합이 라벨에 찍힌다.**
 */
export interface ShippingUnitItemTotal {
  itemId: number;
  itemCode: string;
  itemName: string;
  qty: number;
  uomId: number;
  uomCode: string;
}

export interface ShippingUnitDetail {
  shippingUnitId: number;
  shippingUnitNo: string;
  shippingUnitTypeCode: string;
  statusCode: ShippingUnitStatus;
  shipmentId: number;
  shipmentNo: string;
  customer: ShippingUnitPartner;
  shipTo: ShippingUnitPartner;
  boxCount: number;
  boxes: ShippingUnitBox[];
  itemTotals: ShippingUnitItemTotal[];
}

/**
 * 상자 등록이 막힌 사유 — **다섯 갈래를 가른다**(설계 §5-3).
 *
 * ⭐ **서버가 `errors[].code` 와 `field` 로 갈라 준다**(통합 담당 확정 2026-09-16). HTTP 상태와
 *    코드만으로는 「마감된 단위」와 「포장 안 된 상자」가 둘 다 `STATE_LOCKED` 로 뭉개져
 *    구별되지 않는다 — 그래서 `field` 를 함께 본다.
 *
 * ⛔ **모르는 사유를 다섯 중 하나로 접지 않는다.** 엉뚱한 안내를 하면 담당이 할 수 없는 조치를
 *    되풀이한다. 모르면 `unknown` 으로 두고 서버가 준 말을 그대로 보인다.
 */
export type AddBoxRejection =
  | { kind: 'unitClosed' }
  | { kind: 'notPacked' }
  | { kind: 'noAllocation' }
  | { kind: 'otherShipment' }
  | { kind: 'alreadyAssigned' }
  | { kind: 'shipmentCancelled' }
  | { kind: 'notFound' }
  | { kind: 'unknown'; message: string | null };
