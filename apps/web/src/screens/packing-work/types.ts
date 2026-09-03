import type { components } from '@omf-mes/api-client';

/**
 * P-02-08 포장 작업 화면 슬라이스의 계약.
 *
 * ⭐ **포장 단위와 내용물이 다른 자원이다** — 포장 단위(`HandlingUnit`)는 서버가 번호를 매겨
 * 만들고, 내용물(`HandlingUnitContent`)은 확정할 때 한 트랜잭션으로 실린다(스펙 §5-6).
 * 둘을 한 타입으로 뭉치면 「포장 단위는 있고 아직 내용물이 실리지 않은」 상태 — 담는 중의
 * 정상 상태 — 를 표현할 수 없다.
 */
export type Lot = components['schemas']['Lot'];
export type HandlingUnit = components['schemas']['HandlingUnit'];
export type HandlingUnitCreate = components['schemas']['HandlingUnitCreate'];
export type HandlingUnitPack = components['schemas']['HandlingUnitPack'];
export type HandlingUnitContentUpsert = components['schemas']['HandlingUnitContentUpsert'];
export type HandlingUnitDetailResponse = components['schemas']['HandlingUnitDetailResponse'];
export type CodeValue = components['schemas']['CodeValue'];

/**
 * 포장 유형 값 목록이 사는 공통코드 그룹.
 *
 * ⛔ **값을 코드에 박지 않는다.** 계약이 「확정된 값 목록이 아직 없다 — 서버가 내려주는
 * 선택지를 그대로 쓴다」고 못박았다(공유계약 G-2 · G-32). ⛔ 채번 식별자(`codeGroupId`)도
 * 박지 않는다 — 환경마다 다르다.
 */
export const HANDLING_UNIT_TYPE_GROUP = 'HANDLING_UNIT_TYPE';

/**
 * 화면이 들고 있는 내용물 한 줄.
 *
 * ⭐ **`lotId` 와 `itemId` 가 둘 다 필수다**(스펙 §4-B — `NOT NULL`). LOT 없는 내용물은 없고,
 * 품목은 LOT 이 알려 준다 — 화면이 따로 고르게 하지 않는다.
 *
 * ⚠ **`uomId` 도 LOT 에서 온다.** 단위를 화면이 고르게 하면 같은 LOT 이 다른 단위로 담길 수
 * 있고, 그러면 합계가 뜻을 잃는다.
 */
export interface PackingLine {
  lotId: number;
  /** 표시용 — 서버에 보내는 값이 아니다. */
  lotNo: string;
  itemId: number;
  uomId: number;
  qty: number;
}

/**
 * 담는 중인 포장 하나. **번호는 서버가 매긴다** — 화면이 지어낼 수 없다(스펙 §4-A 「자동」).
 *
 * ⚠ **`handlingUnit` 이 `null` 인 동안에도 유형·상위는 고를 수 있다.** 포장 단위는 첫 내용물을
 * 담을 때 만들어지므로(스펙 §3 이 담는 동안 번호를 보이라 한다), 그전까지는 고른 값만 있고
 * 서버 자원이 없다.
 */
export interface PackingDraft {
  handlingUnitTypeCode: string | null;
  parentHandlingUnitId: number | null;
  handlingUnit: HandlingUnit | null;
  lines: PackingLine[];
}

export const emptyPackingDraft: PackingDraft = {
  handlingUnitTypeCode: null,
  parentHandlingUnitId: null,
  handlingUnit: null,
  lines: [],
};
