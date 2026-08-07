import { describe, expect, it } from 'vitest';

import { USER_FORM_FIELDS, validateUserForm } from './user-validation';
import type { UserFormValues } from './types';

const valid: UserFormValues = {
  loginId: 'SYN-LOGIN-01',
  userName: '합성 사용자 A',
  departmentId: '3001',
  email: 'syn.user.a@example.invalid',
  statusCode: 'SYN-STATUS-A',
};

describe('USER_FORM_FIELDS', () => {
  /** 목록에 없는 필드명의 서버 오류는 삼키지 않고 배너로 간다. */
  it('폼이 소유한 입력칸 이름을 계약이 쓰는 이름 그대로 둔다', () => {
    expect([...USER_FORM_FIELDS]).toEqual(['loginId', 'userName', 'departmentId', 'email']);
  });

  /** 화면에 입력칸이 없는 값이라 인라인으로 낼 자리가 없다 — 오면 배너로 올라가야 한다. */
  it('상태 코드를 소유하지 않는다', () => {
    expect([...USER_FORM_FIELDS]).not.toContain('statusCode');
  });
});

describe('validateUserForm — 등록', () => {
  it('제대로 채운 값에는 오류가 없다', () => {
    expect(validateUserForm(valid, 'create')).toEqual({});
  });

  it('로그인 ID와 이름이 비면 필수 오류다', () => {
    const errors = validateUserForm({ ...valid, loginId: '', userName: '' }, 'create');

    expect(errors.loginId).toBeDefined();
    expect(errors.userName).toBeDefined();
  });

  /** 계약이 두 칸에 「공백만 불가」를 명시했다. */
  it('공백만 넣으면 필수와 다른 오류가 나온다', () => {
    const errors = validateUserForm({ ...valid, loginId: '   ', userName: '  ' }, 'create');

    expect(errors.loginId).toContain('공백만');
    expect(errors.userName).toContain('공백만');
  });

  /** 계약이 널을 허용한다 — 비우는 것이 정상 값이다. */
  it('부서와 전자우편은 비어도 오류가 아니다', () => {
    expect(validateUserForm({ ...valid, departmentId: '', email: '' }, 'create')).toEqual({});
  });

  /** 계약이 「형식 검증은 화면 책임 — DB 제약 없음」이라고 명시한 유일한 칸이다. */
  it('전자우편 형식이 아니면 오류다', () => {
    for (const email of ['syn.user.a', 'syn.user.a@', '@example.invalid', 'a b@example.invalid']) {
      expect(validateUserForm({ ...valid, email }, 'create').email).toBeDefined();
    }
  });

  it('전자우편 형식이 맞으면 오류가 아니다', () => {
    for (const email of ['a@b.invalid', 'syn.user.a@example.invalid', 'a+b@sub.example.invalid']) {
      expect(validateUserForm({ ...valid, email }, 'create').email).toBeUndefined();
    }
  });

  it('전자우편의 앞뒤 공백은 형식 판정에서 털어 낸다 — 저장되는 값이 그 값이다', () => {
    expect(validateUserForm({ ...valid, email: '  a@b.invalid  ' }, 'create').email).toBeUndefined();
  });

  /** 상한 자체는 허용값이다 — 상한에서 막으면 쓸 수 있는 값을 하나 잃는다. */
  it('상한 길이 그대로는 통과한다', () => {
    expect(
      validateUserForm(
        {
          ...valid,
          loginId: 'A'.repeat(100),
          userName: '가'.repeat(200),
          email: `${'a'.repeat(190)}@b.invalid`,
        },
        'create',
      ),
    ).toEqual({});
  });

  it('상한을 한 자라도 넘으면 막는다', () => {
    expect(validateUserForm({ ...valid, loginId: 'A'.repeat(101) }, 'create').loginId).toBeDefined();
    expect(
      validateUserForm({ ...valid, userName: '가'.repeat(201) }, 'create').userName,
    ).toBeDefined();
    expect(
      validateUserForm({ ...valid, email: `${'a'.repeat(191)}@b.invalid` }, 'create').email,
    ).toBeDefined();
  });

  /** 저장되는 값이 앞뒤 공백을 턴 값이므로 길이도 그 값으로 센다. */
  it('길이는 앞뒤 공백을 턴 값으로 센다', () => {
    expect(
      validateUserForm({ ...valid, userName: `  ${'가'.repeat(200)}  ` }, 'create').userName,
    ).toBeUndefined();
    expect(
      validateUserForm({ ...valid, userName: `  ${'가'.repeat(201)}  ` }, 'create').userName,
    ).toBeDefined();
  });

  /** 공백은 길이에 들어간다 — 가운데 공백은 저장되는 값의 일부다. */
  it('가운데 공백도 길이로 센다', () => {
    expect(
      validateUserForm({ ...valid, userName: `${'가'.repeat(200)} 나` }, 'create').userName,
    ).toBeDefined();
  });

  /** 계약이 그 판정을 서버 몫으로 두었다(전역 유일 제약) — 화면이 흉내 내면 다른 답을 낼 수 있다. */
  it('로그인 ID 중복을 검사하지 않는다', () => {
    expect(validateUserForm(valid, 'create').loginId).toBeUndefined();
  });
});

describe('validateUserForm — 수정', () => {
  /** 수정 본문에 `loginId` 키가 없다 — 보낼 수 없는 값을 막을 이유가 없다. */
  it('로그인 ID가 비어 있어도 오류로 잡지 않는다', () => {
    expect(validateUserForm({ ...valid, loginId: '' }, 'edit')).toEqual({});
  });

  it('이름은 그대로 필수다', () => {
    expect(validateUserForm({ ...valid, userName: '' }, 'edit').userName).toBeDefined();
    expect(validateUserForm({ ...valid, userName: '  ' }, 'edit').userName).toBeDefined();
  });

  it('전자우편 형식은 그대로 본다', () => {
    expect(validateUserForm({ ...valid, email: 'not-an-email' }, 'edit').email).toBeDefined();
  });

  /** 화면이 고른 적이 없는 값이다 — 검증할 규칙 자체가 없다. */
  it('상태 코드가 비어 있어도 오류가 아니다', () => {
    expect(validateUserForm({ ...valid, statusCode: '' }, 'edit')).toEqual({});
  });

  /** 보낼 수 없는 값이라 길이도 볼 이유가 없다. */
  it('로그인 ID가 아무리 길어도 수정에서는 오류로 잡지 않는다', () => {
    expect(validateUserForm({ ...valid, loginId: 'A'.repeat(5000) }, 'edit').loginId).toBeUndefined();
  });

  it('이름·전자우편의 상한은 수정에서도 같다', () => {
    expect(
      validateUserForm({ ...valid, userName: '가'.repeat(201) }, 'edit').userName,
    ).toBeDefined();
    expect(
      validateUserForm({ ...valid, email: `${'a'.repeat(191)}@b.invalid` }, 'edit').email,
    ).toBeDefined();
  });
});
