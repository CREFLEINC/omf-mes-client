import type { components } from '@omf-mes/api-client';

import type { LookupSource } from '../../patterns/lookup-display';

/**
 * W-06-07 화면 슬라이스의 계약. Phase 2(데이터 연동)가 이 이름을 그대로 소비한다.
 * api-client는 `import type`으로만 참조한다 — 런타임 코드를 끌어오지 않아야 화면의 순수성이 유지된다.
 */

export type Warehouse = components['schemas']['Warehouse'];
export type Location = components['schemas']['Location'];
/** 위치에 둘 수 있게 지정한 품목 한 줄(서버 위치 ⑤). 품목코드 순으로 온다. */
export type LocationItem = components['schemas']['LocationItem'];

/** 창고 조회 조건 — 창고 배치도와 함께 쓰는 조건 상자의 것(`patterns/warehouse-filter-bar`). */
export type { WarehouseFilters } from '../../patterns/warehouse-filter-bar';

/** 폼 값이 전부 문자열인 이유: DS Select·TextField가 문자열 값을 다룬다. 숫자 변환은 Phase 2의 저장 경로가 맡는다. */
export interface WarehouseFormValues {
  plantId: string;
  businessUnitId: string;
  warehouseCode: string;
  warehouseName: string;
  warehouseTypeCode: string;
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
}

export interface LookupOptions {
  plants: { value: string; label: string }[];
  businessUnits: { value: string; label: string }[];
  warehouseTypes: { value: string; label: string }[];
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
  reissueReasons: LookupSource<LookupEntry>;
}
