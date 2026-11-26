import type { components } from '@omf-mes/api-client';

/**
 * W-06-06 화면 슬라이스의 계약.
 *
 * `api-client`는 `import type`으로만 참조한다 — 런타임 코드를 끌어오지 않아야 화면의 순수성이 유지된다.
 *
 * 이 파일은 이 화면이 소유한다. 다른 화면 슬라이스의 같은 이름 파일을 참조하지 않는다 —
 * 리소스 이름이 박힌 타입을 공유하면 한 화면의 계약 변화가 다른 화면을 끌고 간다.
 *
 * **코드값 편집 한 벌은 이 파일을 쓰지 않는다.** 그쪽은 `code-value-types.ts`에 자기 타입을 갖는다 —
 * 그래야 여덟 파일을 통째로 옮길 수 있다(omf-mes#13 §5).
 */

export type CodeGroup = components['schemas']['CodeGroup'];
export type Department = components['schemas']['Department'];
export type Worker = components['schemas']['Worker'];
export type Partner = components['schemas']['Partner'];
/**
 * 거래처가 가진 역할 하나. `roleTypeName`은 **서버가 주는 표시명**이며
 * 어휘 밖 코드를 풀 때만 쓴다 — 어휘 안의 다섯은 `ko.ts`의 표시명이 이긴다
 * (그래야 다섯 항목의 이름이 서버 상태에 따라 흔들리지 않는다).
 */
export type PartnerRole = components['schemas']['PartnerRole'];
export type PageMeta = components['schemas']['PageMeta'];

/**
 * 계층 판정에 쓰는 부서 한 행. **자기참조가 이미 접힌 값이다** —
 * 접기는 `department-mappers.ts` 한 곳에서만 하고, 이 타입을 받는 쪽은 접힌 뒤의 값만 다룬다.
 * 규칙이 두 곳에 생기면 반드시 한쪽이 어긋난다.
 */
export interface DepartmentRow {
  departmentId: number;
  departmentCode: string;
  departmentName: string;
  /** 뿌리 부서면 null. 자기참조는 여기 오지 않는다 */
  parentDepartmentId: number | null;
  businessUnitId: number | null;
  isActive: boolean;
}

/**
 * 선택 목록의 원본 항목. 사용 여부를 함께 들고 있어야
 * 「사용 중인 것 + 지금 고른 값」만 선택지로 낼 수 있다.
 */
export interface LookupEntry {
  value: string;
  label: string;
  isActive: boolean;
}

export interface SelectOption {
  value: string;
  label: string;
}

/**
 * 좌 페인의 조회 조건. URL이 소유하며 화면 상태로 복제하지 않는다.
 *
 * `includeInactive`는 **켜졌을 때만** 서버로 보낸다. 계약의 기본값이 false라
 * 끈 상태를 값으로 실어 보내면 「보내지 않음」과 「false를 보냄」 두 상태가 생겨 캐시 키가 갈린다.
 */
export interface CodeGroupFilters {
  q: string;
  includeInactive: boolean;
}

/**
 * 거래처 탭의 조회 조건. 모양은 `CodeGroupFilters`와 같지만 **타입을 갈라 둔다** —
 * 한 타입을 두 탭이 나눠 쓰면 한쪽 탭의 조건이 늘 때 다른 탭이 끌려간다.
 *
 * **역할 축이 없다.** 이 탭은 역할을 붙이는 곳이라 역할이 아직 없는 거래처가 보여야 한다.
 */
export interface PartnerFilters {
  q: string;
  includeInactive: boolean;
}

/**
 * 코드그룹 폼 값. 전부 문자열인 이유는 DS 입력이 문자열을 다루기 때문이다.
 * 계약 표현(널)으로의 변환은 `code-group-mappers.ts`가 맡는다.
 */
export interface CodeGroupFormValues {
  groupCode: string;
  groupName: string;
  /** 계약이 널을 허용한다 — 비우는 것이 정상 값이다. */
  description: string;
}

/**
 * 좌 목록 조건 — **검색어 + 선택 축 하나 + 미사용 포함**.
 * 조직 탭(사업부)과 작업자 탭(부서)이 같은 모양이라 한 타입으로 둔다.
 *
 * 선택 축이 문자열인 이유는 디자인 시스템 선택칸이 문자열을 다루기 때문이다.
 * 계약 표현(숫자)으로의 변환은 `filters.ts`가 맡는다.
 */
export interface ScopedFilters {
  q: string;
  /** 조직 탭은 사업부, 작업자 탭은 부서. 비면 「전체」다 */
  scopeId: string;
  includeInactive: boolean;
}

/**
 * 부서 폼 값. 전부 문자열인 이유는 디자인 시스템 입력·선택이 문자열을 다루기 때문이다.
 * 계약 표현(숫자·널)으로의 변환은 `department-mappers.ts`가 맡는다.
 */
export interface DepartmentFormValues {
  departmentCode: string;
  departmentName: string;
  /** 비우면 뿌리 부서다 — 계약이 널을 허용한다. */
  parentDepartmentId: string;
  /** 계약이 널을 허용한다. */
  businessUnitId: string;
}
