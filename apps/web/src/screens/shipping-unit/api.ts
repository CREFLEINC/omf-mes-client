/**
 * P-04-05 가 서버에 묻는 것 — **모양만 적어 둔다.**
 *
 * ⚠⚠ **아직 붙이지 않았다.** `/logistics/shipping-units` 경로가 전달본에 한 건도 없다
 *    (SHIP-UNIT-01 P4b — 서버가 먼저 올리고 전달본이 오면 P4c 에서 잇는다).
 *
 * ⭐ **인터페이스를 먼저 두는 까닭.** 화면과 그 판단(`compose-state`)을 서버 없이 세우고
 *    시험할 수 있다. 전달본이 오면 **이 인터페이스를 채우는 구현만** 더하면 되고, 화면은
 *    건드리지 않는다.
 *
 * ⛔ **가짜 값을 돌려주는 구현을 두지 않는다.** 그러면 화면이 「되는 것처럼」 보이고, 안 붙었다는
 *    사실이 실기에서야 드러난다. 붙기 전에는 `null` 이고, 화면은 아무것도 고를 수 없다.
 */

import type { AddBoxRejection, ShippingUnitDetail } from './types';

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

export type AddBoxResult =
  | { kind: 'added'; unit: ShippingUnitDetail }
  | { kind: 'rejected'; rejection: AddBoxRejection };

export interface ShippingUnitApi {
  shipments: { items: ComposableShipment[]; isPending: boolean; isError: boolean };
  types: { items: ShippingUnitTypeOption[]; isPending: boolean; isError: boolean };
  createUnit: (shipmentId: number, typeCode: string) => Promise<ShippingUnitDetail>;
  addBox: (shippingUnitId: number, handlingUnitNo: string) => Promise<AddBoxResult>;
  removeBox: (shippingUnitId: number, handlingUnitId: number) => Promise<ShippingUnitDetail>;
  /** 마감하고 납품 라벨까지 낸다 — 회차는 발행 응답이 준다(설계 §5-4). */
  closeUnit: (shippingUnitId: number) => Promise<{ unit: ShippingUnitDetail; issueSeq: number }>;
}
