import { afterEach, describe, expect, it, vi } from 'vitest';

import { filledUserFixture, inactiveUserFixture, nullFieldUserFixture } from './fixtures';
import { FALLBACK_INITIAL_PASSWORD } from './initial-password';
import {
  appUserToFormValues,
  emptyUserFormValues,
  isSameUserValues,
  toAppUserCreate,
  toAppUserUpdate,
} from './user-mappers';
import type { UserFormValues } from './types';

/*
 * `password` 는 등록 전용 칸이라 상세 조회(`filledUserFixture` 등)에는 대응 값이 없다 — 여기
 * 값은 `toAppUserCreate`·`isSameUserValues` 시험이 쓰는 합성 초기 비밀번호일 뿐,
 * `appUserToFormValues`가 실제로 이 값을 돌려준다는 뜻이 아니다(그 함수는 늘 `''`를 돌려준다 —
 * 아래 `appUserToFormValues` 시험 참고).
 */
const filled: UserFormValues = {
  loginId: 'SYN-LOGIN-01',
  password: 'SYN-PW-0001a',
  userName: '합성 사용자 A',
  departmentId: '3001',
  email: 'syn.user.a@example.invalid',
  statusCode: 'SYN-STATUS-A',
};

describe('appUserToFormValues', () => {
  // 수정 폼에는 비밀번호 칸이 없다 — 상세 응답에 값이 있을 수 없으므로 항상 빈 문자열로 채운다.
  it('계약 표현을 폼 표현으로 옮긴다 — 비밀번호는 항상 비운다', () => {
    expect(appUserToFormValues(filledUserFixture)).toEqual({ ...filled, password: '' });
  });

  it('널·없음을 빈 문자열로 모은다 — 입력칸의 「지정하지 않음」이 하나의 값이어야 한다', () => {
    const values = appUserToFormValues(nullFieldUserFixture);

    expect(values.departmentId).toBe('');
    expect(values.email).toBe('');
  });

  it('계약이 키를 빼고 주는 경우도 빈 문자열로 모은다', () => {
    const values = appUserToFormValues({
      appUserId: 1004,
      loginId: 'SYN-LOGIN-04',
      userName: '합성 사용자 D',
      statusCode: 'SYN-STATUS-A',
      isActive: true,
    });

    expect(values.departmentId).toBe('');
    expect(values.email).toBe('');
  });

  /** 값 목록이 미정이라 화면이 고른 적이 없다 — 받은 값을 그대로 들고 있어야 되돌려 실을 수 있다. */
  it('상태 코드를 서버가 준 그대로 들고 있는다', () => {
    expect(appUserToFormValues(nullFieldUserFixture).statusCode).toBe('SYN-STATUS-B');
    expect(appUserToFormValues(inactiveUserFixture).statusCode).toBe('');
  });
});

describe('emptyUserFormValues', () => {
  /*
   * ⚠⚠ 함정: `.env.local` 이 vitest 에도 실린다(`initial-password.test.ts` 머리말 참고).
   * `password` 는 환경변수에 따라 갈리므로 이 describe 의 모든 시험이 `vi.stubEnv` 로 값을
   * 못 박는다 — 지우지 마라.
   */
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('비밀번호 외 나머지 칸은 전부 빈 값으로 시작한다', () => {
    vi.stubEnv('VITE_DEFAULT_INITIAL_PASSWORD', '');

    const values = emptyUserFormValues();

    expect(values.loginId).toBe('');
    expect(values.userName).toBe('');
    expect(values.departmentId).toBe('');
    expect(values.email).toBe('');
    expect(values.statusCode).toBe('');
  });

  it('환경변수가 있으면 초기 비밀번호를 그 값으로 시딩한다', () => {
    vi.stubEnv('VITE_DEFAULT_INITIAL_PASSWORD', 'SYN-PW-0002b');

    expect(emptyUserFormValues().password).toBe('SYN-PW-0002b');
  });

  it('환경변수가 없으면 코드 기본값으로 시딩한다', () => {
    vi.stubEnv('VITE_DEFAULT_INITIAL_PASSWORD', '');

    expect(emptyUserFormValues().password).toBe(FALLBACK_INITIAL_PASSWORD);
  });
});

