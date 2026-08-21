import type { components } from '@omf-mes/api-client';

/**
 * W-05-12 화면 슬라이스의 계약.
 * api-client는 `import type`으로만 참조한다 — 런타임 코드를 끌어오지 않아야 화면의 순수성이 유지된다.
 */

export type EquipmentGroup = components['schemas']['EquipmentGroup'];
export type Equipment = components['schemas']['Equipment'];

/**
 * 설비 그룹 폼의 값.
 *
 * 전부 문자열인 이유는 디자인 시스템 입력·선택이 문자열을 다루기 때문이고, 계약은 id를 숫자로,
 * 선택 필드를 널로 표현한다. 그 경계를 `mappers.ts` 한 곳에서 넘는다.
 */
export interface GroupFormValues {
  plantId: string;
  groupCode: string;
  groupName: string;
  groupTypeCode: string;
  parentGroupId: string;
}

/**
 * 설비 목록의 조회 조건.
 *
 * ⛔ **운용 상태 조건을 두지 않는다.** 계약의 그 조건은 「현장 화면은 폐기된 설비를 목록에서
 * 뺀다」를 위한 것이고, 이 화면은 마스터라 폐기된 자산도 보여야 한다. 상태는 조건이 아니라
 * **열**로 보인다.
 */
export interface EquipmentFilters {
  q: string;
  equipmentTypeCode: string;
  calibrationRequired: boolean;
  includeInactive: boolean;
}

/**
 * 설비 폼의 값.
 *
 * ⛔ **검교정 주기·정밀도 두 쌍은 여기 없다.** 계약이 그것들의 근거를 계측기 마스터(W-05-11)로
 * 적었고 화면 상세 스펙 §4-B 의 필드 목록에도 없다 — 이 화면은 **보이지 않되 상세에서 받은
 * 값을 그대로 되돌려 보낸다**(PUT 이 전체 교체라 빼면 지워진다). 그 원본은 `carried` 가 든다.
 */
export interface EquipmentFormValues {
  equipmentCode: string;
  equipmentName: string;
  equipmentTypeCode: string;
  productionLineId: string;
  processId: string;
  calibrationRequired: boolean;
}

/**
 * 이 화면이 소유하지 않는 값. **보이지 않되 그대로 되돌려 보낸다** — 빼면 지워진다.
 * 정하는 쪽은 계측기 마스터이고 이 화면은 반영만 한다(공유계약 B-13).
 */
export interface CarriedEquipmentValues {
  calibrationCycleTypeCode: string | null;
  calibrationCycleInterval: number | null;
  precisionValue: number | null;
  precisionUomId: number | null;
}

export interface GroupFilters {
  q: string;
  plantId: string;
  includeInactive: boolean;
}

/**
 * 선택 목록의 원본 항목. 사용 여부를 함께 들고 있어야
 * 「사용 중인 것 + 지금 선택된 값」만 선택지로 낼 수 있다(미사용 항목은 라벨에 표식을 붙인다).
 */
export interface LookupEntry {
  value: string;
  label: string;
  isActive: boolean;
}

export interface LookupEntries {
  plants: LookupEntry[];
  processes: LookupEntry[];
}
