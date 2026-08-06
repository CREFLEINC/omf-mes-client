import type { components } from '@omf-mes/api-client';

/**
 * W-06-03 화면 슬라이스의 계약.
 *
 * `api-client`는 `import type`으로만 참조한다 — 런타임 코드를 끌어오지 않아야 화면의 순수성이 유지된다.
 *
 * 불량 코드와 원인 코드는 계약 구조가 같고 필드 이름만 다르다. 화면 부품은 그 이름을 알지 않고
 * 아래 `HierarchyCode` 하나만 안다. 리소스 이름은 `adapters.ts` 밖으로 나가지 않는다.
 */

export type DefectCode = components['schemas']['DefectCode'];
export type CauseCode = components['schemas']['CauseCode'];
export type PageMeta = components['schemas']['PageMeta'];
export type Editability = components['schemas']['Editability'];

export type CodeKind = 'defect' | 'cause';

/** 두 탭이 공유하는 화면 표현. */
export interface HierarchyCode {
  id: number;
  code: string;
  name: string;
  /** 대분류이면 null. 자기참조도 화면에서는 null로 접는다(mappers.ts). */
  parentId: number | null;
  isActive: boolean;
}

export interface CodeFilters {
  q: string;
  includeInactive: boolean;
}

/**
 * 폼 값은 전부 문자열이다 — 입력 도중의 상태를 숫자로 강제하지 않는다.
 * `parentId === ''`이면 대분류다.
 */
export interface CodeFormValues {
  code: string;
  name: string;
  parentId: string;
}

/**
 * 서버가 쓰는 필드 이름. 400 응답의 `field`를 폼 입력칸에 잇는 기준이며,
 * 어댑터가 값을 채운다(불량은 `defectCode`…, 원인은 `causeCode`…).
 */
export interface ServerFieldNames {
  code: string;
  name: string;
  parentId: string;
}

/** 목록·상세 조회 결과의 화면 표현. 계약 감싸개(`{ defectCode, editability }`)는 어댑터가 벗긴다. */
export interface CodeListResult {
  items: HierarchyCode[];
  page: PageMeta;
}

export interface CodeDetailResult {
  code: HierarchyCode;
  editability: Editability;
  /** 화면에 입력칸이 없는 값. 수정 요청에 그대로 되돌려 실어 서버 값이 지워지지 않게 한다. */
  processId: number | null;
}

/** 선택칸에 그대로 넘길 수 있는 형태. */
export interface CodeOption {
  value: string;
  label: string;
}
