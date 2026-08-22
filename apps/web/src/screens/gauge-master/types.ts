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

/**
 * 폼이 들고 있는 값. **수는 문자열로 든다** — 빈 칸과 `0` 을 가르고, 지우는 도중의
 * 「`-`」·「`1.`」 같은 중간 상태를 숫자로 억지로 바꾸지 않기 위해서다.
 */
export interface GaugeFormValues {
  equipmentCode: string;
  equipmentName: string;
  equipmentTypeCode: string;
  /** 등록에서만 고른다. 수정에서는 옮길 수 없어 잠긴다(계약이 본문에 받지 않는다) */
  plantId: string;
  calibrationRequired: boolean;
  calibrationCycleTypeCode: string;
  calibrationCycleInterval: string;
  precisionValue: string;
  precisionUomId: string;
}

/**
 * 이 화면이 **보이지도 고치지도 않지만 지우지도 않는** 값.
 *
 * ⭐ 수정이 전체 교체(PUT)라 빼면 지워진다. 소속(생산라인·공정)은 설비 마스터(W-05-12)가
 * 정하고 이 화면은 되돌려 보내기만 한다(공유계약 B-13). **형제 화면이 주기·정밀도를 두고
 * 하는 일과 정확히 뒤집힌 모양이다.**
 */
export interface CarriedGaugeValues {
  productionLineId: number | null;
  processId: number | null;
}
