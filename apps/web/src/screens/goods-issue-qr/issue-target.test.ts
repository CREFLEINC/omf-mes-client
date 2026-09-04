import { describe, expect, it } from 'vitest';

import { canIssue, issueGuard } from './issue-target';

const base = {
  workerNo: '3391',
  selectedIds: ['1'],
  needsReason: false,
  reasonCode: '',
};

describe('issueGuard', () => {
  it('사번이 없으면 열지 않는다 — 서버가 거부한다', () => {
    expect(issueGuard({ ...base, workerNo: null })).toEqual({ kind: 'noWorker' });
  });

  it('고른 라인이 없으면 열지 않는다', () => {
    expect(issueGuard({ ...base, selectedIds: [] })).toEqual({ kind: 'noSelection' });
  });

  it('재발행인데 사유를 고르지 않았으면 열지 않는다', () => {
    expect(issueGuard({ ...base, needsReason: true })).toEqual({ kind: 'reasonRequired' });
  });

  it('재발행이고 사유를 골랐으면 연다', () => {
    expect(canIssue(issueGuard({ ...base, needsReason: true, reasonCode: 'ANY' }))).toBe(true);
  });

  it('최초 발행은 사유 없이 연다', () => {
    expect(canIssue(issueGuard(base))).toBe(true);
  });

  it('사번이 없는 것을 선택 없음보다 먼저 말한다 — 고르기 전에 막힌 이유가 그것이다', () => {
    expect(issueGuard({ ...base, workerNo: null, selectedIds: [] })).toEqual({ kind: 'noWorker' });
  });
});
