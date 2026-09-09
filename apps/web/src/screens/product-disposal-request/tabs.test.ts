import { describe, expect, it } from 'vitest';

import { DEFAULT_TAB, readTab, TAB_KEY, tabLabel, toTabParam } from './tabs';

describe('readTab — 주소가 가리키는 탭', () => {
  it('주소에 값이 없으면 기본 탭이다', () => {
    expect(readTab(new URLSearchParams())).toBe(DEFAULT_TAB);
  });

  it('아는 값이면 그 탭이다', () => {
    expect(readTab(new URLSearchParams({ [TAB_KEY]: 'history' }))).toBe('history');
  });

  /**
   * ⭐ **모르는 값은 기본 탭으로 본다.**
   *
   * 주소는 손으로 고쳐지는 자리이고, 오타 하나에 아무 탭도 서지 않는 화면을 내면 사용자는
   * 그것을 고장으로 읽는다.
   */
  it('모르는 값이면 기본 탭으로 본다', () => {
    expect(readTab(new URLSearchParams({ [TAB_KEY]: 'histry' }))).toBe(DEFAULT_TAB);
  });

  /** 대소문자를 맞춰 주지 않는다 — 주소가 두 가지로 갈리는 것보다 낫다. */
  it('대소문자가 다르면 아는 값으로 보지 않는다', () => {
    expect(readTab(new URLSearchParams({ [TAB_KEY]: 'History' }))).toBe(DEFAULT_TAB);
  });
});

describe('toTabParam — 주소에 적을 값', () => {
  /** ⭐ 기본 탭을 주소에 적으면 같은 화면의 주소가 두 가지가 된다. */
  it('기본 탭이면 적지 않는다', () => {
    expect(toTabParam(DEFAULT_TAB)).toBeNull();
  });

  it('기본이 아닌 탭이면 그 값을 적는다', () => {
    expect(toTabParam('history')).toBe('history');
  });

  /** 적은 값을 다시 읽으면 같은 탭이어야 한다 — 왕복이 어긋나면 새로고침에 탭이 튄다. */
  it('적은 값을 다시 읽으면 같은 탭이다', () => {
    const param = toTabParam('history');

    expect(param).not.toBeNull();
    expect(readTab(new URLSearchParams({ [TAB_KEY]: param ?? '' }))).toBe('history');
  });
});

describe('tabLabel — 탭 이름', () => {
  it('두 탭이 서로 다른 이름을 갖는다', () => {
    expect(tabLabel('request')).not.toBe(tabLabel('history'));
    expect(tabLabel('request').trim()).not.toBe('');
    expect(tabLabel('history').trim()).not.toBe('');
  });
});
