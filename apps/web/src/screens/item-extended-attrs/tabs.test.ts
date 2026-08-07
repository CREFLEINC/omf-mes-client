import { describe, expect, it } from 'vitest';

import {
  DEFAULT_SUBSIDIARY_TAB_ID,
  DEFAULT_TAB_ID,
  ITEM_EXTENDED_ATTRS_TABS,
  SUBSIDIARY_TABS,
  resolveSubsidiaryTab,
  resolveTab,
} from './tabs';

describe('탭 정의', () => {
  /*
   * **만든 탭만 넣는다.** 세 탭이 모두 내용을 갖췄으므로 이제 셋이 정본이다 —
   * 자리만 먼저 둔 탭은 「눌러도 빈 화면」이 되므로 이 배열이 그것을 막는 자리다.
   */
  it('지금 만든 탭만 들어 있다', () => {
    expect(ITEM_EXTENDED_ATTRS_TABS.map((tab) => tab.id)).toEqual(['attrs', 'sub', 'bom']);
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
    expect(resolveTab('sub').id).toBe('sub');
    expect(resolveTab('bom').id).toBe('bom');
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

/**
 * 부속 정보 안의 하위 탭. **바깥 탭과 같은 규칙을 쓴다** —
 * 층이 다르다고 해석 규칙을 달리하면 주소를 읽는 사람이 두 가지를 외워야 한다.
 */
describe('하위 탭 정의', () => {
  it('부속 자원 셋이 들어 있다', () => {
    expect(SUBSIDIARY_TABS.map((tab) => tab.id)).toEqual(['bu', 'uom', 'ext']);
  });

  it('하위 탭마다 라벨이 있다', () => {
    for (const tab of SUBSIDIARY_TABS) {
      expect(tab.label).not.toBe('');
    }
  });

  it('기본 하위 탭은 첫 하위 탭이다', () => {
    expect(DEFAULT_SUBSIDIARY_TAB_ID).toBe(SUBSIDIARY_TABS[0].id);
  });

  /* 바깥 탭과 하위 탭이 같은 값을 쓰면 어느 층의 값인지 주소만 보고 알 수 없다. */
  it('바깥 탭과 값이 겹치지 않는다', () => {
    const outer = new Set(ITEM_EXTENDED_ATTRS_TABS.map((tab) => String(tab.id)));

    for (const tab of SUBSIDIARY_TABS) {
      expect(outer.has(tab.id)).toBe(false);
    }
  });
});

describe('resolveSubsidiaryTab', () => {
  it('아는 값은 그 하위 탭이다', () => {
    expect(resolveSubsidiaryTab('uom').id).toBe('uom');
    expect(resolveSubsidiaryTab('ext').id).toBe('ext');
  });

  it('모르는 값·빈 값은 첫 하위 탭으로 떨어진다', () => {
    expect(resolveSubsidiaryTab('bogus').id).toBe(DEFAULT_SUBSIDIARY_TAB_ID);
    expect(resolveSubsidiaryTab('').id).toBe(DEFAULT_SUBSIDIARY_TAB_ID);
    expect(resolveSubsidiaryTab(null).id).toBe(DEFAULT_SUBSIDIARY_TAB_ID);
  });

  it('대소문자를 느슨하게 해석하지 않는다', () => {
    expect(resolveSubsidiaryTab('UOM').id).toBe(DEFAULT_SUBSIDIARY_TAB_ID);
  });
});
