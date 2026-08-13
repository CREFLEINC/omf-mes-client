import { messages } from '@omf-mes/i18n';
import { describe, expect, it } from 'vitest';

import {
  APPROVED_APPROVAL_STATUS_CODES,
  hasPostedLine,
  isApprovalJudgePending,
  isApproved,
  isLinePosted,
  readSubmission,
  REJECTION_DECISION_CODES,
  toRequestProgressView,
  toStepProgressViews,
} from './approval-progress';
import {
  approvalRequestDetailFixture,
  contradictoryApprovalDetailFixture,
  goodsIssueLineFixtures,
  SAMPLE_APPROVED_STATUS,
  SAMPLE_REJECTION_DECISION,
} from './fixtures';
import type { ApprovalStepResponse, IssueLineView } from './types';

const t = messages.disposalIssue;

const step = (overrides: Partial<ApprovalStepResponse> = {}): ApprovalStepResponse => ({
  stepNo: 1,
  approverId: 9551,
  approverName: '합성 승인자 가',
  decisionCode: null,
  decisionAt: null,
  decisionComment: null,
  isMine: false,
  isCurrent: false,
  ...overrides,
});

const line = (overrides: Partial<IssueLineView> = {}): IssueLineView =>
  ({
    ...goodsIssueLineFixtures[0],
    ...overrides,
  }) as IssueLineView;

describe('자리표시 — 지금은 비어 있다', () => {
  /*
   * **비어 있는 것이 지금의 사실이다.** 값을 하나 넣어 두면 화면이 「승인됐다」·「반려됐다」를
   * 지어내고, 그 짐작이 사용자에게는 사실로 보인다.
   */
  it('승인 완료·반려 코드 집합이 비어 있다', () => {
    expect(APPROVED_APPROVAL_STATUS_CODES).toEqual([]);
    expect(REJECTION_DECISION_CODES).toEqual([]);
  });

  it('비어 있으면 승인 판정을 할 수 없다고 말한다', () => {
    expect(isApprovalJudgePending([])).toBe(true);
    /* 짝 방향 — 채우면 판정할 수 있다고 말한다(전환 감지기). */
    expect(isApprovalJudgePending([SAMPLE_APPROVED_STATUS])).toBe(false);
  });

  it('자리표시가 비어 있는 동안 어떤 상태 코드도 승인으로 읽히지 않는다', () => {
    expect(isApproved(SAMPLE_APPROVED_STATUS, [])).toBe(false);
    expect(isApproved('SAMPLE_AP_STATUS_B', [])).toBe(false);
  });

  /* 전환 감지기 — 채우면 그 코드만 승인으로 읽힌다. */
  it('자리표시를 채우면 그 코드만 승인이 된다', () => {
    expect(isApproved(SAMPLE_APPROVED_STATUS, [SAMPLE_APPROVED_STATUS])).toBe(true);
    expect(isApproved('SAMPLE_AP_STATUS_B', [SAMPLE_APPROVED_STATUS])).toBe(false);
  });
});

describe('readSubmission — 상신 여부 세 갈래', () => {
  /* A0 — 값이 없으면 아직 상신되지 않은 것이다(계획 결정 7). */
  it('값이 없으면 미상신이다', () => {
    expect(readSubmission(null)).toEqual({ kind: 'notSubmitted' });
    expect(readSubmission(undefined)).toEqual({ kind: 'notSubmitted' });
  });

  it('값이 있으면 그 값을 그대로 나른다', () => {
    expect(readSubmission(9521)).toEqual({ kind: 'submitted', approvalRequestId: 9521 });
  });

  /*
   * **0·음수·소수를 미상신으로 접지 않는다.** 값이 실려 왔다는 것은 상신이 있었을 수 있다는
   * 뜻이라 「아직 상신되지 않았습니다」는 거짓이 된다. 동시에 **그 값으로 부르지도 않는다** —
   * `/app/approval-requests/0`은 남의 요청을 열거나 헛도는 요청이다.
   */
  it('조회 조각으로 쓸 수 없는 값은 미상신도 상신도 아니다', () => {
    expect(readSubmission(0)).toEqual({ kind: 'unusable' });
    expect(readSubmission(-1)).toEqual({ kind: 'unusable' });
    expect(readSubmission(1.5)).toEqual({ kind: 'unusable' });
    expect(readSubmission(Number.NaN)).toEqual({ kind: 'unusable' });
  });

  /*
   * **값을 가공하지 않는다**(계획 결정 10). 서버가 준 식별자를 그대로 경로 조각으로 옮겨야
   * 「그 전표의 그 품의」를 가리킨다.
   */
  it('값을 바꾸지 않는다', () => {
    const submission = readSubmission(9521);

    expect(submission.kind === 'submitted' ? submission.approvalRequestId : null).toBe(9521);
  });
});

