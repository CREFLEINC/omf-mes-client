import { describe, expect, it } from 'vitest';

import {
  clearUserFilter,
  hasAnyUserFilter,
  readPage,
  readSelectedId,
  readUserFilters,
  toUserFilterChips,
  toUserListQuery,
  toUserSearchParams,
} from './filters';
import type { UserFilters } from './types';

const params = (search: string): URLSearchParams => new URLSearchParams(search);

const EMPTY: UserFilters = { q: '', departmentId: '', includeInactive: false };

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
