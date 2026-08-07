import { messages } from '@omf-mes/i18n';

import type { UserFormValues } from './types';

const t = messages.usersRoles.user.validation;

/**
 * 계약이 정한 상한. 상한 자체는 허용값이며 그것을 **넘을 때만** 막는다.
 *
 * ⚠ **생성 타입(`api.d.ts`)에서 이 값을 찾지 마라.** `openapi-typescript`는 `maxLength`를
 * TypeScript 타입으로 내보내지 않는다 — 그 파일에 0건인 것은 계약에 상한이 없다는 뜻이 아니라
 * **그 도구로는 잴 수 없다**는 뜻이다. 상한은 계약 정본에서 확인한다.
 */
const LOGIN_ID_MAX = 100;
const USER_NAME_MAX = 200;
const EMAIL_MAX = 200;

/**
 * 사용자 폼이 소유한 입력칸 이름. 서버가 준 필드 오류를 인라인으로 낼지
 * 배너로 올릴지 가르는 기준이며, 목록에 없는 필드명은 삼키지 않고 배너로 간다.
 *
 * 계약이 쓰는 이름 그대로 둔다 — 폼 값과 계약 필드가 1:1이라 옮길 자리가 없다.
 *
 * **`statusCode`가 없다.** 화면에 그 값을 고치는 입력칸이 없어 인라인으로 낼 자리가 없다 —
 * 서버가 그 필드의 오류를 주면 배너로 올라가야 사용자에게 닿는다.
 */
export const USER_FORM_FIELDS: readonly string[] = [
  'loginId',
  'userName',
  'departmentId',
  'email',
];

/**
 * 전자우편의 최소 형태. **계약이 「형식 검증은 화면 책임 — DB 제약 없음」이라고 명시한 칸**이라
 * 화면이 규칙을 갖는다. 다만 규칙을 좁게 잡으면 실제로 쓰이는 주소를 막게 되므로
 * 「공백 없는 이름 @ 점이 있는 도메인」까지만 본다 — 나머지는 서버와 실제 발송이 가린다.
 */
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type UserFormMode = 'create' | 'edit';

/**
 * 보내기 전에 화면에서 잡을 수 있는 것만 잡는다.
 *
 * **로그인 ID 중복을 검사하지 않는다** — 계약이 그 판정을 서버 몫으로 두었고(전역 유일 제약),
 * 화면이 흉내 내면 서버와 다른 답을 낼 수 있다.
 *
 * 길이는 **앞뒤 공백을 턴 값**으로 센다. 저장되는 값이 그 값이기 때문이다.
 *
 * **수정에서는 로그인 ID를 보지 않는다** — 계약의 수정 본문에 그 키가 없어
 * 보낼 수 없는 값을 막을 이유가 없다(계획 결정 10).
 */
export const validateUserForm = (
  values: UserFormValues,
  mode: UserFormMode,
): Record<string, string> => {
  const errors: Record<string, string> = {};

  if (mode === 'create') {
    if (values.loginId === '') {
      errors.loginId = t.required;
    } else if (values.loginId.trim() === '') {
      errors.loginId = t.loginIdBlank;
    } else if (values.loginId.trim().length > LOGIN_ID_MAX) {
      errors.loginId = t.loginIdTooLong;
    }
  }

  if (values.userName === '') {
    errors.userName = t.required;
  } else if (values.userName.trim() === '') {
    errors.userName = t.userNameBlank;
  } else if (values.userName.trim().length > USER_NAME_MAX) {
    errors.userName = t.userNameTooLong;
  }

  // 계약이 널을 허용한다 — 비우는 것이 정상 값이라 형식·길이는 값이 있을 때만 본다.
  if (values.email.trim() !== '') {
    if (!EMAIL.test(values.email.trim())) {
      errors.email = t.emailFormat;
    } else if (values.email.trim().length > EMAIL_MAX) {
      errors.email = t.emailTooLong;
    }
  }

  return errors;
};
