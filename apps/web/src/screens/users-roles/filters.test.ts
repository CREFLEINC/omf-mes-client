import { describe, expect, it } from 'vitest';

import {
  applySelection,
  clearRoleFilter,
  clearUserFilter,
  hasAnyRoleFilter,
  hasAnyUserFilter,
  isCreating,
  readPage,
  readRoleFilters,
  readSelectedId,
  readUserFilters,
  toRoleFilterChips,
  toRoleListQuery,
  toRoleSearchParams,
  toUserFilterChips,
  toUserListQuery,
  toUserSearchParams,
} from './filters';
import type { RoleFilters, UserFilters } from './types';

const params = (search: string): URLSearchParams => new URLSearchParams(search);

const EMPTY: UserFilters = { q: '', departmentId: '', includeInactive: false };

const EMPTY_ROLE: RoleFilters = { q: '', includeInactive: false };

describe('readUserFilters', () => {
  it('키가 하나도 없으면 빈 조건이다', () => {
    expect(readUserFilters(params(''))).toEqual(EMPTY);
  });

  it('검색어·부서·미사용 포함을 읽는다', () => {
    expect(readUserFilters(params('q=SYN-LOGIN&dept=3001&inactive=1'))).toEqual({
      q: 'SYN-LOGIN',
      departmentId: '3001',
      includeInactive: true,
    });
  });

  it('미사용 포함은 「1」일 때만 켜진다 — 주소를 손으로 고쳐도 뜻이 흔들리지 않는다', () => {
    expect(readUserFilters(params('inactive=true')).includeInactive).toBe(false);
    expect(readUserFilters(params('inactive=0')).includeInactive).toBe(false);
    expect(readUserFilters(params('inactive=')).includeInactive).toBe(false);
    expect(readUserFilters(params('inactive=1')).includeInactive).toBe(true);
  });

  /**
   * 이 값은 그대로 `Number()`를 거쳐 계약 쿼리(`departmentId`)로 나간다.
   * 걸러 내지 않으면 `?dept=abc` 같은 주소가 **`departmentId=NaN`을 서버로 보낸다.**
   */
  it('부서 번호가 식별자로 쓸 수 없는 값이면 「전체」로 본다', () => {
    for (const raw of ['abc', '-1', '1.5', '0', ' 1', '1e3', 'NaN', '']) {
      expect(readUserFilters(params(`dept=${raw}`)).departmentId).toBe('');
    }
  });

  it('부서 번호가 1 이상의 정수면 그대로 읽는다', () => {
    expect(readUserFilters(params('dept=1')).departmentId).toBe('1');
    expect(readUserFilters(params('dept=3001')).departmentId).toBe('3001');
  });
});

describe('readPage', () => {
  it('키가 없으면 첫 쪽이다', () => {
    expect(readPage(params(''))).toBe(1);
  });

  it('이상한 값은 첫 쪽으로 본다 — 주소는 손으로 고쳐지는 자리다', () => {
    for (const raw of ['abc', '-2', '0', '1.5', '']) {
      expect(readPage(params(`page=${raw}`))).toBe(1);
    }
  });

  it('1 이상의 정수면 그대로 읽는다', () => {
    expect(readPage(params('page=3'))).toBe(3);
  });
});

describe('readSelectedId', () => {
  it('식별자로 쓸 수 없는 값은 「고르지 않은 것」으로 본다', () => {
    for (const raw of ['abc', '-1', '1.5', '0', '']) {
      expect(readSelectedId(params(`usr=${raw}`), 'usr')).toBeNull();
    }
  });

  it('키가 없으면 고르지 않은 것이다', () => {
    expect(readSelectedId(params(''), 'usr')).toBeNull();
  });

  it('1 이상의 정수면 그 번호다', () => {
    expect(readSelectedId(params('usr=1001'), 'usr')).toBe(1001);
  });
});

