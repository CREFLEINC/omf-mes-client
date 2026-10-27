import { afterEach, describe, expect, it } from 'vitest';

import { ISSUE_UNIT_STORAGE_KEY, rememberIssueUnit, storedIssueUnit } from './issue-unit';

afterEach(() => {
  try {
    globalThis.localStorage.removeItem(ISSUE_UNIT_STORAGE_KEY);
  } catch {
    /* 저장소가 없는 시험 환경 — 지울 것도 없다. */
  }
});

describe('발행 단위 — 단말이 기억한다', () => {
  it('처음에는 「전체」(멈추지 않음)다', () => {
    expect(storedIssueUnit()).toBeNull();
  });

  it('고른 단위를 다음에도 쓰고, 「전체」를 고르면 기억을 지운다', () => {
    rememberIssueUnit(20);
    expect(storedIssueUnit()).toBe(20);

    rememberIssueUnit(null);
    expect(storedIssueUnit()).toBeNull();
    expect(globalThis.localStorage.getItem(ISSUE_UNIT_STORAGE_KEY)).toBeNull();
  });

  it('고를 수 없는 값이 남아 있으면 「전체」로 본다', () => {
    globalThis.localStorage.setItem(ISSUE_UNIT_STORAGE_KEY, '7');
    expect(storedIssueUnit()).toBeNull();

    globalThis.localStorage.setItem(ISSUE_UNIT_STORAGE_KEY, 'abc');
    expect(storedIssueUnit()).toBeNull();
  });
});
