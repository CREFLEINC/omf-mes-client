import { messages } from '@omf-mes/i18n';

import type { LoginRequestBody } from './types';

const t = messages.login;

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
 * 값이 실제로 채워졌는가. **판정할 때만 공백을 걷어내고 본다** — 값 자체는 건드리지 않는다.
 * 공백만 친 칸은 사용자에게도 빈 칸으로 보이므로 채운 것으로 세지 않는다.
 */
const isFilled = (value: string): boolean => value.trim() !== '';

/**
 * 로그인을 보낼 수 있는가.
 *
 * **길이를 재지 않는다.** 계약이 `LoginRequest.password`에 최소 길이를 두지 않았고, 여기서
 * 하한을 만들면 그보다 짧게 발급된 기존 계정이 **로그인 자체를 못 한다**(최소 8자는 비밀번호를
 * 바꾸는 화면의 규칙이다). 아이디 상한도 칸의 `maxLength`가 막고 넘긴 값의 판정은 서버 몫이다.
 */
export const canSubmit = (draft: LoginDraft): boolean =>
  isFilled(draft.loginId) && isFilled(draft.password);

/**
 * 로그인 버튼이 잠긴 사유. 열려 있으면 `undefined`.
 *
 * **`canSubmit`을 그대로 지난다.** 잠금과 사유가 각자 판정하면 「사유 없이 잠긴 버튼」이나
 * 「열려 있는데 사유가 붙은 버튼」이 생긴다 — 한 판정에서 갈라 나온다.
 *
 * **어느 칸이 비었는지 가르지 않는다.** 지목하는 형태를 여기서 한 번 쓰면 그것이 그대로
 * 실패 문구(어느 칸이 틀렸는지 말하지 않는다)로 옮아간다.
 */
export const submitDisabledReason = (draft: LoginDraft): string | undefined =>
  canSubmit(draft) ? undefined : t.actionReasons.incomplete;