describe('toUserSearchParams', () => {
  it('빈 조건·첫 쪽은 키 자체를 두지 않는다 — 같은 화면의 주소가 두 가지가 되지 않는다', () => {
    const next = toUserSearchParams('users', EMPTY, 1);

    expect([...next.keys()]).toEqual(['tab']);
  });

  it('꺼진 미사용 포함도 키를 두지 않는다', () => {
    const next = toUserSearchParams('users', { ...EMPTY, includeInactive: false }, 1);

    expect(next.has('inactive')).toBe(false);
  });

  it('걸린 조건과 둘째 쪽부터는 주소에 남는다', () => {
    const next = toUserSearchParams(
      'users',
      { q: 'SYN-LOGIN', departmentId: '3001', includeInactive: true },
      2,
    );

    expect(next.get('tab')).toBe('users');
    expect(next.get('q')).toBe('SYN-LOGIN');
    expect(next.get('dept')).toBe('3001');
    expect(next.get('inactive')).toBe('1');
    expect(next.get('page')).toBe('2');
  });

  /**
   * 조건·쪽이 바뀌면 보이는 행이 달라진다 — 이 함수의 결과로 주소를 통째로 갈아 끼우면
   * 선택이 자연히 사라진다. 목록에 없는 자원의 폼이 우 칸에 남으면 그것이 어디서 왔는지 알 수 없다.
   */
  it('선택(usr·new)을 담지 않는다', () => {
    const next = toUserSearchParams('users', { ...EMPTY, q: 'SYN-LOGIN' }, 3);

    expect(next.has('usr')).toBe(false);
    expect(next.has('new')).toBe(false);
  });

  it('읽기와 쓰기가 서로의 역이다 — 주소를 왕복해도 조건이 달라지지 않는다', () => {
    const filters: UserFilters = { q: 'SYN-LOGIN', departmentId: '3001', includeInactive: true };

    expect(readUserFilters(toUserSearchParams('users', filters, 2))).toEqual(filters);
    expect(readPage(toUserSearchParams('users', filters, 2))).toBe(2);
  });
});

describe('toUserListQuery', () => {
  it('빈 조건·꺼진 확인칸·첫 쪽은 키 자체를 싣지 않는다', () => {
    expect(toUserListQuery(EMPTY, 1)).toEqual({});
  });

  it('걸린 조건만 싣는다', () => {
    expect(toUserListQuery({ q: 'SYN-LOGIN', departmentId: '3001', includeInactive: true }, 2)).toEqual({
      q: 'SYN-LOGIN',
      departmentId: 3001,
      includeInactive: true,
      page: 2,
    });
  });

  it('부서 번호를 숫자로 옮긴다 — 계약이 정수를 받는다', () => {
    expect(toUserListQuery({ ...EMPTY, departmentId: '3001' }, 1).departmentId).toBe(3001);
  });

  /**
   * 값 목록이 확정되지 않아 고를 수 있는 값이 하나도 없다.
   * 자리표시 값을 쿼리로 보내면 언제나 0건이 온다(계획 결정 16).
   */
  it('상태 코드를 어떤 경우에도 싣지 않는다', () => {
    const query = toUserListQuery({ q: 'SYN-LOGIN', departmentId: '3001', includeInactive: true }, 2);

    expect(Object.keys(query)).not.toContain('statusCode');
    expect(Object.keys(toUserListQuery(EMPTY, 1))).not.toContain('statusCode');
  });
});

describe('toUserFilterChips', () => {
  it('조건이 없으면 칩도 없다', () => {
    expect(toUserFilterChips(EMPTY, () => '합성 부서 A')).toEqual([]);
  });

  it('조건마다 칩 하나이고 순서는 조건 줄의 컨트롤 순서와 같다', () => {
    const chips = toUserFilterChips(
      { q: 'SYN-LOGIN', departmentId: '3001', includeInactive: true },
      () => '합성 부서 A',
    );

    expect(chips.map((chip) => chip.key)).toEqual(['q', 'departmentId', 'includeInactive']);
  });

  it('부서 칩은 번호가 아니라 이름을 낸다 — 번호를 보이면 무엇을 걸었는지 모른다', () => {
    const chips = toUserFilterChips({ ...EMPTY, departmentId: '3001' }, () => '합성 부서 A');

    expect(chips[0]?.label).toContain('합성 부서 A');
    expect(chips[0]?.label).not.toContain('3001');
  });

  it('칩마다 제거 버튼의 접근 이름이 서로 다르다', () => {
    const chips = toUserFilterChips(
      { q: 'SYN-LOGIN', departmentId: '3001', includeInactive: true },
      () => '합성 부서 A',
    );
    const labels = chips.map((chip) => chip.removeLabel);

    expect(new Set(labels).size).toBe(labels.length);
  });
});

describe('hasAnyUserFilter', () => {
  it('조건이 하나라도 걸리면 참이다', () => {
    expect(hasAnyUserFilter(EMPTY)).toBe(false);
    expect(hasAnyUserFilter({ ...EMPTY, q: 'SYN-LOGIN' })).toBe(true);
    expect(hasAnyUserFilter({ ...EMPTY, departmentId: '3001' })).toBe(true);
    expect(hasAnyUserFilter({ ...EMPTY, includeInactive: true })).toBe(true);
  });
});

describe('clearUserFilter', () => {
  const all: UserFilters = { q: 'SYN-LOGIN', departmentId: '3001', includeInactive: true };

  it('고른 조건 하나만 푼다', () => {
    expect(clearUserFilter(all, 'q')).toEqual({ ...all, q: '' });
    expect(clearUserFilter(all, 'departmentId')).toEqual({ ...all, departmentId: '' });
    expect(clearUserFilter(all, 'includeInactive')).toEqual({ ...all, includeInactive: false });
  });

  it('원본을 바꾸지 않는다', () => {
    clearUserFilter(all, 'q');

    expect(all.q).toBe('SYN-LOGIN');
  });
});