describe('전기 여부 — 원장 라인 유무로만 갈린다', () => {
  /*
   * **상태 코드로 판정하지 않는다.** 목이 전기 뒤에도 초안 상태를 그대로 주는 것이 실측됐고,
   * 값 목록이 확정되지 않아 어떤 코드가 「전기됨」인지 화면이 알 근거도 없다.
   */
  it('원장 라인이 있으면 전기된 줄이다', () => {
    expect(isLinePosted(line({ inventoryTransactionLineId: 9531 }))).toBe(true);
    expect(isLinePosted(line({ inventoryTransactionLineId: null }))).toBe(false);
  });

  it('한 줄이라도 전기됐으면 그 전표는 전기가 시작된 것이다', () => {
    expect(hasPostedLine(goodsIssueLineFixtures)).toBe(true);
    expect(
      hasPostedLine(
        goodsIssueLineFixtures.map((row) => ({ ...row, inventoryTransactionLineId: null })),
      ),
    ).toBe(false);
  });

  /* 라인이 없는 전표를 「전기됐다」로 읽지 않는다 — 아무 근거가 없다. */
  it('라인이 없으면 전기되지 않은 것으로 본다', () => {
    expect(hasPostedLine([])).toBe(false);
  });
});

describe('toStepProgressViews — 단계 배열을 그릴 값으로', () => {
  it('차례를 바꾸지 않는다', () => {
    const views = toStepProgressViews([step({ stepNo: 2 }), step({ stepNo: 1 })], []);

    expect(views.map((view) => view.stepNo)).toEqual([2, 1]);
  });

  /*
   * **서버가 매긴 단계 번호를 그대로 쓴다.** 배열 인덱스+1로 다시 매기면 응답의 번호와 갈리고,
   * 갈리는 순간 사용자는 어느 단계가 진행 중인지 잘못 읽는다.
   */
  it('단계 번호를 다시 매기지 않는다', () => {
    const views = toStepProgressViews([step({ stepNo: 7 })], []);

    expect(views[0]?.stepNo).toBe(7);
  });

  it('결재 기록이 없으면 차례인가로 갈린다', () => {
    expect(toStepProgressViews([step({ isCurrent: true })], [])[0]?.status).toBe('current');
    expect(toStepProgressViews([step({ isCurrent: false })], [])[0]?.status).toBe('pending');
  });

  /*
   * **결재 기록이 있으면 `isCurrent`가 참이어도 완료다.** 두 값이 어긋나는 응답이 실재하고
   * (목 실측), 그때 「진행 중」으로 그리면 사용자가 이미 끝난 단계를 기다린다.
   */
  it('결재 기록이 있으면 차례 표시보다 그것이 앞선다', () => {
    const views = toStepProgressViews(
      [step({ decisionCode: 'SAMPLE_DECISION_A', isCurrent: true })],
      [],
    );

    expect(views[0]?.status).toBe('complete');
  });

  it('반려 자리표시가 비어 있는 동안 어떤 코드도 반려가 되지 않는다', () => {
    const views = toStepProgressViews([step({ decisionCode: SAMPLE_REJECTION_DECISION })], []);

    expect(views[0]?.status).toBe('complete');
  });

  /* 전환 감지기 — 채우면 그 코드의 단계가 반려로 그려진다. */
  it('반려 자리표시를 채우면 그 코드가 반려가 된다', () => {
    const views = toStepProgressViews(
      [step({ decisionCode: SAMPLE_REJECTION_DECISION })],
      [SAMPLE_REJECTION_DECISION],
    );

    expect(views[0]?.status).toBe('rejected');
  });

  it('결재 결과 코드를 그대로 낸다', () => {
    const views = toStepProgressViews([step({ decisionCode: 'SAMPLE_DECISION_A' })], []);

    expect(views[0]?.decisionCode).toBe('SAMPLE_DECISION_A');
  });

  /* 계약이 선택으로 둔 값은 널·없음·빈 문자열이 모두 「없음」이다. */
  it('빈 문자열로 온 값은 없음으로 읽는다', () => {
    const views = toStepProgressViews(
      [step({ decisionCode: '', decisionAt: '', decisionComment: '' })],
      [],
    );

    expect(views[0]?.decisionCode).toBeNull();
    expect(views[0]?.decisionAtText).toBeNull();
    expect(views[0]?.decisionComment).toBeNull();
  });

  it('결재 시각을 읽을 수 있는 표기로 낸다', () => {
    const views = toStepProgressViews([step({ decisionAt: '2026-08-08T15:02:00+09:00' })], []);

    expect(views[0]?.decisionAtText).toBe('2026-08-08 15:02');
  });

  /* 이름을 못 풀면 **번호를 대신 내지 않는다**(`omf-mes#44`). */
  it('승인자 이름이 비면 그 사실을 적고 번호를 내지 않는다', () => {
    const views = toStepProgressViews([step({ approverName: '  ', approverId: 9552 })], []);

    expect(views[0]?.approverLabel).toBe(t.values.unknownApprover);
    expect(views[0]?.approverLabel).not.toContain('9552');
  });

  /**
   * 디자인 시스템은 상태 낱말을 **스크린리더 전용**으로만 낸다 — 보이는 글자는 이 자리가 맡는다.
   * 결재된 단계는 결과 코드가 그 자리를 맡으므로 대기 글자가 없다.
   */
  it('결재 전 단계에만 대기 글자가 붙는다', () => {
    expect(toStepProgressViews([step({ isCurrent: true })], [])[0]?.waitingText).toBe(
      t.progress.waitingCurrent,
    );
    expect(toStepProgressViews([step({ isCurrent: false })], [])[0]?.waitingText).toBe(
      t.progress.waitingPending,
    );
    expect(
      toStepProgressViews([step({ decisionCode: 'SAMPLE_DECISION_A' })], [])[0]?.waitingText,
    ).toBeNull();
  });

  /**
   * **이 화면은 결재하지 않는다.** 결재함이 쓰는 「내 단계」 표기를 나르면 이 화면이 결재함처럼
   * 읽히고, 사용자는 있지도 않은 승인 버튼을 찾는다.
   */
  it('내 단계 표식을 나르지 않는다', () => {
    const view: Record<string, unknown> = {
      ...toStepProgressViews([step({ isMine: true })], [])[0],
    };

    expect(view).not.toHaveProperty('isMine');
  });
});

