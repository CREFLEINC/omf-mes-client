import { describe, expect, it } from 'vitest';

import { DEFAULT_TAB_ID, ITEM_DETAIL_TABS, ITEM_EXTENDED_ATTRS_TABS, resolveTab } from './tabs';

describe('탭 정의', () => {
  /* 품목 / BOM 은 셸 탭 막대가 가른다(주소가 다르다) — 품목 탭 오른쪽 구획에 BOM 을 섞지 않는다. */
  it('품목 세부 탭에는 BOM을 섞지 않는다', () => {
    expect(ITEM_DETAIL_TABS.map((tab) => tab.id)).toEqual(['attrs', 'uom', 'res']);
  });

  /*
   * **만든 탭만 넣는다.** 자리만 먼저 둔 탭은 「눌러도 빈 화면」이 되므로 이 배열이 그것을 막는 자리다.
   */
  it('지금 만든 탭만 들어 있다', () => {
    expect(ITEM_EXTENDED_ATTRS_TABS.map((tab) => tab.id)).toEqual(['attrs', 'uom', 'res']);
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
    expect(resolveTab('uom').id).toBe('uom');
    expect(resolveTab('res').id).toBe('res');
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
 * 확장 속성 · 단위 환산 · 설비·금형이 한 줄의 탭이다(사용자 지시 2026-11-24 — 「부속 정보」 탭 안의 하위 탭을 올림).
 */
describe('탭 순서', () => {
  it('확장 속성 · 단위 환산 · 설비·금형 순이다', () => {
    expect(ITEM_EXTENDED_ATTRS_TABS.map((tab) => tab.id)).toEqual(['attrs', 'uom', 'res']);
  });

  /* 없앤 「부속 정보」 탭의 옛 주소(`tab=sub`)는 첫 탭으로 떨어진다. */
  it('옛 부속 정보 탭 주소는 첫 탭으로 떨어진다', () => {
    expect(resolveTab('sub').id).toBe(DEFAULT_TAB_ID);
  });
});
