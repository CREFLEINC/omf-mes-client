import { messages } from '@omf-mes/i18n';
import { describe, expect, it } from 'vitest';

import { passwordDraftFixture } from './fixtures';
import {
  MIN_NEW_PASSWORD_LENGTH,
  canSubmit,
  emptyPasswordDraft,
  submitDisabledReason,
  validatePasswordDraft,
} from './password-draft';

const t = messages.passwordChange;

/** 합성값이다. 그럴듯한 비밀번호가 되지 않게 대역을 드러내는 글자만 쓴다(공개 저장소 경계). */
const SYNTHETIC_CURRENT = 'SYN-CURRENT-01';
const SYNTHETIC_NEXT = 'SYN-NEXT-0001';

/** 최소 길이보다 한 글자 짧은 값. 상수를 바꿔도 「한 글자 모자란다」가 유지된다. */
const TOO_SHORT = 'S'.repeat(MIN_NEW_PASSWORD_LENGTH - 1);
/** 최소 길이를 딱 채운 값 — 경계가 「이상」임을 잰다. */
const EXACTLY_MIN = 'S'.repeat(MIN_NEW_PASSWORD_LENGTH);

describe('MIN_NEW_PASSWORD_LENGTH — 계약에서 옮겨 온 값', () => {
  /**
   * 계약 `PasswordChangeRequest.newPassword.minLength`의 실측값이다. 생성 타입에는 나타나지
   * 않으므로(`openapi-typescript`가 `minLength`를 타입으로 내보내지 않는다) 이 상수가 유일한
   * 자리이고, 그래서 값을 직접 잰다 — **눈대중으로 고치면 문구와 검증이 함께 어긋난다.**
   */
  it('계약이 정한 8이다', () => {
    expect(MIN_NEW_PASSWORD_LENGTH).toBe(8);
  });
});

describe('validatePasswordDraft — 화면이 보내기 전에 잡는 것', () => {
  it('새 비밀번호가 최소 길이보다 짧으면 그 칸에 길이 오류가 선다', () => {
    const errors = validatePasswordDraft(
      passwordDraftFixture({ newPassword: TOO_SHORT, confirmPassword: TOO_SHORT }),
    );

    expect(errors.newPassword).toBe(t.validation.tooShort(MIN_NEW_PASSWORD_LENGTH));
  });

  /** 경계값 — 「초과」가 아니라 「이상」이다. */
  it('최소 길이를 딱 채우면 길이 오류가 사라진다', () => {
    const short = validatePasswordDraft(
      passwordDraftFixture({ newPassword: TOO_SHORT, confirmPassword: TOO_SHORT }),
    );

    /* 양성 먼저 — 같은 규칙이 실제로 서는 것을 잡은 **뒤에** 사라짐을 잰다. */
    expect(short.newPassword).toBe(t.validation.tooShort(MIN_NEW_PASSWORD_LENGTH));

    const exact = validatePasswordDraft(
      passwordDraftFixture({ newPassword: EXACTLY_MIN, confirmPassword: EXACTLY_MIN }),
    );

    expect(exact.newPassword).toBeUndefined();
  });

  /**
   * ⭐ 공유계약 A-2 — 짝 제약은 **두 칸 모두**에 선다. 한쪽만 붉히면 어느 쪽을 고쳐야 하는지
   * 알 수 없다. 형제 사본(`approval-route/route-validation.ts`)이 상한 칸 하나에만 세우는데,
   * 그 형태를 그대로 옮기면 이 규칙이 깨진다.
   */
  it('새 비밀번호와 확인 값이 다르면 두 칸 모두에 오류가 선다', () => {
    const errors = validatePasswordDraft(
      passwordDraftFixture({ newPassword: SYNTHETIC_NEXT, confirmPassword: `${SYNTHETIC_NEXT}-X` }),
    );

    expect(errors.newPassword).toBe(t.validation.confirmMismatch);
    expect(errors.confirmPassword).toBe(t.validation.confirmMismatch);
  });

  /**
   * 한 칸에는 한 문장이다. 새 비밀번호 칸에서는 **자기 규칙(길이)이 짝 오류를 이긴다** —
   * 길이가 모자란 값은 확인 칸을 맞춰도 보낼 수 없어, 먼저 할 일을 먼저 말한다.
   * 그때도 확인 칸에는 짝 오류가 서므로 **두 칸이 함께 표시되는 사실은 유지된다.**
   */
  it('길이도 모자라고 확인 값도 다르면 새 칸은 길이 문구, 확인 칸은 불일치 문구다', () => {
    const errors = validatePasswordDraft(
      passwordDraftFixture({ newPassword: TOO_SHORT, confirmPassword: `${TOO_SHORT}-X` }),
    );

    expect(errors.newPassword).toBe(t.validation.tooShort(MIN_NEW_PASSWORD_LENGTH));
    expect(errors.confirmPassword).toBe(t.validation.confirmMismatch);
  });

  it('새 비밀번호가 현재 비밀번호와 같으면 그 칸에 오류가 선다', () => {
    const errors = validatePasswordDraft(
      passwordDraftFixture({
        currentPassword: SYNTHETIC_NEXT,
        newPassword: SYNTHETIC_NEXT,
        confirmPassword: SYNTHETIC_NEXT,
      }),
    );

    expect(errors.newPassword).toBe(t.validation.sameAsCurrent);
  });

  /**
   * ⭐ **비교는 원문 그대로 한다 — 다듬지 않는다.** 비밀번호에서 앞뒤 공백은 값의 일부라,
   * 걷어내고 비교하면 서버에는 **다른 값**인 둘을 화면이 「같다」고 막는다. 사용자는 왜
   * 막혔는지 알 수 없고 그 값을 영영 쓸 수 없다.
   */
  it('앞뒤 공백만 다른 값은 「현재와 같다」로 보지 않는다', () => {
    const same = validatePasswordDraft(
      passwordDraftFixture({
        currentPassword: SYNTHETIC_NEXT,
        newPassword: SYNTHETIC_NEXT,
        confirmPassword: SYNTHETIC_NEXT,
      }),
    );

    /* 양성 먼저 — 같은 규칙이 실제로 서는 것을 잡은 **뒤에** 서지 않음을 잰다. */
    expect(same.newPassword).toBe(t.validation.sameAsCurrent);

    const padded = ` ${SYNTHETIC_NEXT} `;
    const errors = validatePasswordDraft(
      passwordDraftFixture({
        currentPassword: SYNTHETIC_NEXT,
        newPassword: padded,
        confirmPassword: padded,
      }),
    );

    expect(errors.newPassword).toBeUndefined();
  });

  /**
   * 빈 칸에는 아무것도 그리지 않는다(결정 ④). 아직 치는 중인 칸에 붉은 글씨를 세우면 첫
   * 글자부터 오류가 뜬다 — 빈 칸의 사정은 **버튼 비활성 사유**가 말한다.
   */
  it('빈 칸에는 오류를 만들지 않는다', () => {
    const filled = validatePasswordDraft(
      passwordDraftFixture({ newPassword: TOO_SHORT, confirmPassword: TOO_SHORT }),
    );

    /* 양성 먼저 — 채운 칸에서 규칙이 실제로 서는 것을 잡은 **뒤에** 빈 칸을 잰다. */
    expect(filled.newPassword).toBe(t.validation.tooShort(MIN_NEW_PASSWORD_LENGTH));

    expect(validatePasswordDraft(emptyPasswordDraft)).toEqual({});
  });

  /** 짝 제약은 **두 값이 다 있을 때만** 판정한다 — 한쪽이 비면 비교할 것이 없다. */
  it('새 비밀번호가 비어 있으면 확인 칸에 불일치 오류를 세우지 않는다', () => {
    const both = validatePasswordDraft(
      passwordDraftFixture({ newPassword: SYNTHETIC_NEXT, confirmPassword: `${SYNTHETIC_NEXT}-X` }),
    );

    /* 양성 먼저 — 두 칸이 다 찼을 때 실제로 서는 것을 잡은 **뒤에** 재운다. */
    expect(both.confirmPassword).toBe(t.validation.confirmMismatch);

    const errors = validatePasswordDraft(
      passwordDraftFixture({ newPassword: '', confirmPassword: SYNTHETIC_NEXT }),
    );

    expect(errors.confirmPassword).toBeUndefined();
    expect(errors.newPassword).toBeUndefined();
  });

  /**
   * ⚠ **전례(`login-draft.ts`의 `isFilled`)와 반대로 판단하는 자리다.** 그쪽은 공백만 친 칸을
   * 빈 칸으로 셌고 아이디 칸을 함께 다루는 화면에서 그 판단이 옳다. 여기서는 세 칸이 전부
   * 비밀번호이고 **공백도 값의 일부**이며, 가려진 칸에서 공백은 점으로 **보인다** — 무언가 친
   * 칸을 화면이 「비었다」고 말하면 사용자는 왜 잠겼는지 알 수 없다.
   */
  it('공백만 친 칸도 채운 것으로 센다', () => {
    const spaces = ' '.repeat(MIN_NEW_PASSWORD_LENGTH);
    const draft = passwordDraftFixture({
      currentPassword: SYNTHETIC_CURRENT,
      newPassword: spaces,
      confirmPassword: spaces,
    });

    expect(validatePasswordDraft(draft)).toEqual({});
    expect(canSubmit(draft)).toBe(true);
  });
});

