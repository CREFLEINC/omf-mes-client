import { messages } from '@omf-mes/i18n';
import { describe, expect, it } from 'vitest';

import {
  DEFAULT_TAB,
  INBOX_TABS,
  canSeeAllRequests,
  readTab,
  tabLabel,
  toTabScopeQuery,
  visibleTabs,
} from './tabs';

const t = messages.approvalInbox;

describe('탭 정의', () => {
  it('기본 탭은 「내 결재 대기」다', () => {
    expect(DEFAULT_TAB).toBe('pending');
  });

  it('탭 이름이 서로 다르다', () => {
    const labels = INBOX_TABS.map(tabLabel);

    expect(new Set(labels).size).toBe(INBOX_TABS.length);
    expect(tabLabel('pending')).toBe(t.tabs.pending);
    expect(tabLabel('requested')).toBe(t.tabs.requested);
    expect(tabLabel('all')).toBe(t.tabs.all);
  });
});

describe('toTabScopeQuery', () => {
  it('「내 결재 대기」는 계약이 그 탭이라고 적은 조합을 그대로 싣는다', () => {
    expect(toTabScopeQuery('pending')).toEqual({ assignedToMe: true, pendingOnly: true });
  });

  it('「내가 올린 것」은 상신자 축으로만 좁힌다', () => {
    expect(toTabScopeQuery('requested')).toEqual({ requestedByMe: true });
  });

  it('「전체」는 조건을 싣지 않는다 — 생략이 곧 「거르지 않음」이다', () => {
    expect(toTabScopeQuery('all')).toEqual({});
  });

  it('세 탭의 쿼리가 서로 다르다 — 같으면 탭이 이름만 다른 것이 된다', () => {
    const queries = INBOX_TABS.map((tab) => JSON.stringify(toTabScopeQuery(tab)));

    expect(new Set(queries).size).toBe(INBOX_TABS.length);
  });

  it('탭마다 자기 축만 싣는다 — 남의 축을 함께 싣지 않는다', () => {
    expect(toTabScopeQuery('pending').requestedByMe).toBeUndefined();
    expect(toTabScopeQuery('requested').assignedToMe).toBeUndefined();
    expect(toTabScopeQuery('requested').pendingOnly).toBeUndefined();
  });

  it('대기 건수의 조건(myTurnOnly)을 탭이 싣지 않는다 — 건수는 전용 조회가 갖는다', () => {
    for (const tab of INBOX_TABS) {
      expect(Object.keys(toTabScopeQuery(tab))).not.toContain('myTurnOnly');
    }
  });
});

describe('visibleTabs — 「전체」 탭 권한 자리표시', () => {
  it('지금은 「전체」 탭을 그리지 않는다', () => {
    expect(canSeeAllRequests).toBe(false);
    expect(visibleTabs(canSeeAllRequests)).toEqual(['pending', 'requested']);
  });

  it('권한 판정이 생기면 「전체」 탭이 선다 — 자리표시가 죽은 가지가 아니다', () => {
    expect(visibleTabs(true)).toEqual(['pending', 'requested', 'all']);
  });

  it('권한이 생겨도 탭 차례는 바뀌지 않는다', () => {
    expect(visibleTabs(true).slice(0, 2)).toEqual(visibleTabs(false));
  });
});

describe('readTab', () => {
  it('주소에 없으면 기본 탭이다', () => {
    expect(readTab(null, false)).toBe(DEFAULT_TAB);
  });

  it('모르는 값은 기본 탭으로 본다 — 주소는 손으로 고쳐지는 자리다', () => {
    expect(readTab('엉뚱한값', false)).toBe(DEFAULT_TAB);
    expect(readTab('', false)).toBe(DEFAULT_TAB);
  });

  it('아는 값은 그대로 읽는다', () => {
    expect(readTab('pending', false)).toBe('pending');
    expect(readTab('requested', false)).toBe('requested');
  });

  it('권한이 없으면 주소로 「전체」를 가리켜도 기본 탭이다', () => {
    /* 탭이 서지 않는데 쿼리만 조건 없이 나가는 자리를 막는다. */
    expect(readTab('all', false)).toBe(DEFAULT_TAB);
  });

  it('권한이 생기면 주소의 「전체」가 살아난다', () => {
    expect(readTab('all', true)).toBe('all');
  });
});
