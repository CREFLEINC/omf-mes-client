import type { components } from '@omf-mes/api-client';

import type { LookupSource } from '../../patterns/lookup-display';
import type { LocationLevelFields } from '../../patterns/location-level';
import type { SystemLocationFields } from '../../patterns/system-location';

/**
 * W-06-07 화면 슬라이스의 계약. Phase 2(데이터 연동)가 이 이름을 그대로 소비한다.
 * api-client는 `import type`으로만 참조한다 — 런타임 코드를 끌어오지 않아야 화면의 순수성이 유지된다.
 */

export type Warehouse = components['schemas']['Warehouse'];
/** 서버가 만든 위치의 역할 · 별칭 · 단계(계약 밖, `patterns/system-location.ts` · `location-level.ts`)를 함께 읽는다. */
export type Location = components['schemas']['Location'] &
  SystemLocationFields &
  LocationLevelFields;

export interface WarehouseFilters {
  q: string;
  /** 공장 번호를 문자열로 — DS Select 값과 같은 모양이다. 빈 문자열이면 공장으로 거르지 않는다. */
  plantId: string;
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
  isDefect: boolean;
}

/**
 * 위치는 수용량 · 수용 단위 · 품질구역 · 보관조건을 다루지 않는다(사용자 지시 2026-10-29) — 칸도 값도 없다.
 * 위치명은 따로 받지 않고 별칭을 이름으로 쓴다. 코드는 MES 가 발행한다(`location-code.ts`).
 */
export interface LocationFormValues {
  parentLocationId: string;
  /** 발행한 코드 — 사람이 치지 않는다. */
  locationCode: string;
  /** MES 별칭 — 위치의 이름이다. 빈 글이면 별칭 없음. */
  aliasName: string;
  locationTypeCode: string;
  allowMixedItem: boolean;
  allowMixedLot: boolean;
}

export interface LookupOptions {
  plants: { value: string; label: string }[];
  businessUnits: { value: string; label: string }[];
  warehouseTypes: { value: string; label: string }[];
  locationTypes: { value: string; label: string }[];
  reissueReasons: { value: string; label: string }[];
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
  uoms: LookupSource<LookupEntry>;
  warehouseTypes: LookupSource<LookupEntry>;
  locationTypes: LookupSource<LookupEntry>;
  reissueReasons: LookupSource<LookupEntry>;
}