describe('toRequestProgressView — 구획이 그리는 것 전부', () => {
  const view = toRequestProgressView(approvalRequestDetailFixture, []);

  it('요청번호·유형·상태를 서버 값 그대로 낸다', () => {
    expect(view.requestNo).toBe('AP-2026-800001');
    expect(view.approvalTypeCode).toBe('SAMPLE_AP_TYPE_A');
    expect(view.statusCode).toBe('SAMPLE_AP_STATUS_A');
  });

  it('상신자와 상신일을 낸다', () => {
    expect(view.requesterLabel).toBe('합성 상신자 가');
    expect(view.requestedAtText).toBe('2026-08-08 14:35');
  });

  /* 사유는 **전문**이고 줄바꿈이 유지된다 — 첫 줄만 내는 것은 목록의 일이다. */
  it('사유 전문을 줄 단위로 낸다', () => {
    expect(view.reasonLines).toEqual(['합성 폐기 사유 첫 줄', '', '둘째 문단 — 근거를 적는 자리']);
  });

  /**
   * **위치는 서버가 준 두 수 그대로다.** 배열을 훑어 다시 세면 모순 응답에서 서버와 갈리고,
   * 갈리는 순간 화면이 서버가 말하지 않은 것을 말하게 된다.
   */
  it('위치를 서버가 준 두 수로 말한다', () => {
    expect(view.positionText).toBe(t.progress.position(4, 4));
  });

  it('모순되는 응답에서도 서버 값을 따른다', () => {
    const contradictory = toRequestProgressView(contradictoryApprovalDetailFixture, []);

    expect(contradictory.positionText).toBe(t.progress.position(3, 3));
    /* 짝 방향 — 배열을 세어 만든 값(1 / 1)이 아니다. */
    expect(contradictory.positionText).not.toBe(t.progress.position(1, 1));
  });

  it('종료된 요청은 그 사실을 말한다', () => {
    const finished = toRequestProgressView(
      {
        ...approvalRequestDetailFixture,
        request: { ...approvalRequestDetailFixture.request, currentStepNo: null },
      },
      [],
    );

    expect(finished.positionText).toBe(t.progress.finished(4));
  });

  /**
   * **「결재가 끝났다」를 「승인됐다」로 읽지 않는다.** 반려로 끝난 요청도 `currentStepNo`가
   * 비므로, 그것으로 승인을 판정하면 반려된 품의가 처리 가능한 것처럼 보인다.
   */
  it('종료 여부로 승인을 판정하지 않는다', () => {
    const finished = toRequestProgressView(
      {
        ...approvalRequestDetailFixture,
        request: { ...approvalRequestDetailFixture.request, currentStepNo: null },
      },
      [],
    );

    expect(finished.isApproved).toBe(false);
  });

  /* 전환 감지기 — 자리표시가 채워지면 그 상태의 요청이 승인으로 읽힌다. */
  it('승인 자리표시를 채우면 그 요청이 승인으로 읽힌다', () => {
    expect(view.isApproved).toBe(false);
    expect(
      toRequestProgressView(approvalRequestDetailFixture, [], [SAMPLE_APPROVED_STATUS]).isApproved,
    ).toBe(true);
  });

  it('결재하는 화면의 표기를 나르지 않는다', () => {
    const plain: Record<string, unknown> = { ...view };

    expect(plain).not.toHaveProperty('turnText');
    expect(plain).not.toHaveProperty('isMyTurn');
  });

  it('단계가 없으면 빈 배열이다', () => {
    const noSteps = toRequestProgressView({ ...approvalRequestDetailFixture, steps: [] }, []);

    expect(noSteps.steps).toEqual([]);
  });

  /* 내부 번호는 이 구획이 나르는 어느 값에도 담기지 않는다(`omf-mes#44`). */
  it('내부 번호를 나르지 않는다', () => {
    const plain: Record<string, unknown> = { ...view };

    for (const key of ['approvalRequestId', 'requestedBy', 'targetId']) {
      expect(plain).not.toHaveProperty(key);
    }

    expect(JSON.stringify(view)).not.toContain('9521');
    expect(JSON.stringify(view)).not.toContain('9541');
  });
});
