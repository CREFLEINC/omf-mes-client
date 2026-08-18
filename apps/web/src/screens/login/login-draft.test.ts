import { messages } from '@omf-mes/i18n';
import { describe, expect, it } from 'vitest';

import {
  canSubmit,
  emptyLoginDraft,
  submitDisabledReason,
  LOGIN_ID_MAX_LENGTH,
  type LoginDraft,
} from './login-draft';

const t = messages.login;

/** 합성값이다. 그럴듯한 자격이 되지 않게 대역을 드러내는 글자만 쓴다(공개 저장소 경계). */
const SYNTHETIC_LOGIN_ID = 'SYN-LOGIN-01';
const SYNTHETIC_PASSWORD = 'SYN-PW-VALUE-01';

const draft = (overrides: Partial<LoginDraft> = {}): LoginDraft => ({
  ...emptyLoginDraft,
  ...overrides,
});

describe('emptyLoginDraft', () => {
  it('두 칸이 모두 빈 글자로 선다', () => {
    expect(emptyLoginDraft).toEqual({ loginId: '', password: '' });
  });
});

describe('LOGIN_ID_MAX_LENGTH', () => {
  /**
   * 계약이 정한 상한이며 **생성 타입에서는 잴 수 없다** — `openapi-typescript`가 `maxLength`를
   * 내보내지 않는다(전례 `users-roles/user-validation.ts`가 같은 자리에 같은 경고를 남겼다).
   * 그래서 값을 여기서 고정한다.
   */
  it('계약이 정한 아이디 상한 100을 그대로 든다', () => {
    expect(LOGIN_ID_MAX_LENGTH).toBe(100);
  });
});

describe('canSubmit', () => {
  it('두 칸을 다 채우면 보낼 수 있다', () => {
    expect(canSubmit(draft({ loginId: SYNTHETIC_LOGIN_ID, password: SYNTHETIC_PASSWORD }))).toBe(
      true,
    );
  });

  it('아이디만 채우면 보낼 수 없다', () => {
    expect(canSubmit(draft({ loginId: SYNTHETIC_LOGIN_ID }))).toBe(false);
  });

  it('비밀번호만 채우면 보낼 수 없다', () => {
    expect(canSubmit(draft({ password: SYNTHETIC_PASSWORD }))).toBe(false);
  });

  it('앞뒤 공백만 있는 값은 빈 값으로 본다', () => {
    expect(canSubmit(draft({ loginId: '   ', password: '   ' }))).toBe(false);
    expect(canSubmit(draft({ loginId: SYNTHETIC_LOGIN_ID, password: '   ' }))).toBe(false);
    expect(canSubmit(draft({ loginId: '   ', password: SYNTHETIC_PASSWORD }))).toBe(false);
  });

  it('앞뒤 공백을 걷어낸 값이 남으면 보낼 수 있다', () => {
    expect(
      canSubmit(
        draft({ loginId: `  ${SYNTHETIC_LOGIN_ID}  `, password: `  ${SYNTHETIC_PASSWORD}` }),
      ),
    ).toBe(true);
  });

  /**
   * **길이를 재지 않는다.** 계약이 `LoginRequest.password`에 최소 길이를 두지 않았다 —
   * 여기서 하한을 만들면 그보다 짧게 발급된 기존 계정이 **로그인 자체를 못 한다.**
   * 최소 8자는 비밀번호를 바꾸는 화면의 규칙이고 이 화면의 규칙이 아니다.
   */
  it('비밀번호 길이를 재지 않는다', () => {
    expect(canSubmit(draft({ loginId: SYNTHETIC_LOGIN_ID, password: 'a' }))).toBe(true);
  });

  /**
   * **아이디 길이도 재지 않는다.** 상한은 칸의 `maxLength`가 막고, 넘긴 값을 판정하는 것은
   * 서버 몫이다 — 화면이 여기서 또 재면 「칸에 들어가지도 않는 값」에 대한 죽은 갈래가 생긴다.
   */
  it('아이디 상한을 넘겨도 이 판정은 막지 않는다', () => {
    expect(
      canSubmit(
        draft({ loginId: 'A'.repeat(LOGIN_ID_MAX_LENGTH + 1), password: SYNTHETIC_PASSWORD }),
      ),
    ).toBe(true);
  });
});

describe('submitDisabledReason', () => {
  it('두 칸을 다 채우면 사유가 없다', () => {
    expect(
      submitDisabledReason(draft({ loginId: SYNTHETIC_LOGIN_ID, password: SYNTHETIC_PASSWORD })),
    ).toBeUndefined();
  });

  /**
   * **세 갈래가 같은 사유를 낸다.** 어느 칸이 비었는지 가르면 아직 아무것도 보내지 않은
   * 시점부터 화면이 칸을 지목하기 시작하고, 그 습관이 그대로 실패 문구(어느 칸이 틀렸는지
   * 말하지 않는다)로 새어 나간다.
   */
  it('아이디만·비밀번호만·둘 다 공백만 — 셋이 같은 사유를 낸다', () => {
    const reasons = [
      submitDisabledReason(draft({ loginId: SYNTHETIC_LOGIN_ID })),
      submitDisabledReason(draft({ password: SYNTHETIC_PASSWORD })),
      submitDisabledReason(draft({ loginId: '   ', password: '   ' })),
    ];

    expect(reasons).toEqual([
      t.actionReasons.incomplete,
      t.actionReasons.incomplete,
      t.actionReasons.incomplete,
    ]);
  });

  /**
   * 사유는 **어떻게 풀 것인가**를 담는다(배치 규범 4 · 공유계약 G-3).
   * 두 칸을 함께 말하는 것이 곧 「어느 칸이 비었는지 가르지 않는다」이기도 하다.
   */
  it('사유가 두 칸을 함께 말하고 풀리는 조건을 담는다', () => {
    const reason = t.actionReasons.incomplete;

    expect(reason).toContain('아이디');
    expect(reason).toContain('비밀번호');
    expect(reason).toContain('입력하면');
  });

  /**
   * **잠금과 사유가 갈리지 않는다.** 버튼은 사유의 유무로 잠기므로(화면), 이 둘이 어긋나면
   * 「사유 없이 잠긴 버튼」이나 「열려 있는데 사유가 붙은 버튼」이 생긴다.
   */
  it('사유가 없는 것과 보낼 수 있는 것이 언제나 같다', () => {
    const cases: LoginDraft[] = [
      emptyLoginDraft,
      draft({ loginId: SYNTHETIC_LOGIN_ID }),
      draft({ password: SYNTHETIC_PASSWORD }),
      draft({ loginId: '   ', password: '   ' }),
      draft({ loginId: SYNTHETIC_LOGIN_ID, password: SYNTHETIC_PASSWORD }),
      draft({ loginId: ` ${SYNTHETIC_LOGIN_ID} `, password: ` ${SYNTHETIC_PASSWORD} ` }),
    ];

    for (const candidate of cases) {
      expect(submitDisabledReason(candidate) === undefined).toBe(canSubmit(candidate));
    }
  });
});
