import { describe, expect, it } from 'vitest';

import { ROLE_FORM_FIELDS, validateRoleForm } from './role-validation';
import type { RoleFormValues } from './types';

const valid: RoleFormValues = {
  roleCode: 'SYN-ROLE-01',
  roleName: '합성 역할 A',
  description: '합성 역할 A 설명',
};

describe('ROLE_FORM_FIELDS', () => {
  /** 목록에 없는 필드명은 삼키지 않고 배너로 간다 — 어디에도 표시되지 않는 오류를 만들지 않는다. */
  it('폼이 소유한 입력칸 이름만 담는다', () => {
    expect([...ROLE_FORM_FIELDS].sort()).toEqual(['description', 'roleCode', 'roleName']);
  });

  it('사용 여부는 담지 않는다 — 그 값을 고치는 입력칸이 없다', () => {
    expect(ROLE_FORM_FIELDS).not.toContain('isActive');
  });
});

describe('validateRoleForm', () => {
  it('올바른 값이면 오류가 없다', () => {
    expect(validateRoleForm(valid)).toEqual({});
  });

  it('설명은 비어도 된다 — 계약이 널을 허용한다', () => {
    expect(validateRoleForm({ ...valid, description: '' })).toEqual({});
  });

  it('역할 코드와 역할명은 필수다', () => {
    const errors = validateRoleForm({ roleCode: '', roleName: '', description: '' });

    expect(errors.roleCode).toBeDefined();
    expect(errors.roleName).toBeDefined();
  });

  /** 공백만 넣은 값은 저장되면 눈에 보이지 않는 빈 값이 된다 — 계약도 「공백만 불가」다. */
  it('공백만 넣은 필수 칸은 다른 사유로 막힌다', () => {
    const errors = validateRoleForm({ roleCode: '   ', roleName: '   ', description: '' });

    expect(errors.roleCode).toContain('공백');
    expect(errors.roleName).toContain('공백');
  });

  /**
   * 상한 자체는 허용값이며 **넘을 때만** 막는다.
   * 길이는 앞뒤 공백을 턴 값으로 센다 — 저장되는 값이 그 값이다.
   */
  it('역할 코드는 50자까지 되고 51자부터 막힌다', () => {
    expect(validateRoleForm({ ...valid, roleCode: 'A'.repeat(50) }).roleCode).toBeUndefined();
    expect(validateRoleForm({ ...valid, roleCode: 'A'.repeat(51) }).roleCode).toBeDefined();
    expect(
      validateRoleForm({ ...valid, roleCode: `  ${'A'.repeat(50)}  ` }).roleCode,
    ).toBeUndefined();
  });

  it('역할명은 200자까지 되고 201자부터 막힌다', () => {
    expect(validateRoleForm({ ...valid, roleName: '가'.repeat(200) }).roleName).toBeUndefined();
    expect(validateRoleForm({ ...valid, roleName: '가'.repeat(201) }).roleName).toBeDefined();
  });

  /**
   * **역할 코드는 등록·수정 어디서나 검사한다** — 로그인 ID와 갈리는 자리다.
   * 계약의 수정 본문에도 이 키가 있어 보낼 수 있는 값이고, 잠금은 `editability`가 정한다.
   */
  it('역할 코드 검사에 등록·수정의 구분이 없다', () => {
    expect(validateRoleForm({ ...valid, roleCode: '' }).roleCode).toBeDefined();
    expect(validateRoleForm({ ...valid, roleCode: 'A'.repeat(51) }).roleCode).toBeDefined();
  });

  /**
   * 계약이 그 판정을 서버 몫으로 두었다(전역 유일 제약).
   * 화면이 흉내 내려면 이미 있는 역할 코드 목록을 받아야 하는데, **그 인자가 없다** —
   * 목록을 받게 되는 순간 화면이 서버와 다른 답을 낼 수 있다.
   */
  it('중복 판정에 쓸 목록을 받지 않는다', () => {
    expect(validateRoleForm).toHaveLength(1);
  });

  /** 계약에 설명의 상한이 없다 — 없는 규칙을 화면이 지어내지 않는다. */
  it('설명의 길이를 막지 않는다', () => {
    expect(validateRoleForm({ ...valid, description: '가'.repeat(1000) })).toEqual({});
  });
});
