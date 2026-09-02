import type { components } from '@omf-mes/api-client';

/**
 * 이 화면이 다루는 값의 타입. **계약 타입을 그대로 쓰고 화면 타입을 새로 짓지 않는다** —
 * 배분 응답이 스캔 판정·포장 본문·상위 후보 좁힘의 입력을 전부 싣고 오므로(`omf-mes#330`),
 * 중간 타입을 두면 어느 칸이 서버에서 온 것인지가 흐려진다.
 *
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 파일을 참조하지 않는다.
 */

/** 출하 LOT 배분. 이 화면의 모든 판단이 여기서 나온다. */
export type ShipmentLotAllocation = components['schemas']['ShipmentLotAllocation'];

export type HandlingUnit = components['schemas']['HandlingUnit'];
export type HandlingUnitContentUpsert = components['schemas']['HandlingUnitContentUpsert'];

/**
 * 서버의 매칭 판정(스펙 §5-1). ⛔ **화면이 이 값을 만들지 않는다** — 배분 목록을 받아
 * 비교하면 캐시 상태에서 틀린다.
 */
export interface MatchVerdict {
  matched: boolean;
  reasonCode?: string | null;
}

/**
 * 둘째 스캔의 결과 — 담기 전 단계의 값이다.
 *
 * ⚠ **판정과 배분을 갈라 둔다.** 「이 출하에 배분되지 않은 LOT」은 판정이 «다르다»이면서
 * 배분 자체가 없는 자리라, 둘을 한 칸에 묶으면 없는 값을 있는 척 채워야 한다.
 */
export interface MatchedLot {
  allocation?: ShipmentLotAllocation;
  verdict: MatchVerdict;
}

/**
 * 포장에 담긴 한 줄.
 *
 * ⭐ **줄의 정체는 «배분»이다.** 같은 품목·LOT 이 두 배분으로 나뉘어 오지 않는다는 보장이
 * 없으므로 담긴 줄을 배분 식별자로 잡는다 — 확정할 때 어느 배분에 포장을 이어야 하는지가
 * 그 식별자에 달려 있다(§4-C).
 */
export interface PackedLine {
  shipmentLotAllocationId: number;
  itemId: number;
  itemCode: string;
  lotId: number;
  lotNo: string;
  uomId: number;
  /** 이 포장에 담은 수량. 같은 LOT 을 다시 읽으면 여기에 더한다(§5-3). */
  qty: number;
  /** 이 배분의 잔여 — `allocatedQty − packedQty`. **서버가 파생한 값에서 온다**(L-2). */
  remaining: number;
}