describe('canSubmit · submitDisabledReason — 한 판정에서 갈라 나온다', () => {
  it('세 칸이 채워지고 규칙을 만족하면 보낼 수 있고 사유가 없다', () => {
    const draft = passwordDraftFixture();

    expect(canSubmit(draft)).toBe(true);
    expect(submitDisabledReason(draft)).toBeUndefined();
  });

  it('빈 칸이 있으면 잠기고 사유가 「모두 입력하면 쓸 수 있다」를 말한다', () => {
    const cases = [
      passwordDraftFixture({ currentPassword: '' }),
      passwordDraftFixture({ newPassword: '' }),
      passwordDraftFixture({ confirmPassword: '' }),
      emptyPasswordDraft,
    ];

    for (const draft of cases) {
      expect(canSubmit(draft)).toBe(false);
      expect(submitDisabledReason(draft)).toBe(t.actionReasons.incomplete);
    }
  });

  /** 칸은 다 찼지만 규칙이 깨진 자리 — 사유가 **인라인 오류를 가리킨다.** */
  it('규칙이 깨졌으면 잠기고 사유가 칸의 오류를 가리킨다', () => {
    const draft = passwordDraftFixture({
      newPassword: TOO_SHORT,
      confirmPassword: TOO_SHORT,
    });

    expect(canSubmit(draft)).toBe(false);
    expect(submitDisabledReason(draft)).toBe(t.actionReasons.invalid);
  });

  /** 빈 칸과 규칙 위반이 함께 있으면 **채우는 일이 먼저다** — 고칠 값이 아직 다 서지 않았다. */
  it('빈 칸과 규칙 위반이 함께 있으면 채우라는 사유가 앞선다', () => {
    const draft = passwordDraftFixture({ newPassword: TOO_SHORT, confirmPassword: '' });

    expect(submitDisabledReason(draft)).toBe(t.actionReasons.incomplete);
  });
});
