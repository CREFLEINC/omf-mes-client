import type { components } from '@omf-mes/api-client';

import { defaultInitialPassword } from './initial-password';
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
 * 로그인 ID는 등록에만 있고, 상태는 두 요청 모두 선택적으로 실린다.
 */

export const appUserToFormValues = (appUser: AppUser): UserFormValues => ({
  loginId: appUser.loginId,
  /*
   * **비운다.** 수정 폼에는 이 칸이 없고, 상세 응답에도 비밀번호는 없다(있어서도 안 된다).
   * 등록 기본값(`defaultInitialPassword()`)을 여기 넣으면 수정 저장이 남의 비밀번호를
   * 기본값으로 되돌리는 통로가 될 수 있다 — 지금은 수정 본문에 자리가 없어 실리지 않지만,
   * 계약이 자리를 열면 조용히 나가게 된다.
   */
  password: '',
  userName: appUser.userName,
  // 널·없음을 빈 문자열로 모은다 — 입력칸의 「지정하지 않음」이 하나의 값이어야 한다.
  departmentId:
    appUser.departmentId === null || appUser.departmentId === undefined
      ? ''
      : String(appUser.departmentId),
  email: appUser.email ?? '',
  /* 공통코드 선택값. 목록에 없는 기존 값도 초안에서 지우지 않는다. */
  statusCode: appUser.statusCode,
});

/**
 * 등록 폼의 첫 값.
 *
 * **함수인 것이 여기서 뜻을 갖는다** — 초기 비밀번호 기본값이 환경변수를 부를 때마다 읽으므로
 * 모듈 상수로 굳히면 그 갈림이 모듈 실린 시점에 박힌다(`initial-password.ts` 참고).
 */