describe('toAppUserUpdate', () => {
  /** 계약의 수정 본문에 `loginId` 키가 아예 없다 — 폼 값을 통째로 보내면 계약 위반이다. */
  it('로그인 ID를 싣지 않는다', () => {
    expect(Object.keys(toAppUserUpdate(filled))).not.toContain('loginId');
  });

  it('번호·사용 여부를 싣지 않는다 — 번호는 경로에 있고 사용 여부는 전용 액션으로만 바뀐다', () => {
    const keys = Object.keys(toAppUserUpdate(filled));

    expect(keys).not.toContain('appUserId');
    expect(keys).not.toContain('isActive');
  });

  // 계약의 수정 본문에 `password` 자리가 없다 — 비밀번호 변경은 본인이 자기 화면에서 한다.
  it('비밀번호를 싣지 않는다 — 계약의 수정 본문에 자리가 없다', () => {
    expect(Object.keys(toAppUserUpdate(filled))).not.toContain('password');
  });

  it('계약이 필수로 둔 이름과 선택한 상태가 실린다', () => {
    const body = toAppUserUpdate(filled);

    expect(body.userName).toBe('합성 사용자 A');
    expect(Object.keys(body)).toContain('statusCode');
  });

  /*
   * ⛔⛔ **`statusCode` 가 2026-09-11 전달본에서 선택 → 필수로 바뀌었다**(`user-mappers.ts`
   * 머리말 참고). 예전엔 비우면 키를 빼 기존 상태를 보존했는데, 지금 생성 타입은 이 칸을
   * required 로 요구해 키를 뺄 수 없다 — 항상 폼 값을 그대로 싣는다. 실제 화면에서는 수정
   * 폼이 상세 조회로 채운 뒤에만 열려 이 값이 빈 문자열이 될 일이 없다(screen.tsx 폼 시딩).
   */
  it('선택한 상태 코드를 그대로 싣는다 — 이제 필수라 비워도 키를 뺄 수 없다', () => {
    expect(toAppUserUpdate(filled).statusCode).toBe('SYN-STATUS-A');
    expect(toAppUserUpdate({ ...filled, statusCode: '' }).statusCode).toBe('');
  });

  /** 키를 빼면 서버가 이전 값을 남길 수 있어 한 번 넣은 값을 지울 방법이 사라진다. */
  it('비운 부서·전자우편은 키를 빼지 않고 널을 명시한다', () => {
    const body = toAppUserUpdate({ ...filled, departmentId: '', email: '' });

    expect(body.departmentId).toBeNull();
    expect(body.email).toBeNull();
    expect(Object.keys(body)).toContain('departmentId');
    expect(Object.keys(body)).toContain('email');
  });

  it('부서 번호를 숫자로 옮긴다 — 계약이 정수를 받는다', () => {
    expect(toAppUserUpdate(filled).departmentId).toBe(3001);
  });

  /** 앞뒤 공백이 붙은 이름은 눈으로 구분되지 않는 다른 값이 된다. */
  it('이름과 전자우편의 앞뒤 공백을 턴다', () => {
    const body = toAppUserUpdate({
      ...filled,
      userName: '  합성 사용자 A  ',
      email: '  a@b.invalid  ',
    });

    expect(body.userName).toBe('합성 사용자 A');
    expect(body.email).toBe('a@b.invalid');
  });

  it('공백만 넣은 전자우편은 널이 된다', () => {
    expect(toAppUserUpdate({ ...filled, email: '   ' }).email).toBeNull();
  });
});

