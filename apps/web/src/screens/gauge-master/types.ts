import type { components } from '@omf-mes/api-client';

/**
 * W-05-11 화면 슬라이스의 계약.
 *
 * ⭐ **계측기 전용 자원이 없다** — 계측기는 설비의 한 종류이고 `equipmentTypeCode` 가 가른다
 * (스펙 §3-2). 그래서 타입도 `Equipment` 를 그대로 쓴다.
 */
export type Equipment = components['schemas']['Equipment'];

export interface GaugeFilters {
  q: string;
  plantId: string;
  /** 세부 계측기 유형. ⚠ 값 목록이 아직 없다(설계 질의 `omf-mes#195`) */
  equipmentTypeCode: string;
  /** 검교정이 밀린 것만 본다 — 「아직 안 함」과 「만료」를 함께 잡는 조건은 계약에 없어 화면이 거른다 */
  overdueOnly: boolean;
  includeInactive: boolean;
  includeDisposed: boolean;
}