export const emptyUserFormValues = (): UserFormValues => ({
  loginId: '',
  /* 관리자가 그대로 두고 등록해도 되도록 **미리 채운다** — 빈 칸이면 값을 지어내야 한다. */
  password: defaultInitialPassword(),
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
 * **부서·전자우편은 비어도 키를 빼지 않고 널을 명시한다.** 키를 빼면 서버가 이전 값을
 * 남길 수 있어 한 번 넣은 값을 지울 방법이 사라진다.
 *
 * ⛔⛔ **`statusCode` 가 2026-09-11 전달본에서 선택 → 필수로 바뀌었다** — 예전엔 비우면 키를
 * 빼 기존 상태를 보존했는데, 지금 생성 타입은 이 칸을 required 로 요구해 키를 뺄 수 없다.
 * 지어낸 값을 채우지 않는다 — 수정 폼은 상세 조회(`appUserToFormValues`)가 채운 뒤에만 열려
 * `values.statusCode` 가 항상 그 사용자의 현재 상태다(빈 값이 나올 선택지 자체가 없다 —
 * `screen.tsx` 의 폼 시딩·`select-field.tsx` 참고). 그래서 항상 그 값을 그대로 싣는다.
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
 * 상태를 비우면 계약 기본값 `EMPLOYED`를 쓰도록 키를 빼고, 사용자가 골랐으면 그 값을 싣는다.
 *
 * 로그인 ID는 **등록에서만** 정할 수 있다.
 *
 * ## ⛔ `password` 는 고정한 계약에 없는 키다 — 이 함수가 이 슬라이스의 유일한 우회 자리다
 *
 * **왜 넘어서는가.** 서버는 2026-09-12부터 이 요청의 선택 파라미터 `password` 를 받는다 —
 * 보내면 그 값이 계정 비밀번호가 되고 강제 변경이 걸리지 않는다. **보내지 않으면 서버가 만드는데,
 * 관리웹에는 그 임시 비밀번호를 볼 경로가 없다** — 즉 보내지 않고 만든 계정은 **아무도 비밀번호를
 * 알 수 없고** 그 사람은 처음부터 로그인할 수 없다. 계약에 맞춰 키를 빼는 선택은 「계약을
 * 지켰다」가 아니라 「쓸 수 없는 계정을 만들었다」가 된다.
 *
 * **왜 계약에 없는가.** 고정한 전달본의 `components['schemas']['AppUserCreate']` 에 그 키가 없다
 * (직접 확인했다 — `packages/api-client/src/generated/api.d.ts` 의 `AppUserCreate:`). 그 파일은
 * `pnpm gen:api` 생성물이라 손으로 고칠 수 없고, 고쳐도 다음 생성에서 지워진다. 서버가 먼저
 * 갔고 전달본이 아직 따라오지 않은 상태다.
 *
 * **어디까지가 우회인가.** 반환형을 `AppUserCreate & { password: string }` 으로 **넓히는 이
 * 한 줄까지다.** 계약이 요구하는 키는 하나도 빼거나 바꾸지 않았고, 다른 함수
 * (`toAppUserUpdate`)는 손대지 않았다 — 수정 본문에는 자리가 없다.
 *
 * ⭐ **호출부에 캐스트를 덧붙이지 마라.** `screen.tsx` 의 `client.POST` 는 손대지 않아도 통과한다 —
 * 초과 속성 검사는 **신선한 객체 리터럴**에만 걸리고, 함수 반환값은 그 대상이 아니다. 「타입이
 * 안 맞을 것 같다」는 짐작으로 `as` 를 넣으면 계약이 따라온 뒤에도 그 캐스트가 남아, 정작 키
 * 이름이나 타입이 어긋날 때 아무도 알아채지 못한다.
 *
 * **언제 걷어내는가.** 전달본이 `password` 를 담아 오는 순간이다. 그때
 * `contract-password-gap.test.ts` 의 타입 감지기가 **스스로 빨개진다** — 그 신호를 보면 여기
 * 반환형의 `& { password: string }` 을 지우고 이 머리말을 함께 지운다.
 */
export const toAppUserCreate = (values: UserFormValues): AppUserCreate & { password: string } => ({
  loginId: values.loginId.trim(),
  /*
   * ⛔⛔ **여기만 `.trim()` 이 «없다» — 빠뜨린 것이 아니다.** 위아래 형제 필드
   * (`loginId`·`userName`·`email`)는 전부 다듬는다. 「일관성」을 이유로 이 줄에 `.trim()` 을
   * 붙이지 마라 — 붙이는 순간 결함이 된다.
   *
   * 갈리는 근거는 이 칸이 **가려진 칸**이라는 데 있다. 앞뒤 공백은 비밀번호에서 값의 일부이고,
   * 사용자는 화면이 무엇을 걷어냈는지 볼 수 없다 — 다듬은 값을 보내면 **사용자가 친 것과 다른
   * 비밀번호가 저장되고**, 그 사람은 자기가 친 값으로 로그인할 수 없다. 서버가 이 칸에 대해
   * 재는 것도 길이뿐이라 공백은 서버에게도 값이다(근거 전문은 `initial-password.ts`).
   *
   * **비어 있어도 키를 빼지 않는다.** 검증(`validateUserForm`)이 빈 값으로는 보내지 못하게
   * 막으므로 여기서 또 가르면 「일어날 수 없는 경우」에 분기가 생기고, 그 분기는 「비우면
   * 서버가 만들어 준다」는 — 아무도 비밀번호를 모르게 되는 — 옛 동작으로 조용히 되돌아간다.
   */
  password: values.password,
  userName: values.userName.trim(),
  departmentId: values.departmentId === '' ? null : Number(values.departmentId),
  email: values.email.trim() === '' ? null : values.email.trim(),
  ...(values.statusCode === '' ? {} : { statusCode: values.statusCode }),
});

/**
 * 기준값과 현재 값의 비교. 「고친 것이 있는가」의 판정 근거다.
 *
 * ⭐ **`password` 도 견준다.** 빼면 등록 폼에서 비밀번호만 고쳤을 때 이 함수가 「고친 것이 없다」로
 * 답해 **등록 단추가 잠긴다** — 사용자는 값을 바꿔 놓고도 누를 수 없는 단추를 보게 된다.
 * 등록에서는 기본값이 미리 채워져 있어 「비밀번호만 고친 초안」이 흔한 경우라 더 그렇다.
 */
export const isSameUserValues = (a: UserFormValues, b: UserFormValues): boolean =>
  a.loginId === b.loginId &&
  a.password === b.password &&
  a.userName === b.userName &&
  a.departmentId === b.departmentId &&
  a.email === b.email &&
  a.statusCode === b.statusCode;
