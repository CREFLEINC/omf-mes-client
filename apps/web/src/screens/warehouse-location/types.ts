import type { components } from '@omf-mes/api-client';

import type { LookupSource } from '../../patterns/lookup-display';

/**
 * W-06-07 화면 슬라이스의 계약. Phase 2(데이터 연동)가 이 이름을 그대로 소비한다.
 * api-client는 `import type`으로만 참조한다 — 런타임 코드를 끌어오지 않아야 화면의 순수성이 유지된다.
 */

export type Warehouse = components['schemas']['Warehouse'];
export type Location = components['schemas']['Location'];

export interface WarehouseFilters {
  q: string;
  warehouseTypeCode: string;
  includeInactive: boolean;
}

/** 폼 값이 전부 문자열인 이유: DS Select·TextField가 문자열 값을 다룬다. 숫자 변환은 Phase 2의 저장 경로가 맡는다. */
export interface WarehouseFormValues {
  plantId: string;
  businessUnitId: string;
  warehouseCode: string;
  warehouseName: string;
  warehouseTypeCode: string;
  managementLevelCode: string;
  isExternal: boolean;
  /**
   * ⚠ **컨트롤이 없는 값이다 — 받은 것을 그대로 되돌려 보내려고 들고 있다.**
   *
   * 계약이 저장 본문에 이 칸을 필수로 요구하는데 이 화면에는 그것을 고칠 자리가 없다. 폼에
   * 들고 있지 않으면 저장할 때마다 값을 **지어내야 하고**, 그러면 서버가 갖고 있던 값이
   * 조용히 덮인다. 화면에 칸을 둘지는 설계에 물어 두었다.
   */
  isDefect: boolean;
  partnerId: string;
}

export interface LocationFormValues {
  locationCode: string;
  locationName: string;
  locationTypeCode: string;
  qualityZoneCode: string;
  storageConditionCode: string;
  allowMixedItem: boolean;
  allowMixedLot: boolean;
  capacityQty: string;
  capacityUomId: string;
}

export interface LookupOptions {
  plants: { value: string; label: string }[];
  businessUnits: { value: string; label: string }[];
  partners: { value: string; label: string }[];
  uoms: { value: string; label: string }[];
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

export interface LookupSources {
  plants: LookupSource<LookupEntry>;
  businessUnits: LookupSource<LookupEntry>;
  partners: LookupSource<LookupEntry>;
  uoms: LookupSource<LookupEntry>;
}
