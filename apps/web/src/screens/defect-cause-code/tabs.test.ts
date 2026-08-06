import { describe, expect, it } from 'vitest';

import { CODE_TABS, resolveTab } from './tabs';

describe('CODE_TABS', () => {
  it('탭 정의 배열이 정본이다 — 항목을 더하면 탭이 늘어난다', () => {
    expect(CODE_TABS.length).toBeGreaterThanOrEqual(2);
  });

  it('탭마다 서로 다른 어댑터와 캐시 키를 갖는다 — 한쪽 목록이 다른 탭에 남지 않는다', () => {
    const kinds = CODE_TABS.map((tab) => tab.kind);
    const cacheRoots = CODE_TABS.map((tab) => JSON.stringify(tab.adapter.keys.all));

    expect(new Set(kinds).size).toBe(CODE_TABS.length);
    expect(new Set(cacheRoots).size).toBe(CODE_TABS.length);
  });

  it('탭 정의의 kind와 어댑터의 kind가 같다', () => {
    for (const tab of CODE_TABS) {
      expect(tab.kind).toBe(tab.adapter.kind);
    }
  });

  it('탭마다 라벨이 있고 비어 있지 않다', () => {
    for (const tab of CODE_TABS) {
      expect(tab.adapter.labels.tab).not.toBe('');
    }
  });
});

describe('resolveTab', () => {
  it('아는 값이면 그 탭을 낸다', () => {
    for (const tab of CODE_TABS) {
      expect(resolveTab(tab.kind)).toBe(tab);
    }
  });

  it('값이 없으면 첫 탭으로 떨어진다', () => {
    expect(resolveTab(null)).toBe(CODE_TABS[0]);
  });

  it('모르는 값이면 첫 탭으로 떨어진다 — 주소 조작으로 빈 화면이 되지 않는다', () => {
    expect(resolveTab('xyz')).toBe(CODE_TABS[0]);
    expect(resolveTab('')).toBe(CODE_TABS[0]);
  });
});
