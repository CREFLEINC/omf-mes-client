import type { components } from '@omf-mes/api-client';

import type { Role, RoleFormValues } from './types';

type RoleCreate = components['schemas']['RoleCreate'];
type RoleUpdate = components['schemas']['RoleUpdate'];

/**
 * 계약 표현과 폼 표현 사이의 변환.
 *
 * 폼 값이 전부 문자열인 이유는 디자인 시스템 입력이 문자열을 다루기 때문이고,
 * 계약은 선택 필드를 널로 표현한다. 그 경계를 여기 한 곳에서 넘는다.
 *
 * **등록과 수정의 본문이 같다** — 계약의 `RoleCreate`와 `RoleUpdate`가 같은 세 필드를 갖는다.
 * 사용자 쪽과 갈리는 자리다(그쪽은 로그인 ID·상태 코드가 한쪽에만 있다).
 * 그래도 두 함수를 따로 둔다 — 계약이 두 스키마를 갈라 두었고, 한쪽이 바뀌면 다른 쪽과
 * 달라지는 것이 정상이다.
 */

/** 앞뒤 공백이 붙은 값은 눈으로 구분되지 않는 다른 값이 된다. */
const trimmed = (value: string): string => value.trim();

/** 비운 선택 필드는 널로 싣는다 — 키를 빼면 서버가 이전 값을 남길 수 있다. */
const orNull = (value: string): string | null => (trimmed(value) === '' ? null : trimmed(value));

export const roleToFormValues = (role: Role): RoleFormValues => ({
  roleCode: role.roleCode,
  roleName: role.roleName,
  // 널·없음을 빈 문자열로 모은다 — 입력칸의 「지정하지 않음」이 하나의 값이어야 한다.
  description: role.description ?? '',
});

export const emptyRoleFormValues = (): RoleFormValues => ({
  roleCode: '',
  roleName: '',
  description: '',
});

/**
 * 역할 수정 요청 본문.
 *
 * **`roleCode`를 싣는다** — 로그인 ID와 갈리는 자리다. 계약의 `RoleUpdate`에 그 키가 있고,
 * 고칠 수 있는지는 상세 응답의 `editability`가 정한다(계획 결정 10).
 *
 * **번호(`roleId`)와 사용 여부(`isActive`)는 싣지 않는다** —
 * 번호는 경로에 있고 사용 여부는 `:deactivate`로만 바뀐다.
 *
 * **설명은 비어도 키를 빼지 않고 널을 명시한다.** 키를 빼면 서버가 이전 값을 남길 수 있어
 * 한 번 넣은 설명을 지울 방법이 사라진다.
 */
export const toRoleUpdate = (values: RoleFormValues): RoleUpdate => ({
  roleCode: trimmed(values.roleCode),
  roleName: trimmed(values.roleName),
  description: orNull(values.description),
});

/**
 * 역할 등록 요청 본문.
 *
 * **사용 여부를 싣지 않는다** — 계약이 「신규는 항상 사용 중」이라 그 키를 받지 않는다.
 */
export const toRoleCreate = (values: RoleFormValues): RoleCreate => ({
  roleCode: trimmed(values.roleCode),
  roleName: trimmed(values.roleName),
  description: orNull(values.description),
});

/** 기준값과 현재 값의 비교. 「고친 것이 있는가」의 판정 근거다. */
export const isSameRoleValues = (a: RoleFormValues, b: RoleFormValues): boolean =>
  a.roleCode === b.roleCode && a.roleName === b.roleName && a.description === b.description;
