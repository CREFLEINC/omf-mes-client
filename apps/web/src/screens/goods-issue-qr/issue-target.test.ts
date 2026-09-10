import { describe, expect, it } from 'vitest';

import { canIssue, issueGuard } from './issue-target';
import { ISSUE_UNIT } from './types';

const base = {
  workerNo: '3391',
  unit: ISSUE_UNIT.line,
  selectedIds: ['1'],
  palletId: null,
  palletContentCount: null,
  palletContentsPending: false,
  needsReason: false,
  reasonCode: '',
};

/** 파렛트 단위의 갖춰진 상태 — 라인 하나 · 파렛트 하나 · 담긴 것 있음. */
const pallet = {
  ...base,
  unit: ISSUE_UNIT.pallet,
  palletId: 7001,
  palletContentCount: 3,
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

/**
 * 파렛트 단위(스펙 §5-2 · §6). **라인 단위에는 없던 세 갈래**가 여기서만 선다.
 *
 * ⛔ 「담긴 것을 아직 모른다」를 「비었다」로 접으면 조회가 늦은 것뿐인데 발행이 막힌다 —
 * 그 상태가 굳으면 사용자는 무엇을 해도 풀리지 않는 버튼을 본다.
 */
describe('issueGuard — 파렛트 단위', () => {
  it('라인을 둘 이상 고르면 열지 않는다 — 어느 LOT 으로 좁힐지 화면이 정하지 않는다', () => {
    expect(issueGuard({ ...pallet, selectedIds: ['1', '2'] })).toEqual({
      kind: 'palletNeedsOneLine',
    });
  });

  it('파렛트를 고르지 않았으면 열지 않는다', () => {
    expect(issueGuard({ ...pallet, palletId: null })).toEqual({ kind: 'noPallet' });
  });

  it('빈 파렛트는 열지 않는다 — 찍을 것이 없다', () => {
    expect(issueGuard({ ...pallet, palletContentCount: 0 })).toEqual({ kind: 'emptyPallet' });
  });

  it('담긴 내용을 «묻는 중»에는 열지 않는다 — 빈 파렛트 차단이 아직 서지 않았다', () => {
    expect(
      issueGuard({ ...pallet, palletContentCount: null, palletContentsPending: true }),
    ).toEqual({ kind: 'palletContentsPending' });
  });

  it('묻기가 끝났는데도 알 수 없으면 막지 않는다 — 조회 실패로 발행을 잠그지 않는다', () => {
    expect(
      canIssue(issueGuard({ ...pallet, palletContentCount: null, palletContentsPending: false })),
    ).toBe(true);
  });

  it('갖춰졌으면 연다', () => {
    expect(canIssue(issueGuard(pallet))).toBe(true);
  });

  it('파렛트 재발행도 사유를 요구한다', () => {
    expect(issueGuard({ ...pallet, needsReason: true })).toEqual({ kind: 'reasonRequired' });
  });

  it('라인 단위에서는 파렛트 조건을 보지 않는다', () => {
    expect(
      canIssue(
        issueGuard({
          ...base,
          selectedIds: ['1', '2'],
          palletContentCount: 0,
          palletContentsPending: true,
        }),
      ),
    ).toBe(true);
  });
});
