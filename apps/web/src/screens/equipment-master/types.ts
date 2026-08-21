import type { components } from '@omf-mes/api-client';

/**
 * W-05-12 화면 슬라이스의 계약.
 * api-client는 `import type`으로만 참조한다 — 런타임 코드를 끌어오지 않아야 화면의 순수성이 유지된다.
 */

export type EquipmentGroup = components['schemas']['EquipmentGroup'];

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
}
