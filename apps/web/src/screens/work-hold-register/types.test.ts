import { describe, expect, it } from 'vitest';

import { isOpenSession, toWorkSessionEventView, toWorkSessionView } from './types';
import { sessionEvent, workSession } from './fixtures';

describe('세션 열림 판정', () => {
  it('끝 시각이 없으면 열려 있다', () => {
    expect(isOpenSession({ endedAt: null })).toBe(true);
  });

  it('끝 시각이 있으면 닫혀 있다 — 상태 코드를 보지 않는다', () => {
    expect(isOpenSession({ endedAt: '2026-09-02T17:00:00+09:00' })).toBe(false);
  });

  it('응답에서 끝 시각 칸이 통째로 빠져 와도 열린 것으로 접힌다', () => {
    const view = toWorkSessionView(workSession());

    expect(view.endedAt).toBeNull();
    expect(isOpenSession(view)).toBe(true);
  });
});

describe('세션 사건 옮기기', () => {
  it('사유가 없는 사건은 코드도 이름도 비운다 — 재개·종료가 그렇다', () => {
    const view = toWorkSessionEventView(sessionEvent({ eventTypeCode: 'RESUME' }));

    expect(view.reasonCode).toBeNull();
    expect(view.reasonName).toBeNull();
  });

  it('서버가 준 사유 표시명을 그대로 싣는다', () => {
    const view = toWorkSessionEventView(
      sessionEvent({ eventTypeCode: 'STOP', reasonCode: 'MOLD_CHANGE', reasonName: '금형 교체' }),
    );

    expect(view.reasonName).toBe('금형 교체');
  });
});
