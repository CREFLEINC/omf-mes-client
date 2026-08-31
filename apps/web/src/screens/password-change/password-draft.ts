import { messages } from '@omf-mes/i18n';

import type { PasswordChangeRequestBody } from './types';

const t = messages.passwordChange;

/**
 * 계약이 정한 새 비밀번호의 최소 길이 — **`PasswordChangeRequest.newPassword.minLength`의
 * 실측값이다.** 화면이 지어낸 자리표시 값이 아니다.
 *
 * ⚠ **생성 타입(`api.d.ts`)에서 이 값을 찾지 마라.** `openapi-typescript`는 `minLength`를
 * TypeScript 타입으로 내보내지 않는다 — 그 파일에 없는 것은 계약에 하한이 없다는 뜻이 아니라
 * **그 도구로는 잴 수 없다**는 뜻이다(전례 `login/login-draft.ts`의 상한과 같은 사정).
 *
 * 고객사 보안 요구로 하한이 바뀌면 **계약과 함께 이 상수를 교체한다.** 문구는 이 값을 주입받아
 * 만들어지므로(`t.notice`·`t.validation.tooShort`) 여기만 고치면 화면이 따라온다.
 */
export const MIN_NEW_PASSWORD_LENGTH = 8;

/**
 * 화면이 들고 있는 세 칸. **친 글자 그대로 담는다 — 다듬지 않는다.**
 *
 * 앞뒤 공백은 비밀번호에서 값의 일부다. 화면이 걷어내면 사용자가 친 것과 다른 값이 서버로 가고,
 * 그 값으로 바뀐 비밀번호는 다음 로그인에서 맞지 않는다.
 *
 * 두 칸의 이름을 계약 본문에서 가져오는 이유는 **옮길 자리가 없기 때문**이다 — 계약이 칸 이름을
 * 바꾸면 여기서 곧바로 깨진다.
 */
export interface PasswordDraft {
  currentPassword: PasswordChangeRequestBody['currentPassword'];
  newPassword: PasswordChangeRequestBody['newPassword'];
  /** 확인 재입력. 계약 본문에 없는 화면만의 칸이라 별칭을 매지 않는다 */
  confirmPassword: string;
}

export const emptyPasswordDraft: PasswordDraft = {
  currentPassword: '',
  newPassword: '',
  confirmPassword: '',
};

/** 인라인 오류가 설 수 있는 칸 이름. */
export type PasswordFieldName = 'currentPassword' | 'newPassword' | 'confirmPassword';

/** 칸 이름 → 그 칸에 설 한 문장. **한 칸에 한 문장**이다. */
export type PasswordFieldErrors = Partial<Record<PasswordFieldName, string>>;

/**
 * 칸이 비었는가. **다듬지 않고 본다.**
 *
 * ⚠ **전례(`login/login-draft.ts`의 `isFilled`)와 반대로 판단하는 자리다.** 그쪽 아이디 칸은
 * 공백만 친 칸을 빈 칸으로 센다(`value.trim() !== ''`) — 가려지지 않은 칸이라 맞는 판단이다.
 * (전례의 비밀번호 칸도 같은 잣대를 쓰던 결함이 있었으나 client#197로 이미 고쳐졌다 — 그쪽도
 * 지금은 이 파일의 `isEmpty`와 같은 근거로 다듬지 않고 본다.)
 *
 * 여기서 반대로 가는 근거는 둘이다 — 계약이 길이만 재므로 **공백도 값의 일부**이고, 가려진
 * 칸에서 공백은 점으로 **보인다.** 무언가 친 칸을 화면이 「비었다」고 말하면 사용자는 자기가
 * 친 것을 보면서 왜 잠겼는지 알 수 없다.
 */
const isEmpty = (value: string): boolean => value === '';