describe('readRoleFilters', () => {
  it('키가 하나도 없으면 빈 조건이다', () => {
    expect(readRoleFilters(params(''))).toEqual(EMPTY_ROLE);
  });

  it('검색어와 미사용 포함을 읽는다', () => {
    expect(readRoleFilters(params('q=SYN-ROLE&inactive=1'))).toEqual({
      q: 'SYN-ROLE',
      includeInactive: true,
    });
  });

  it('미사용 포함은 「1」일 때만 켜진다 — 사용자 탭과 같은 규칙이다', () => {
    expect(readRoleFilters(params('inactive=true')).includeInactive).toBe(false);
    expect(readRoleFilters(params('inactive=1')).includeInactive).toBe(true);
  });

  /**
   * 계약의 역할 목록 쿼리에 부서가 없다. 주소에 남아 있어도 조건으로 읽지 않아야
   * 탭을 손으로 오간 주소가 「없는 쿼리」를 만들지 않는다.
   */
  it('주소에 부서가 남아 있어도 역할 조건으로 읽지 않는다', () => {
    expect(readRoleFilters(params('q=SYN-ROLE&dept=3001'))).toEqual({
      q: 'SYN-ROLE',
      includeInactive: false,
    });
  });
});

describe('toRoleSearchParams', () => {
  it('빈 조건·첫 쪽은 키 자체를 두지 않는다', () => {
    expect([...toRoleSearchParams('roles', EMPTY_ROLE, 1).keys()]).toEqual(['tab']);
  });

  it('걸린 조건과 둘째 쪽부터는 주소에 남는다', () => {
    const next = toRoleSearchParams('roles', { q: 'SYN-ROLE', includeInactive: true }, 2);

    expect(next.get('tab')).toBe('roles');
    expect(next.get('q')).toBe('SYN-ROLE');
    expect(next.get('inactive')).toBe('1');
    expect(next.get('page')).toBe('2');
  });

  /** 이 탭에 없는 조건을 주소에 적으면 무엇으로 조회했는지 읽을 수 없다. */
  it('부서 키를 만들지 않는다', () => {
    expect(toRoleSearchParams('roles', { q: 'SYN-ROLE', includeInactive: true }, 2).has('dept')).toBe(
      false,
    );
  });

  it('선택(rol·new)을 담지 않는다', () => {
    const next = toRoleSearchParams('roles', { ...EMPTY_ROLE, q: 'SYN-ROLE' }, 3);

    expect(next.has('rol')).toBe(false);
    expect(next.has('new')).toBe(false);
    expect(next.has('usr')).toBe(false);
  });

  it('읽기와 쓰기가 서로의 역이다', () => {
    const filters: RoleFilters = { q: 'SYN-ROLE', includeInactive: true };

    expect(readRoleFilters(toRoleSearchParams('roles', filters, 2))).toEqual(filters);
    expect(readPage(toRoleSearchParams('roles', filters, 2))).toBe(2);
  });
});

describe('toRoleListQuery', () => {
  it('빈 조건·꺼진 확인칸·첫 쪽은 키 자체를 싣지 않는다', () => {
    expect(toRoleListQuery(EMPTY_ROLE, 1)).toEqual({});
  });

  it('걸린 조건만 싣는다', () => {
    expect(toRoleListQuery({ q: 'SYN-ROLE', includeInactive: true }, 2)).toEqual({
      q: 'SYN-ROLE',
      includeInactive: true,
      page: 2,
    });
  });

  /** 계약에 없는 쿼리다 — 실으면 서버가 모르는 조건이 나간다. */
  it('부서를 어떤 경우에도 싣지 않는다', () => {
    expect(Object.keys(toRoleListQuery({ q: 'SYN-ROLE', includeInactive: true }, 2))).not.toContain(
      'departmentId',
    );
  });

  it('상태 코드를 어떤 경우에도 싣지 않는다', () => {
    expect(Object.keys(toRoleListQuery({ q: 'SYN-ROLE', includeInactive: true }, 2))).not.toContain(
      'statusCode',
    );
  });
});

describe('toRoleFilterChips', () => {
  it('조건이 없으면 칩도 없다', () => {
    expect(toRoleFilterChips(EMPTY_ROLE)).toEqual([]);
  });

  it('조건마다 칩 하나이고 순서는 조건 줄의 컨트롤 순서와 같다', () => {
    expect(toRoleFilterChips({ q: 'SYN-ROLE', includeInactive: true }).map((chip) => chip.key)).toEqual(
      ['q', 'includeInactive'],
    );
  });

  it('칩마다 제거 버튼의 접근 이름이 서로 다르다', () => {
    const labels = toRoleFilterChips({ q: 'SYN-ROLE', includeInactive: true }).map(
      (chip) => chip.removeLabel,
    );

    expect(new Set(labels).size).toBe(labels.length);
  });
});