describe('toAppUserCreate', () => {
  it('등록에서만 로그인 ID를 싣는다', () => {
    expect(toAppUserCreate(filled).loginId).toBe('SYN-LOGIN-01');
  });

  // 서버는 2026-09-12부터 이 값을 받아 계정 비밀번호로 쓴다 — 싣지 않으면 아무도 값을 모르는 계정이 된다.
  it('초기 비밀번호를 싣는다', () => {
    expect(toAppUserCreate(filled).password).toBe(filled.password);
  });

  /*
   * ⭐⭐ **결함 감지기: `password` 는 다듬지 않는다.** 형제 필드 `loginId` 는 다듬는다 —
   * 같은 함수에서 함께 재어 대비가 드러나게 한다.
   *
   * 근거: 이 칸은 가려진 칸이다. 앞뒤 공백은 비밀번호에서 값의 일부이고 사용자는 화면이
   * 무엇을 걷어냈는지 볼 수 없다 — 다듬은 값을 보내면 사용자가 친 것과 다른 비밀번호가
   * 저장되어, 그 사람은 자기가 친 값으로 로그인할 수 없게 된다.
   *
   * ⛔ **이 시험이 없으면 다음 사람이 「일관성」을 이유로 `.trim()` 을 붙인다** — 붙이는
   * 순간 결함이 되므로, 이 시험은 그 순간 반드시 빨개져야 한다.
   */
  it('비밀번호는 앞뒤 공백을 다듬지 않는다 — 로그인 ID는 다듬는다', () => {
    const body = toAppUserCreate({
      ...filled,
      loginId: '  SYN-LOGIN-01  ',
      password: '  SYN-PW-0001a  ',
    });

    expect(body.password).toBe('  SYN-PW-0001a  ');
    expect(body.loginId).toBe('SYN-LOGIN-01');
  });

  /*
   * 검증(`validateUserForm`)이 빈 값으로는 보내지 못하게 막지만, 이 함수 자체가 키를 빼면
   * 「비우면 서버가 만들어 준다」는 — 아무도 비밀번호를 모르게 되는 — 옛 동작으로 조용히
   * 되돌아간다. 매핑 함수 자체가 그 되돌림을 하지 않는다는 것을 검증과 별개로 못 박는다.
   */
  it('비밀번호가 빈 값이어도 키를 빼지 않는다', () => {
    const body = toAppUserCreate({ ...filled, password: '' });

    expect(Object.keys(body)).toContain('password');
    expect(body.password).toBe('');
  });

  it('고른 상태는 싣고 미지정이면 서버의 재직 기본값을 쓴다', () => {
    expect(toAppUserCreate(filled).statusCode).toBe('SYN-STATUS-A');
    expect(Object.keys(toAppUserCreate({ ...filled, statusCode: '' }))).not.toContain('statusCode');
  });

  it('사용 여부를 싣지 않는다 — 신규는 항상 사용 중이다', () => {
    expect(Object.keys(toAppUserCreate(filled))).not.toContain('isActive');
  });

  it('비운 부서·전자우편은 널을 명시한다', () => {
    const body = toAppUserCreate({ ...filled, departmentId: '', email: '' });

    expect(body.departmentId).toBeNull();
    expect(body.email).toBeNull();
  });

  it('로그인 ID의 앞뒤 공백을 턴다', () => {
    expect(toAppUserCreate({ ...filled, loginId: '  SYN-LOGIN-01  ' }).loginId).toBe(
      'SYN-LOGIN-01',
    );
  });
});

describe('isSameUserValues', () => {
  it('모든 칸이 같아야 같다', () => {
    expect(isSameUserValues(filled, { ...filled })).toBe(true);
  });

  // `filled`가 이제 `password`도 담고 있어 이 루프가 password 칸도 자동으로 덮는다.
  it('칸 하나만 달라도 다르다 — password 칸도 포함한다', () => {
    for (const key of Object.keys(filled) as (keyof UserFormValues)[]) {
      expect(isSameUserValues(filled, { ...filled, [key]: 'SYN-CHANGED' })).toBe(false);
    }
  });

  /*
   * ⭐ 등록에서는 기본값이 미리 채워져 있어 「비밀번호만 고친 초안」이 흔한 경우다. 빼면
   * 그 경우에 이 함수가 「고친 것이 없다」로 답해 등록 단추가 잠긴다 — 위 루프와 별개로
   * 이 갈래를 이름 붙여 못 박는다.
   */
  it('비밀번호만 달라도 다르다고 본다', () => {
    expect(isSameUserValues(filled, { ...filled, password: 'SYN-PW-CHANGED' })).toBe(false);
  });
});