/**
 * 보내기 전에 **화면이 잡을 수 있는 것만** 잡는다.
 *
 * **빈 칸에는 오류를 만들지 않는다**(결정 ④). 아직 치는 중인 칸에 붉은 글씨를 세우면 첫 글자를
 * 넣는 순간 오류가 뜬다 — 빈 칸의 사정은 버튼 비활성 사유가 말한다.
 *
 * ⭐ **짝 제약은 두 칸 모두에 세운다**(공유계약 A-2). 한쪽만 붉히면 새 값을 고쳐야 하는지 확인
 * 값을 고쳐야 하는지 알 수 없다. 형제 사본(`approval-route/route-validation.ts`)은 같은 형태의
 * 제약을 **상한 칸 하나에만** 세우는데, 그 자리는 두 칸이 서로 다른 뜻을 갖는 구간 입력이라
 * 판단이 갈린다 — 여기서 그 형태를 그대로 옮기면 스펙과 공유계약을 함께 어긴다.
 *
 * **한 칸에는 한 문장이고, 자기 규칙이 짝 오류를 이긴다.** 길이가 모자란 값은 확인 칸을 맞춰도
 * 보낼 수 없으니 먼저 할 일을 먼저 말한다. 그때도 확인 칸에는 짝 오류가 서므로 **두 칸이 함께
 * 표시되는 사실은 유지된다.**
 */
export const validatePasswordDraft = (draft: PasswordDraft): PasswordFieldErrors => {
  const errors: PasswordFieldErrors = {};

  if (!isEmpty(draft.newPassword)) {
    if (draft.newPassword.length < MIN_NEW_PASSWORD_LENGTH) {
      errors.newPassword = t.validation.tooShort(MIN_NEW_PASSWORD_LENGTH);
    } else if (draft.newPassword === draft.currentPassword) {
      /*
       * ⭐ **원문 그대로 비교한다.** 다듬고 비교하면 서버에는 서로 **다른 값**인 둘을 화면이
       * 「같다」고 막아, 사용자가 그 값을 영영 쓸 수 없다. 이력이 필요한 「직전 비밀번호 재사용
       * 금지」와 다른 규칙이다 — 여기서 견주는 것은 지금 이 화면에 있는 두 값뿐이다.
       *
       * **현재 비밀번호 칸이 비었는지 따로 보지 않는다.** 바깥 가드가 새 비밀번호를 이미
       * 「비어 있지 않다」로 좁혔으므로, 두 값이 같다면 현재 비밀번호도 빈 값일 수 없다 —
       * 그 검사를 두면 **일어날 수 없는 경우가 있는 것처럼** 읽히고, 어떤 뮤테이션도 잴 수
       * 없는 자리가 된다.
       */
      errors.newPassword = t.validation.sameAsCurrent;
    }
  }

  /* **두 값이 다 있을 때만** 견준다 — 한쪽이 비면 비교할 것이 없고, 빈 칸에는 그리지 않는다. */
  if (
    !isEmpty(draft.newPassword) &&
    !isEmpty(draft.confirmPassword) &&
    draft.newPassword !== draft.confirmPassword
  ) {
    errors.confirmPassword = t.validation.confirmMismatch;
    /* 새 칸에 이미 자기 규칙의 문장이 서 있으면 그것이 이긴다 — 한 칸에 한 문장이다. */
    errors.newPassword ??= t.validation.confirmMismatch;
  }

  return errors;
};

/** 세 칸이 다 채워졌는가. 「보낼 수 있는가」와 「왜 잠겼는가」가 이 판정을 함께 쓴다. */
const isComplete = (draft: PasswordDraft): boolean =>
  !isEmpty(draft.currentPassword) && !isEmpty(draft.newPassword) && !isEmpty(draft.confirmPassword);

/** 세 칸이 채워지고 검증 오류가 없으면 참. */
export const canSubmit = (draft: PasswordDraft): boolean =>
  isComplete(draft) && Object.keys(validatePasswordDraft(draft)).length === 0;

/**
 * 「변경」이 잠긴 사유. 열려 있으면 `undefined`.
 *
 * **`canSubmit`을 그대로 지난다**(전례 `login-draft.ts`의 규율). 잠금과 사유가 각자 판정하면
 * 「사유 없이 잠긴 버튼」이나 「열려 있는데 사유가 붙은 버튼」이 생긴다.
 *
 * **채우는 일이 고치는 일보다 앞선다** — 아직 비어 있는 칸이 있으면 규칙 위반이 함께 있어도
 * 채우라고 말한다. 값이 다 서기 전의 규칙 판정은 사용자가 아직 손대는 중인 자리다.
 */
export const submitDisabledReason = (draft: PasswordDraft): string | undefined => {
  if (canSubmit(draft)) return undefined;

  return isComplete(draft) ? t.actionReasons.invalid : t.actionReasons.incomplete;
};
