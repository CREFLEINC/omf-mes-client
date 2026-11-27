import type { LoginRequestBody } from './types';

/**
 * 계약이 정한 아이디 상한.
 *
 * ⚠ **생성 타입(`api.d.ts`)에서 이 값을 찾지 마라.** `openapi-typescript`는 `maxLength`를
 * TypeScript 타입으로 내보내지 않는다 — 그 파일에 없는 것은 계약에 상한이 없다는 뜻이 아니라
 * **그 도구로는 잴 수 없다**는 뜻이다. 상한은 계약 정본에서 확인한다.
 */
export const LOGIN_ID_MAX_LENGTH = 100;

/**
 * 친 글자 그대로. **다듬지 않는다** — 앞뒤 공백은 비밀번호에서 값의 일부일 수 있어,
 * 화면이 걷어내면 사용자가 친 것과 다른 값이 서버로 간다.
 *
 * 칸 이름을 계약 본문에서 가져오는 이유는 **옮길 자리가 없기 때문**이다. 초안과 요청 본문이
 * 1:1이라 이름이 갈릴 이유가 없고, 계약이 칸 이름을 바꾸면 여기서 곧바로 깨진다.
 */
export interface LoginDraft {
  loginId: LoginRequestBody['loginId'];
  password: LoginRequestBody['password'];
}

export const emptyLoginDraft: LoginDraft = { loginId: '', password: '' };

/**
 * 아이디가 실제로 채워졌는가. **판정할 때만 공백을 걷어내고 본다** — 값 자체는 건드리지 않는다.
 * 공백만 친 칸은 사용자에게도 빈 칸으로 보이므로 채운 것으로 세지 않는다.
 */
const isFilled = (value: string): boolean => value.trim() !== '';

/**
 * 비밀번호가 실제로 채워졌는가. **다듬지 않고 그대로 본다**(client#197).
 *
 * `isFilled`와 반대로 판단하는 자리다 — 아이디 칸은 공백만 쳐도 사용자 눈에 빈 칸으로 «보이지만»,
 * 가려진 칸(`type="password"`)에서 공백은 점으로 **보인다.** `trim()`을 걸면 값을 바르게 친
 * 사용자가 자기 눈에 채워진 칸을 두고 로그인을 눌러도 커서만 그 칸으로 되돌아온다. 계약이
 * 이 칸에 형식을 두지 않고 길이만 재므로 공백도 값의 일부다(형제 구현
 * `password-change/password-draft.ts`의 `isEmpty`와 같은 근거).
 */
const isPasswordFilled = (value: string): boolean => value !== '';

/**
 * 로그인을 보낼 수 있는가.
 *
 * **길이를 재지 않는다.** 계약이 `LoginRequest.password`에 최소 길이를 두지 않았고, 여기서
 * 하한을 만들면 그보다 짧게 발급된 기존 계정이 **로그인 자체를 못 한다**(최소 8자는 비밀번호를
 * 바꾸는 화면의 규칙이다). 아이디 상한도 칸의 `maxLength`가 막고 넘긴 값의 판정은 서버 몫이다.
 */
export const canSubmit = (draft: LoginDraft): boolean =>
  isFilled(draft.loginId) && isPasswordFilled(draft.password);

/** 로그인 폼의 두 칸 */
export type LoginField = keyof LoginDraft;

/**
 * 보내려 할 때 **커서를 옮길 빈 칸**. 둘 다 채워졌으면 `undefined`.
 *
 * 빈 칸이어도 로그인 버튼을 잠그지 않는다 — 누르면 요청 없이 이 칸으로 커서만 옮긴다.
 * 아이디가 먼저다(위에서 아래로 채우는 차례).
 *
 * **`canSubmit`을 그대로 지난다.** 둘이 각자 판정하면 「보낼 수 없는데 옮길 칸이 없는」 갈래가 생긴다.
 *
 * ⚠ **문구로 칸을 지목하지 않는다.** 커서만 옮기고 「아이디를 입력하세요」류의 말은 내지 않는다 —
 * 실패 문구(어느 칸이 틀렸는지 말하지 않는다)로 그 형태가 옮아가지 않게 한다. 빈 칸은 사용자 눈에
 * 이미 보이는 사실이라 커서를 옮겨도 계정에 대해 새로 흘리는 것이 없다.
 */
export const firstEmptyField = (draft: LoginDraft): LoginField | undefined => {
  if (canSubmit(draft)) return undefined;

  return isFilled(draft.loginId) ? 'password' : 'loginId';
};
