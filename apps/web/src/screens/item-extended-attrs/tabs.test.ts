import { describe, expect, it } from 'vitest';

import { DEFAULT_TAB_ID, ITEM_EXTENDED_ATTRS_TABS, resolveTab } from './tabs';

describe('탭 정의', () => {
  /*
   * **만든 탭만 넣는다.** 부속 정보·자재 명세서 탭은 그 내용이 생길 때 붙는다 —
   * 자리만 먼저 두면 「탭은 있는데 눌러도 빈 화면인」 상태가 된다.
   */
  it('지금 만든 탭만 들어 있다', () => {
    expect(ITEM_EXTENDED_ATTRS_TABS.map((tab) => tab.id)).toEqual(['attrs']);
  });

  it('탭마다 라벨이 있다', () => {
    for (const tab of ITEM_EXTENDED_ATTRS_TABS) {
      expect(tab.label).not.toBe('');
    }
  });

  it('기본 탭은 첫 탭이다', () => {
    expect(DEFAULT_TAB_ID).toBe(ITEM_EXTENDED_ATTRS_TABS[0].id);
  });
});

describe('resolveTab', () => {
  it('아는 값은 그 탭이다', () => {
    expect(resolveTab('attrs').id).toBe('attrs');
  });

  /* 주소를 손으로 고쳐도 빈 화면이 되지 않아야 한다. */
  it('모르는 값·빈 값은 첫 탭으로 떨어진다', () => {
    expect(resolveTab('bogus').id).toBe(DEFAULT_TAB_ID);
    expect(resolveTab('').id).toBe(DEFAULT_TAB_ID);
    expect(resolveTab(null).id).toBe(DEFAULT_TAB_ID);
  });

  /* 주소값은 내부 식별자다. 느슨하게 받으면 「어떤 표기가 정본인가」가 흐려진다. */
  it('대소문자를 느슨하게 해석하지 않는다', () => {
    expect(resolveTab('ATTRS').id).toBe(DEFAULT_TAB_ID);
  });
});
