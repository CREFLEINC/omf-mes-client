import { describe, expect, it } from 'vitest';

import {
  emptyRoleFormValues,
  isSameRoleValues,
  roleToFormValues,
  toRoleCreate,
  toRoleUpdate,
} from './role-mappers';
import type { Role, RoleFormValues } from './types';

const role: Role = {
  roleId: 5001,
  roleCode: 'SYN-ROLE-01',
  roleName: '합성 역할 A',
  description: '합성 역할 A 설명',
  isActive: true,
};

const values: RoleFormValues = {
  roleCode: 'SYN-ROLE-01',
  roleName: '합성 역할 A',
  description: '합성 역할 A 설명',
};

describe('roleToFormValues', () => {
  it('계약 표현을 폼 값으로 옮긴다', () => {
    expect(roleToFormValues(role)).toEqual(values);
  });

  /** 계약이 널을 허용한다 — 입력칸의 「지정하지 않음」이 하나의 값이어야 한다. */
  it('설명이 널이거나 없으면 빈 문자열이다', () => {
    expect(roleToFormValues({ ...role, description: null }).description).toBe('');
    expect(roleToFormValues({ ...role, description: undefined }).description).toBe('');
  });
});

describe('emptyRoleFormValues', () => {
  it('모든 칸이 빈 문자열이다 — 등록 폼은 아무것도 미리 고르지 않는다', () => {
    expect(emptyRoleFormValues()).toEqual({ roleCode: '', roleName: '', description: '' });
  });

  it('부를 때마다 새 객체다 — 등록 폼의 값이 다음 폼으로 새지 않는다', () => {
    expect(emptyRoleFormValues()).not.toBe(emptyRoleFormValues());
  });
});

describe('toRoleUpdate', () => {
  /**
   * 계약의 `RoleUpdate`는 `roleCode`·`roleName`·`description` 셋뿐이다.
   * 폼 값을 통째로 보내면 계약에 없는 키가 나간다.
   */
  it('계약이 정한 세 키만 싣는다', () => {
    expect(Object.keys(toRoleUpdate(values)).sort()).toEqual([
      'description',
      'roleCode',
      'roleName',
    ]);
  });

  /** 번호는 경로에 있고 사용 여부는 `:deactivate`로만 바뀐다. */
  it('번호와 사용 여부를 싣지 않는다', () => {
    const body: Record<string, unknown> = { ...toRoleUpdate(values) };

    expect(body).not.toHaveProperty('roleId');
    expect(body).not.toHaveProperty('isActive');
  });

  /** 로그인 ID와 갈리는 자리다 — 계약의 수정 본문에 이 키가 있다. */
  it('역할 코드를 싣는다', () => {
    expect(toRoleUpdate(values).roleCode).toBe('SYN-ROLE-01');
  });

  it('앞뒤 공백을 턴 값을 싣는다 — 눈으로 구분되지 않는 다른 값이 저장되면 안 된다', () => {
    const body = toRoleUpdate({
      roleCode: '  SYN-ROLE-01  ',
      roleName: '  합성 역할 A  ',
      description: '  합성 역할 A 설명  ',
    });

    expect(body.roleCode).toBe('SYN-ROLE-01');
    expect(body.roleName).toBe('합성 역할 A');
    expect(body.description).toBe('합성 역할 A 설명');
  });

  /**
   * 키를 빼면 서버가 이전 값을 남길 수 있어 한 번 넣은 설명을 지울 방법이 사라진다.
   * 부서·전자우편과 같은 규칙이다.
   */
  it('설명이 비어도 키를 빼지 않고 널을 명시한다', () => {
    const body = toRoleUpdate({ ...values, description: '' });

    expect(Object.keys(body)).toContain('description');
    expect(body.description).toBeNull();
  });

  it('공백만 넣은 설명도 널로 싣는다', () => {
    expect(toRoleUpdate({ ...values, description: '   ' }).description).toBeNull();
  });
});

describe('toRoleCreate', () => {
  it('계약이 정한 세 키만 싣는다', () => {
    expect(Object.keys(toRoleCreate(values)).sort()).toEqual([
      'description',
      'roleCode',
      'roleName',
    ]);
  });

  /** 계약이 「신규는 항상 사용 중」이라 사용 여부를 받지 않는다. */
  it('사용 여부와 번호를 싣지 않는다', () => {
    const body: Record<string, unknown> = { ...toRoleCreate(values) };

    expect(body).not.toHaveProperty('isActive');
    expect(body).not.toHaveProperty('roleId');
  });

  it('앞뒤 공백을 턴 값을 싣고 빈 설명은 널이다', () => {
    const body = toRoleCreate({ roleCode: ' SYN-ROLE-09 ', roleName: ' 합성 역할 D ', description: '' });

    expect(body.roleCode).toBe('SYN-ROLE-09');
    expect(body.roleName).toBe('합성 역할 D');
    expect(body.description).toBeNull();
  });
});

describe('isSameRoleValues', () => {
  it('세 칸이 모두 같아야 같다', () => {
    expect(isSameRoleValues(values, { ...values })).toBe(true);
    expect(isSameRoleValues(values, { ...values, roleCode: 'SYN-ROLE-02' })).toBe(false);
    expect(isSameRoleValues(values, { ...values, roleName: '합성 역할 B' })).toBe(false);
    expect(isSameRoleValues(values, { ...values, description: '' })).toBe(false);
  });
});
