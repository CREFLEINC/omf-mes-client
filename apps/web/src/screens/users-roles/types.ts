import type { components } from '@omf-mes/api-client';

/**
 * W-CO-02 화면 슬라이스의 계약.
 *
 * `api-client`는 `import type`으로만 참조한다 — 런타임 코드를 끌어오지 않아야 화면의 순수성이 유지된다.
 *
 * 이 파일은 이 화면이 소유한다. **다른 화면 슬라이스의 같은 이름 파일을 참조하지 않는다** —
 * 형태가 같아도 리소스 이름이 박힌 타입을 공유하면 한 화면의 계약 변화가 다른 화면을 끌고 간다.
 */

export type AppUser = components['schemas']['AppUser'];
export type PageMeta = components['schemas']['PageMeta'];
export type Role = components['schemas']['Role'];
export type UserRole = components['schemas']['UserRole'];
export type UserDataScope = components['schemas']['UserDataScope'];

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
 * 좌 페인의 조회 조건. **주소가 소유하며 화면 상태로 복제하지 않는다.**
 *
 * **상태 코드가 여기 없다.** 계약에 `statusCode` 쿼리가 있으나 값 목록이 확정되지 않아
 * 고를 수 있는 값이 하나도 없다 — 자리표시 값을 쿼리로 보내면 언제나 0건이 온다.
 * 조건 타입에 자리를 두지 않는 것이 「실리지 않는다」의 가장 단단한 보장이다(계획 결정 16).
 *
 * `departmentId`가 문자열인 이유는 디자인 시스템 선택칸이 문자열을 다루기 때문이다.
 * 계약 표현(숫자)으로의 변환은 `filters.ts`가 맡는다.
 *
 * `includeInactive`는 **켜졌을 때만** 서버로 보낸다. 계약의 기본값이 false라
 * 끈 상태를 값으로 실어 보내면 「보내지 않음」과 「false를 보냄」 두 상태가 생겨 캐시 키가 갈린다.
 */
export interface UserFilters {
  q: string;
  /** 비면 「전체 부서」다 */
  departmentId: string;
  includeInactive: boolean;
}

/**
 * 사용자 폼 값. 전부 문자열인 이유는 디자인 시스템 입력·선택이 문자열을 다루기 때문이다.
 * 계약 표현(숫자·널)으로의 변환은 `user-mappers.ts`가 맡는다.
 *
 * **`loginId`는 등록에서만 쓰인다.** 계약의 수정 요청 본문에 그 키가 아예 없다 —
 * 수정 화면에서는 값 표기로만 보이고 요청 본문에도 실리지 않는다(계획 결정 10).
 *
 * **`statusCode`는 화면이 고르는 값이 아니다.** 값 목록이 미정이라 서버가 준 값을
 * 그대로 들고 있다가 수정 저장 때 되돌려 싣는다 — 계약이 수정 본문에서 이 키를 필수로 두었다.
 */
export interface UserFormValues {
  loginId: string;
  userName: string;
  /** 비우면 「지정하지 않음」 — 계약이 널을 허용한다 */
  departmentId: string;
  /** 계약이 널을 허용한다 */
  email: string;
  statusCode: string;
}
