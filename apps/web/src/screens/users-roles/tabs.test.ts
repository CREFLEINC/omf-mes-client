import { describe, expect, it } from 'vitest';

import { USERS_ROLES_TABS, resolveTab, tabSearchParams } from './tabs';

describe('USERS_ROLES_TABS', () => {
  it('탭 정의 배열이 정본이다 — 만든 탭만 들어 있다', () => {
    expect(USERS_ROLES_TABS.map((tab) => tab.id)).toEqual(['users', 'roles']);
  });

  it('탭마다 서로 다른 주소값을 갖는다', () => {
    const ids = USERS_ROLES_TABS.map((tab) => tab.id);

    expect(new Set(ids).size).toBe(USERS_ROLES_TABS.length);
  });

  it('탭마다 라벨이 있고 비어 있지 않다', () => {
    for (const tab of USERS_ROLES_TABS) {
      expect(tab.label).not.toBe('');
    }
  });
});

describe('resolveTab', () => {
  it('아는 값이면 그 탭을 낸다', () => {
    for (const tab of USERS_ROLES_TABS) {
      expect(resolveTab(tab.id)).toBe(tab);
    }
  });

  it('값이 없으면 첫 탭으로 떨어진다', () => {
    expect(resolveTab(null)).toBe(USERS_ROLES_TABS[0]);
  });

  it('모르는 값·빈 값이면 첫 탭으로 떨어진다 — 주소 조작으로 빈 화면이 되지 않는다', () => {
    expect(resolveTab('xyz')).toBe(USERS_ROLES_TABS[0]);
    expect(resolveTab('')).toBe(USERS_ROLES_TABS[0]);
  });

  /** 만든 탭이므로 이제는 아는 값이다 — 첫 탭으로 떨어지지 않는다. */
  it('역할·권한 탭 값이면 그 탭이 열린다', () => {
    expect(resolveTab('roles')).toBe(USERS_ROLES_TABS[1]);
  });

  it('아직 만들지 않은 탭 값은 모르는 값이다 — 자리만 있는 탭으로 떨어지지 않는다', () => {
    expect(resolveTab('permissions')).toBe(USERS_ROLES_TABS[0]);
  });

  it('대소문자가 다르면 모르는 값이다 — 주소값을 느슨하게 해석하지 않는다', () => {
    expect(resolveTab('USERS')).toBe(USERS_ROLES_TABS[0]);
    expect(resolveTab('ROLES')).toBe(USERS_ROLES_TABS[0]);
  });
});

describe('tabSearchParams', () => {
  it('탭 값만 남는다 — 이전 탭의 조건·선택을 하나도 넘기지 않는다', () => {
    const next = tabSearchParams('users');

    expect(next.get('tab')).toBe('users');
    expect([...next.keys()]).toEqual(['tab']);
  });

  it('어떤 탭이든 결과에 조건·선택 키가 없다', () => {
    for (const tab of USERS_ROLES_TABS) {
      const next = tabSearchParams(tab.id);

      for (const key of ['q', 'dept', 'inactive', 'page', 'usr', 'rol', 'new']) {
        expect(next.has(key)).toBe(false);
      }
    }
  });
});
