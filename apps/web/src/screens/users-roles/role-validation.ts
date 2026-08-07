import { messages } from '@omf-mes/i18n';

import type { RoleFormValues } from './types';

const t = messages.usersRoles.role.validation;

/**
 * 계약이 정한 상한. 상한 자체는 허용값이며 그것을 **넘을 때만** 막는다.
 *
 * ⚠ **생성 타입(`api.d.ts`)에서 이 값을 찾지 마라.** `openapi-typescript`는 `maxLength`를
 * TypeScript 타입으로 내보내지 않는다 — 그 파일에 0건인 것은 계약에 상한이 없다는 뜻이 아니라
 * **그 도구로는 잴 수 없다**는 뜻이다. 상한은 계약 정본에서 확인한다.
 *
 * **설명에는 상한이 없다.** 계약이 그 칸에 길이 제약을 두지 않았으므로 화면도 두지 않는다 —
 * 없는 규칙을 지어내면 서버가 받는 값을 화면이 막는다.
 */
const ROLE_CODE_MAX = 50;
const ROLE_NAME_MAX = 200;

/**
 * 역할 폼이 소유한 입력칸 이름. 서버가 준 필드 오류를 인라인으로 낼지
 * 배너로 올릴지 가르는 기준이며, 목록에 없는 필드명은 삼키지 않고 배너로 간다.
 *
 * 계약이 쓰는 이름 그대로 둔다 — 폼 값과 계약 필드가 1:1이라 옮길 자리가 없다.
 *
 * **`isActive`가 없다.** 사용 여부를 고치는 입력칸이 화면에 없어 인라인으로 낼 자리가 없다.
 */
export const ROLE_FORM_FIELDS: readonly string[] = ['roleCode', 'roleName', 'description'];

/**
 * 보내기 전에 화면에서 잡을 수 있는 것만 잡는다.
 *
 * **등록과 수정을 가르지 않는다** — 계약의 `RoleCreate`와 `RoleUpdate`가 같은 필드를 같은
 * 필수 조건으로 요구한다. 사용자 폼과 갈리는 자리다(그쪽은 수정 본문에 로그인 ID가 아예 없어
 * 모드를 갈라야 했다). 모드 인자를 두면 「어느 쪽에서만 검사한다」가 언젠가 생긴다.
 *
 * **역할 코드 중복을 검사하지 않는다** — 계약이 그 판정을 서버 몫으로 두었고(전역 유일 제약),
 * 화면이 흉내 내면 서버와 다른 답을 낼 수 있다.
 *
 * 길이는 **앞뒤 공백을 턴 값**으로 센다. 저장되는 값이 그 값이기 때문이다.
 * 잠긴 코드 칸의 값은 서버가 준 값 그대로라 이 검사에 걸리지 않는다.
 */
export const validateRoleForm = (values: RoleFormValues): Record<string, string> => {
  const errors: Record<string, string> = {};

  if (values.roleCode === '') {
    errors.roleCode = t.required;
  } else if (values.roleCode.trim() === '') {
    errors.roleCode = t.roleCodeBlank;
  } else if (values.roleCode.trim().length > ROLE_CODE_MAX) {
    errors.roleCode = t.roleCodeTooLong;
  }

  if (values.roleName === '') {
    errors.roleName = t.required;
  } else if (values.roleName.trim() === '') {
    errors.roleName = t.roleNameBlank;
  } else if (values.roleName.trim().length > ROLE_NAME_MAX) {
    errors.roleName = t.roleNameTooLong;
  }

  return errors;
};
