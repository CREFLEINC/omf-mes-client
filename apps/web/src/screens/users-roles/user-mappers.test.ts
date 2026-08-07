import { describe, expect, it } from 'vitest';

import { filledUserFixture, inactiveUserFixture, nullFieldUserFixture } from './fixtures';
import {
  appUserToFormValues,
  emptyUserFormValues,
  isSameUserValues,
  toAppUserCreate,
  toAppUserUpdate,
} from './user-mappers';
import type { UserFormValues } from './types';

const filled: UserFormValues = {
  loginId: 'SYN-LOGIN-01',
  userName: '합성 사용자 A',
  departmentId: '3001',
  email: 'syn.user.a@example.invalid',
  statusCode: 'SYN-STATUS-A',
};

describe('appUserToFormValues', () => {
  it('계약 표현을 폼 표현으로 옮긴다', () => {
    expect(appUserToFormValues(filledUserFixture)).toEqual(filled);
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
  it('등록 폼은 전부 빈 값으로 시작한다', () => {
    expect(emptyUserFormValues()).toEqual({
      loginId: '',
      userName: '',
      departmentId: '',
      email: '',
      statusCode: '',
    });
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

  it('계약이 필수로 둔 두 키가 반드시 실린다', () => {
    const body = toAppUserUpdate(filled);

    expect(body.userName).toBe('합성 사용자 A');
    expect(Object.keys(body)).toContain('statusCode');
  });

  /** 화면이 고른 적이 없는 값이다 — 지어내지도, 빼지도 않는다. */
  it('상태 코드를 받은 그대로 되돌려 싣는다', () => {
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
    const body = toAppUserUpdate({ ...filled, userName: '  합성 사용자 A  ', email: '  a@b.invalid  ' });

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

  /** 계약이 「미지정 시 서버가 기본값으로 채운다」고 명시했고, 화면이 고를 수 있는 값이 없다. */
  it('상태 코드를 싣지 않는다', () => {
    expect(Object.keys(toAppUserCreate(filled))).not.toContain('statusCode');
    expect(Object.keys(toAppUserCreate({ ...filled, statusCode: 'SYN-STATUS-A' }))).not.toContain(
      'statusCode',
    );
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
    expect(toAppUserCreate({ ...filled, loginId: '  SYN-LOGIN-01  ' }).loginId).toBe('SYN-LOGIN-01');
  });
});

describe('isSameUserValues', () => {
  it('모든 칸이 같아야 같다', () => {
    expect(isSameUserValues(filled, { ...filled })).toBe(true);
  });

  it('칸 하나만 달라도 다르다', () => {
    for (const key of Object.keys(filled) as (keyof UserFormValues)[]) {
      expect(isSameUserValues(filled, { ...filled, [key]: 'SYN-CHANGED' })).toBe(false);
    }
  });
});
