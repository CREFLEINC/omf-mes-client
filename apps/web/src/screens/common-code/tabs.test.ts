import { describe, expect, it } from 'vitest';

import { COMMON_CODE_TABS, resolveTab, tabSearchParams } from './tabs';

describe('COMMON_CODE_TABS', () => {
  it('탭 정의 배열이 정본이다 — 만든 탭만 들어 있다', () => {
    expect(COMMON_CODE_TABS.map((tab) => tab.id)).toEqual(['code']);
  });

  it('탭마다 서로 다른 주소값을 갖는다', () => {
    const ids = COMMON_CODE_TABS.map((tab) => tab.id);

    expect(new Set(ids).size).toBe(COMMON_CODE_TABS.length);
  });

  it('탭마다 라벨이 있고 비어 있지 않다', () => {
    for (const tab of COMMON_CODE_TABS) {
      expect(tab.label).not.toBe('');
    }
  });
});

describe('resolveTab', () => {
  it('아는 값이면 그 탭을 낸다', () => {
    for (const tab of COMMON_CODE_TABS) {
      expect(resolveTab(tab.id)).toBe(tab);
    }
  });

  it('값이 없으면 첫 탭으로 떨어진다', () => {
    expect(resolveTab(null)).toBe(COMMON_CODE_TABS[0]);
  });

  it('모르는 값·빈 값이면 첫 탭으로 떨어진다 — 주소 조작으로 빈 화면이 되지 않는다', () => {
    expect(resolveTab('xyz')).toBe(COMMON_CODE_TABS[0]);
    expect(resolveTab('')).toBe(COMMON_CODE_TABS[0]);
    // 아직 만들지 않은 탭의 주소값도 모르는 값이다.
    expect(resolveTab('org')).toBe(COMMON_CODE_TABS[0]);
    expect(resolveTab('worker')).toBe(COMMON_CODE_TABS[0]);
  });

  it('대소문자가 다르면 모르는 값이다 — 주소값을 느슨하게 해석하지 않는다', () => {
    expect(resolveTab('CODE')).toBe(COMMON_CODE_TABS[0]);
  });
});

describe('tabSearchParams', () => {
  it('탭 값만 남는다 — 이전 탭의 조건·선택을 하나도 넘기지 않는다', () => {
    const next = tabSearchParams('org');

    expect(next.get('tab')).toBe('org');
    expect([...next.keys()]).toEqual(['tab']);
  });

  it('어떤 탭이든 결과에 조건·선택 키가 없다', () => {
    for (const tab of COMMON_CODE_TABS) {
      const next = tabSearchParams(tab.id);

      for (const key of ['q', 'inactive', 'page', 'grp', 'val', 'vpage', 'vinactive', 'new']) {
        expect(next.has(key)).toBe(false);
      }
    }
  });
});