describe('hasAnyRoleFilter · clearRoleFilter', () => {
  it('조건이 하나라도 걸리면 참이다', () => {
    expect(hasAnyRoleFilter(EMPTY_ROLE)).toBe(false);
    expect(hasAnyRoleFilter({ ...EMPTY_ROLE, q: 'SYN-ROLE' })).toBe(true);
    expect(hasAnyRoleFilter({ ...EMPTY_ROLE, includeInactive: true })).toBe(true);
  });

  it('고른 조건 하나만 푼다', () => {
    const all: RoleFilters = { q: 'SYN-ROLE', includeInactive: true };

    expect(clearRoleFilter(all, 'q')).toEqual({ ...all, q: '' });
    expect(clearRoleFilter(all, 'includeInactive')).toEqual({ ...all, includeInactive: false });
    expect(all.q).toBe('SYN-ROLE');
  });
});

/**
 * 선택 자리는 넷이지만 **함께 성립하지 않는 하나의 자리**다.
 * 규칙을 한 곳에 두지 않으면 자리마다 「무엇을 비우는가」가 갈린다.
 */
describe('applySelection', () => {
  const applied = (search: string, selection: Parameters<typeof applySelection>[1]): URLSearchParams => {
    const next = params(search);
    applySelection(next, selection);
    return next;
  };

  it('사용자를 고르면 등록 자리와 역할 선택이 함께 빠진다', () => {
    const next = applied('new=user&rol=5001', { kind: 'user', appUserId: 1001 });

    expect(next.get('usr')).toBe('1001');
    expect(next.has('new')).toBe(false);
    expect(next.has('rol')).toBe(false);
  });

  it('사용자 등록을 열면 고른 사용자와 역할 선택이 함께 빠진다', () => {
    const next = applied('usr=1001&rol=5001', { kind: 'createUser' });

    expect(next.get('new')).toBe('user');
    expect(next.has('usr')).toBe(false);
    expect(next.has('rol')).toBe(false);
  });

  it('역할을 고르면 등록 자리와 사용자 선택이 함께 빠진다', () => {
    const next = applied('new=role&usr=1001', { kind: 'role', roleId: 5001 });

    expect(next.get('rol')).toBe('5001');
    expect(next.has('new')).toBe(false);
    expect(next.has('usr')).toBe(false);
  });

  it('역할 등록을 열면 고른 역할과 사용자 선택이 함께 빠진다', () => {
    const next = applied('rol=5001&usr=1001', { kind: 'createRole' });

    expect(next.get('new')).toBe('role');
    expect(next.has('rol')).toBe(false);
    expect(next.has('usr')).toBe(false);
  });

  it('선택을 놓으면 네 자리가 모두 빠진다', () => {
    const next = applied('usr=1001&rol=5001&new=user', { kind: 'none' });

    for (const key of ['usr', 'rol', 'new']) {
      expect(next.has(key)).toBe(false);
    }
  });

  /**
   * **비우지 않는 쪽의 짝이다.** 선택을 바꾸는 것은 보이는 행을 바꾸지 않으므로
   * 조건과 쪽은 그대로 둔다 — 고른 사용자를 열었다고 조회 조건이 풀리면 안 된다.
   */
  it('조회 조건과 쪽은 그대로 둔다', () => {
    const next = applied('tab=users&q=syn&dept=3001&inactive=1&page=3', {
      kind: 'user',
      appUserId: 1001,
    });

    expect(next.get('tab')).toBe('users');
    expect(next.get('q')).toBe('syn');
    expect(next.get('dept')).toBe('3001');
    expect(next.get('inactive')).toBe('1');
    expect(next.get('page')).toBe('3');
  });
});

describe('isCreating', () => {
  it('등록 자리의 값이 그 자원일 때만 참이다', () => {
    expect(isCreating(params('new=user'), 'user')).toBe(true);
    expect(isCreating(params('new=user'), 'role')).toBe(false);
    expect(isCreating(params('new=role'), 'role')).toBe(true);
    expect(isCreating(params('new=role'), 'user')).toBe(false);
  });

  it('키가 없거나 모르는 값이면 거짓이다 — 주소는 손으로 고쳐지는 자리다', () => {
    expect(isCreating(params(''), 'user')).toBe(false);
    expect(isCreating(params('new=xyz'), 'user')).toBe(false);
    expect(isCreating(params('new=USER'), 'user')).toBe(false);
  });
});
