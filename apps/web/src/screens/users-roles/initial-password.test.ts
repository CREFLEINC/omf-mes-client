import { messages } from '@omf-mes/i18n';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  defaultInitialPassword,
  FALLBACK_INITIAL_PASSWORD,
  INITIAL_PASSWORD_MIN_LENGTH,
  validateInitialPassword,
} from './initial-password';

/**
 * ⚠⚠ **함정: `.env.local` 이 시험에도 샌다.** vite 는 모드와 무관하게 `apps/web/.env.local`
 * 을 읽고, 그 값이 vitest 로도 실린다. 이 저장소에는 이미 그 파일이 있다 — 누가 거기에
 * `VITE_DEFAULT_INITIAL_PASSWORD` 를 적어 넣으면 **그 기계에서만** 아래 시험이 갈린다.
 *
 * 그래서 `defaultInitialPassword()` 에 닿는 시험은 전부 `vi.stubEnv` 로 값을 못 박는다 —
 * 「환경변수가 없을 때」를 재는 시험도 `vi.stubEnv(..., '')` 로 **빈 값을 명시**한다. 「안
 * 건드린다」로 남겨 두면 기계마다 다른 것을 재게 된다. **다음 사람이 이 stub 을 지우면 이
 * 흔들림이 되돌아온다** — 지우지 마라.
 */

const t = messages.usersRoles.user.validation;

describe('defaultInitialPassword', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('환경변수에 값이 있으면 그 값을 낸다', () => {
    vi.stubEnv('VITE_DEFAULT_INITIAL_PASSWORD', 'SYN-PW-0001a');

    expect(defaultInitialPassword()).toBe('SYN-PW-0001a');
  });

  it('환경변수가 빈 문자열이면 배포 기본값을 낸다 — 빈 문자열은 「설정 안 함」과 같다', () => {
    vi.stubEnv('VITE_DEFAULT_INITIAL_PASSWORD', '');

    expect(defaultInitialPassword()).toBe(FALLBACK_INITIAL_PASSWORD);
  });

  /*
   * ⭐ **코드 기본값 자체가 규칙을 통과해야 한다.** 이 단언이 없으면 누군가
   * `FALLBACK_INITIAL_PASSWORD` 를 규칙 위반 값(길이 부족·숫자만·알파벳만)으로 바꿔도 아무
   * 시험도 빨개지지 않는다 — 환경변수를 안 덮은 배포본은 등록 폼이 열리자마자 「규칙 위반」
   * 오류를 안고 시작하게 된다. 이 한 줄이 그 사고를 막는다.
   */
  it('코드 기본값 자체가 초기 비밀번호 규칙을 통과한다', () => {
    expect(validateInitialPassword(FALLBACK_INITIAL_PASSWORD)).toBeUndefined();
  });
});

describe('validateInitialPassword', () => {
  it('빈 값은 필수 문구다', () => {
    expect(validateInitialPassword('')).toBe(t.required);
  });

  it('7자는 숫자와 알파벳을 다 채워도 규칙 미달이다 — 하한을 한 자 못 채운다', () => {
    expect(validateInitialPassword('abcdef1')).toBe(t.initialPasswordWeak(INITIAL_PASSWORD_MIN_LENGTH));
  });

  it('정확히 8자 숫자+알파벳은 통과한다 — 이 길이는 상한이 아니라 하한이다', () => {
    expect(validateInitialPassword('abcdefg1')).toBeUndefined();
  });

  it('알파벳만 8자는 숫자가 없어 규칙 미달이다', () => {
    expect(validateInitialPassword('abcdefgh')).toBe(t.initialPasswordWeak(INITIAL_PASSWORD_MIN_LENGTH));
  });

  it('숫자만 8자는 알파벳이 없어 규칙 미달이다', () => {
    expect(validateInitialPassword('12345678')).toBe(t.initialPasswordWeak(INITIAL_PASSWORD_MIN_LENGTH));
  });

  it('특수문자를 섞은 8자 숫자+알파벳은 통과한다 — 특수문자는 금지가 아니다', () => {
    expect(validateInitialPassword('ab1@cd2!')).toBeUndefined();
  });

  /*
   * 앞뒤 공백이 붙었지만 「공백 포함 8자, 다듬으면 7자」인 값 — trim() 하지 않는다는 사실을
   * 이 값으로만 드러낼 수 있다. trim() 했다면 길이가 7이 되어 규칙 미달로 떨어진다.
   */
  it('앞뒤 공백을 포함해 8자를 채우면 통과한다 — 다듬으면 7자라 다듬지 않는다는 것을 알 수 있다', () => {
    const withTrailingSpace = 'ab12345 ';

    expect(withTrailingSpace.trim().length).toBe(7);
    expect(validateInitialPassword(withTrailingSpace)).toBeUndefined();
  });

  /*
   * `''` 과 다른 갈래임이 드러나야 한다 — 공백만 친 칸은 「빈 칸」이 아니라 「숫자도 알파벳도
   * 없는, 규칙을 못 채운 값」이다. required 문구가 아니라 weak 문구가 서야 한다.
   */
  it('공백만 8자는 빈 칸이 아니라 규칙 미달이다', () => {
    const spacesOnly = ' '.repeat(INITIAL_PASSWORD_MIN_LENGTH);

    expect(validateInitialPassword(spacesOnly)).toBe(t.initialPasswordWeak(INITIAL_PASSWORD_MIN_LENGTH));
    expect(validateInitialPassword(spacesOnly)).not.toBe(t.required);
  });

  // 알파벳 판정이 `A-Za-z` 로 좁혀 있음을 확인한다 — 한글은 「알파벳」으로 세어지지 않는다.
  it('한글만 + 숫자는 알파벳이 없어 규칙 미달이다', () => {
    expect(validateInitialPassword('비밀번호1234')).toBe(
      t.initialPasswordWeak(INITIAL_PASSWORD_MIN_LENGTH),
    );
  });

  // 한글을 금지하지는 않는다 — 알파벳 한 자만 더해지면 통과한다.
  it('한글 + 숫자 + 알파벳은 통과한다 — 한글을 금지하지 않는다', () => {
    expect(validateInitialPassword('비밀번호1234a')).toBeUndefined();
  });

  // `\d` 가 ASCII 숫자만 세는지 확인한다 — 전각 숫자는 「숫자」로 세어지지 않는다.
  it('전각 숫자만 + 알파벳은 숫자가 없어 규칙 미달이다', () => {
    expect(validateInitialPassword('abcdefg１')).toBe(
      t.initialPasswordWeak(INITIAL_PASSWORD_MIN_LENGTH),
    );
  });
});
