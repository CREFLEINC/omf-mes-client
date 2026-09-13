import { messages } from '@omf-mes/i18n';

import { validateInitialPassword } from './initial-password';
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
 * `statusCode`도 공통코드 선택칸이 있으므로 서버의 해당 필드 오류를 인라인으로 낸다.
 */
export const USER_FORM_FIELDS: readonly string[] = [
  'loginId',
  'userName',
  'departmentId',
  'email',
  'statusCode',
];

/**
 * 등록 쓰기(`POST`)만 쓰는 목록 — 위 목록에 `password` 를 더한 것.
 *
 * ⭐ **왜 위 상수를 넓히지 않고 갈랐는가.** `screen.tsx` 가 수정 쓰기(`PUT`)와 등록 쓰기(`POST`)에
 * **같은 `knownFields` 를 넘긴다.** 위 상수에 `password` 를 넣으면 수정 저장에서 서버가
 * `field: "password"` 오류를 내려보낼 때 `splitError`(`patterns/master/use-master-write.ts`)가
 * 그것을 **인라인으로 분류하는데 수정 폼에는 그 칸이 없어 어디에도 그려지지 않는다** —
 * 배너로 올라가야 할 실패가 조용히 삼켜지고, 사용자는 저장이 왜 안 됐는지 알 수 없다.
 * 그 함수가 「목록에 없는 필드명은 삼키지 않고 배너로 간다」를 보장하는 근거가 바로 목록을
 * **그 폼에 실제로 있는 칸으로만** 유지하는 것이다.
 *
 * ⭐ **등록 쪽에는 반드시 이 목록을 쓴다.** 넣지 않으면 서버가 `password` 에 낸 400(8자 미만 →
 * `RANGE`, 문자열 아님 → `INVALID`)이 **인라인 대신 배너로 샌다** — 고칠 칸을 짚어 주지 못한다.
 * 화면 검증이 이미 같은 하한을 보지만, 화면이 재지 않는 규칙(예: 확인되지 않은 상한)을 서버가
 * 가진다면 그 오류가 제자리에 서는 길은 이 목록뿐이다.
 */
export const USER_CREATE_FORM_FIELDS: readonly string[] = [...USER_FORM_FIELDS, 'password'];

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
 *
 * **초기 비밀번호도 등록에서만 본다** — 같은 근거다. 수정에는 그 칸이 없고 보낼 자리도 없어,
 * 수정 폼에서 검사하면 **그릴 자리가 없는 오류로 저장이 잠긴다.**
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

    /*
     * 규칙 전부를 `initial-password.ts` 가 소유한다 — 이 파일은 판정을 옮기지 않고 **부른다.**
     * 문구도 그쪽이 고르므로 여기서 갈래를 다시 세면 두 곳이 어긋난다.
     *
     * 통과했을 때 **키를 만들지 않는다.** 반환형이 `Record<string, string>` 이라 `undefined` 를
     * 담을 수 없고, 담기면 「오류가 있다」를 키 수로 세는 자리에서 통과한 칸이 오류로 세어진다.
     */
    const passwordError = validateInitialPassword(values.password);
    if (passwordError !== undefined) {
      errors.password = passwordError;
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
