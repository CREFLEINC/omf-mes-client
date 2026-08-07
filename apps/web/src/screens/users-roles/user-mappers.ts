import type { components } from '@omf-mes/api-client';

import type { AppUser, UserFormValues } from './types';

type AppUserCreate = components['schemas']['AppUserCreate'];
type AppUserUpdate = components['schemas']['AppUserUpdate'];

/**
 * 계약 표현과 폼 표현 사이의 변환.
 *
 * 폼 값이 전부 문자열인 이유는 디자인 시스템 입력·선택이 문자열을 다루기 때문이고,
 * 계약은 선택 필드를 널로 표현한다. 그 경계를 여기 한 곳에서 넘는다.
 *
 * **등록과 수정의 본문이 서로 다르다** — 계약이 그렇게 갈라 두었다.
 * 로그인 ID는 등록에만 있고, 상태 코드는 수정에만 있다.
 */

export const appUserToFormValues = (appUser: AppUser): UserFormValues => ({
  loginId: appUser.loginId,
  userName: appUser.userName,
  // 널·없음을 빈 문자열로 모은다 — 입력칸의 「지정하지 않음」이 하나의 값이어야 한다.
  departmentId:
    appUser.departmentId === null || appUser.departmentId === undefined
      ? ''
      : String(appUser.departmentId),
  email: appUser.email ?? '',
  /*
   * 값 목록이 미정이라 **화면이 고른 적이 없는 값**이다. 서버가 준 그대로 들고 있어야
   * 수정 저장 때 되돌려 실을 수 있다(계획 결정 16).
   */
  statusCode: appUser.statusCode,
});

export const emptyUserFormValues = (): UserFormValues => ({
  loginId: '',
  userName: '',
  departmentId: '',
  email: '',
  statusCode: '',
});

/**
 * 사용자 수정 요청 본문.
 *
 * **`loginId`를 싣지 않는다** — 계약의 `AppUserUpdate`에 그 키가 **아예 없다.**
 * 폼 값을 통째로 보내면 계약에 없는 키가 나간다(계획 결정 10).
 *
 * **번호(`appUserId`)와 사용 여부(`isActive`)도 싣지 않는다** —
 * 번호는 경로에 있고 사용 여부는 `:deactivate`로만 바뀐다.
 *
 * **`statusCode`는 받은 값을 그대로 되돌려 싣는다.** 계약이 이 키를 필수로 두었는데
 * 화면이 고를 수 있는 값이 하나도 없다 — 지어내지도, 빼지도 않는다.
 *
 * **부서·전자우편은 비어도 키를 빼지 않고 널을 명시한다.** 키를 빼면 서버가 이전 값을
 * 남길 수 있어 한 번 넣은 값을 지울 방법이 사라진다.
 */
export const toAppUserUpdate = (values: UserFormValues): AppUserUpdate => ({
  // 앞뒤 공백이 붙은 이름은 눈으로 구분되지 않는 다른 값이 된다.
  userName: values.userName.trim(),
  departmentId: values.departmentId === '' ? null : Number(values.departmentId),
  email: values.email.trim() === '' ? null : values.email.trim(),
  statusCode: values.statusCode,
});

/**
 * 사용자 등록 요청 본문.
 *
 * **`statusCode`를 싣지 않는다** — 계약이 「미지정 시 서버가 기본값으로 채운다」고 명시했고,
 * 화면이 고를 수 있는 값이 하나도 없어 실을 값 자체가 없다.
 *
 * 로그인 ID는 **등록에서만** 정할 수 있다.
 */
export const toAppUserCreate = (values: UserFormValues): AppUserCreate => ({
  loginId: values.loginId.trim(),
  userName: values.userName.trim(),
  departmentId: values.departmentId === '' ? null : Number(values.departmentId),
  email: values.email.trim() === '' ? null : values.email.trim(),
});

/** 기준값과 현재 값의 비교. 「고친 것이 있는가」의 판정 근거다. */
export const isSameUserValues = (a: UserFormValues, b: UserFormValues): boolean =>
  a.loginId === b.loginId &&
  a.userName === b.userName &&
  a.departmentId === b.departmentId &&
  a.email === b.email &&
  a.statusCode === b.statusCode;
