/**
 * P-04-05 의 선택지 모양.
 *
 * ⭐ **화면이 쓰는 모양만 좁혀 적는다.** 계약 응답을 통째로 끌고 다니면 그리지도 보내지도
 *    않는 값이 화면 타입에 섞이고, 자리를 두지 않으면 새어 나갈 경로도 없다.
 */

/** ① 출하 선택에 세울 한 줄. 서버가 「미구성 PACKED 상자가 있는 출하」만 걸러 준다(설계 §5-1). */
export interface ComposableShipment {
  shipmentId: number;
  shipmentNo: string;
  /** 아직 출하 단위에 들어가지 않은 상자 수. 서버가 센다 — 화면이 세면 N+1 이 된다. */
  unassignedPackedBoxCount: number;
}

/** ② 유형 선택지. `GET /mdm/code-values?codeGroupCode=SHIPPING_UNIT_TYPE`(고객 관리형). */
export interface ShippingUnitTypeOption {
  code: string;
  codeName: string;
}
