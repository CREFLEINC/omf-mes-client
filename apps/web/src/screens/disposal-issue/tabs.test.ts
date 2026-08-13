import { messages } from '@omf-mes/i18n';
import { describe, expect, it } from 'vitest';

import { DEFAULT_TAB, DISPOSAL_ISSUE_TABS, readTab, tabLabel, toTabParam } from './tabs';

const t = messages.disposalIssue;

const params = (search: string): URLSearchParams => new URLSearchParams(search);

describe('탭 정의', () => {
  it('탭이 둘이고 차례가 업무 차례다', () => {
    expect(DISPOSAL_ISSUE_TABS).toEqual(['disposal', 'history']);
  });

  /* 화면에 들어오는 이유가 「폐기 품의를 올린다」라서 발의 탭이 먼저 선다. */
  it('기본 탭은 품의 발의다', () => {
    expect(DEFAULT_TAB).toBe('disposal');
  });

  it('탭 이름이 스펙 문면 그대로다', () => {
    expect(tabLabel('disposal')).toBe('품의 발의');
    expect(tabLabel('history')).toBe('처리 이력');
    /* 짝 방향 — 두 이름이 서로 다르다(같으면 어느 탭인지 읽을 수 없다). */
    expect(tabLabel('disposal')).not.toBe(tabLabel('history'));
  });

  it('탭 이름을 문구 묶음이 소유한다', () => {
    expect(tabLabel('disposal')).toBe(t.tabs.disposal);
    expect(tabLabel('history')).toBe(t.tabs.history);
  });
});

describe('readTab — 주소가 가리키는 탭', () => {
  it('주소의 값을 그대로 읽는다', () => {
    expect(readTab(params('tab=history'))).toBe('history');
    expect(readTab(params('tab=disposal'))).toBe('disposal');
  });

  /* 주소는 사람이 손으로 고치는 자리다 — 모르는 값에 빈 화면을 내지 않는다. */
  it('모르는 값·빈 값·없음은 기본 탭으로 본다', () => {
    expect(readTab(params('tab=엉뚱한값'))).toBe(DEFAULT_TAB);
    expect(readTab(params('tab='))).toBe(DEFAULT_TAB);
    expect(readTab(params(''))).toBe(DEFAULT_TAB);
    /* 대소문자가 다른 값도 모르는 값이다 — 주소 키는 우리가 정한 그대로만 받는다. */
    expect(readTab(params('tab=HISTORY'))).toBe(DEFAULT_TAB);
  });

  it('다른 조건이 함께 있어도 탭만 읽는다', () => {
    expect(readTab(params('wh=9701&tab=history&page=3'))).toBe('history');
  });
});

describe('toTabParam — 주소에 적을 값', () => {
  /* 기본값을 주소에 적으면 같은 화면의 주소가 두 가지가 된다. */
  it('기본 탭은 주소에 적지 않는다', () => {
    expect(toTabParam('disposal')).toBeNull();
  });

  it('기본이 아닌 탭은 그 값을 적는다', () => {
    expect(toTabParam('history')).toBe('history');
  });

  /* 왕복이 성립해야 새로고침·공유가 같은 탭을 연다. */
  it('적은 값을 다시 읽으면 같은 탭이다', () => {
    for (const tab of DISPOSAL_ISSUE_TABS) {
      const raw = toTabParam(tab);
      const search = raw === null ? '' : `tab=${raw}`;

      expect(readTab(params(search))).toBe(tab);
    }
  });
});
