import { describe, expect, it } from 'vitest';

import { notificationFixture } from './fixtures';
import { EMPTY_READ_STATE, isRead, withRead } from './read-state';
import { toNotificationView } from './types';

const viewOf = (overrides: Parameters<typeof notificationFixture>[0] = {}) =>
  toNotificationView(notificationFixture(overrides));

describe('withRead', () => {
  it('번호를 읽음으로 더한다', () => {
    expect(withRead(EMPTY_READ_STATE, 7101).ids.has(7101)).toBe(true);
  });

  it('받은 값을 바꾸지 않는다 — 부르는 쪽이 든 값이 몰래 달라지면 안 된다', () => {
    const before = withRead(EMPTY_READ_STATE, 7101);

    withRead(before, 7102);

    expect(before.ids.has(7102)).toBe(false);
    expect(EMPTY_READ_STATE.ids.size).toBe(0);
  });

  it('여럿을 연달아 더할 수 있다', () => {
    const state = withRead(withRead(EMPTY_READ_STATE, 7101), 7102);

    expect(state.ids.has(7101)).toBe(true);
    expect(state.ids.has(7102)).toBe(true);
  });

  /**
   * ⭐ **이미 들어 있으면 같은 참조를 그대로 돌려준다.** 새 값을 만들면 내용이 같은데도 화면이
   * 다시 그려지고, 그 렌더가 다시 이 함수를 부르는 자리가 생기면 멈추지 않는다.
   */
  it('이미 있는 번호는 같은 값을 그대로 돌려준다', () => {
    const state = withRead(EMPTY_READ_STATE, 7101);

    expect(withRead(state, 7101)).toBe(state);
  });
});

describe('isRead', () => {
  it('서버가 읽음이라 하면 읽음이다', () => {
    expect(isRead(viewOf({ read: true }), EMPTY_READ_STATE)).toBe(true);
  });

  it('서버가 안 읽음이고 집합에도 없으면 안 읽음이다', () => {
    expect(isRead(viewOf({ read: false }), EMPTY_READ_STATE)).toBe(false);
  });

  /** ⭐ 이 한 줄이 「목록을 다시 부르지 않고 표시만 바꾼다」를 성립시킨다. */
  it('이 회차에 읽음 처리했으면 서버 값이 아직 안 읽음이어도 읽음이다', () => {
    expect(isRead(viewOf({ read: false }), withRead(EMPTY_READ_STATE, 7101))).toBe(true);
  });

  it('다른 번호를 읽었다고 이 알림이 읽음이 되지는 않는다', () => {
    expect(isRead(viewOf({ read: false }), withRead(EMPTY_READ_STATE, 7102))).toBe(false);
  });

  it('빈 집합은 서버 값을 그대로 통과시킨다', () => {
    expect(isRead(viewOf({ read: true }), EMPTY_READ_STATE)).toBe(true);
    expect(isRead(viewOf({ read: false }), EMPTY_READ_STATE)).toBe(false);
  });
});
