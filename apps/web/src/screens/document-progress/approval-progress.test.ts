import { messages } from '@omf-mes/i18n';
import { describe, expect, it } from 'vitest';

import {
  APPROVED_APPROVAL_STATUS_CODES,
  hasCancelRequest,
  isApproved,
  isApprovalJudgePending,
  readSubmission,
  REJECTION_DECISION_CODES,
  toReasonLines,
  toRequestProgressView,
  toStepProgressViews,
} from './approval-progress';
import { approvalRequestDetail, approvalStep, approvalStepFixtures } from './fixtures';

const t = messages.documentProgress;

describe('자리표시 두 벌', () => {
  /*
   * ⭐ **비어 있는 것이 지금의 사실이다.** 값 목록이 공통코드 소관이라(omf-mes#64) 어떤 코드가
   * 승인이고 반려인지 화면이 알 근거가 없다 — 짐작해 채우면 그 짐작이 사용자에게는 사실로 보인다.
   */
  it('승인 완료 코드가 비어 있다', () => {
    expect(APPROVED_APPROVAL_STATUS_CODES).toEqual([]);
  });

  it('반려 결과 코드가 비어 있다', () => {
    expect(REJECTION_DECISION_CODES).toEqual([]);
  });
});

describe('readSubmission — 세 갈래 · C4-1 · C4-2', () => {
  it('값이 아예 없으면 요청이 없다', () => {
    expect(readSubmission(null)).toEqual({ kind: 'notSubmitted' });
    expect(readSubmission(undefined)).toEqual({ kind: 'notSubmitted' });
  });

  it('쓸 수 있는 값이면 그대로 나른다', () => {
    expect(readSubmission(9501)).toEqual({ kind: 'submitted', approvalRequestId: 9501 });
  });

  /*
   * ⭐ **셋째 갈래를 없애면 둘 중 하나가 거짓이 된다.** 값이 실려 왔다는 것은 요청이 있었을 수
   * 있다는 뜻이라 「아직 취소 요청이 없습니다」는 사실이 아니고, 그 값으로 부르면
   * `/app/approval-requests/0` 같은 요청이 나가 남의 요청을 열거나 헛돈다.
   */
  it.each([0, -1, 1.5, Number.NaN])('조회 조각으로 쓸 수 없는 값은 쓸 수 없다고 판정한다', (id) => {
    expect(readSubmission(id)).toEqual({ kind: 'unusable' });
  });
});

describe('hasCancelRequest — 실행 버튼의 근거 · C4-7', () => {
  it('요청이 없으면 거짓이다', () => {
    expect(hasCancelRequest({ kind: 'notSubmitted' })).toBe(false);
  });

  it('요청이 있으면 참이다', () => {
    expect(hasCancelRequest({ kind: 'submitted', approvalRequestId: 9501 })).toBe(true);
  });

  /*
   * ⭐ **조회의 조건과 버튼의 조건은 다른 물음이다.** 실행은 이 값을 쓰지 않고
   * `/logistics/{리소스}/{번호}:cancel`로 나간다 — 조회 하나가 막혔다는 이유로 실행 자체가
   * 사라지면, 값이 이상하게 온 문서는 영영 되돌릴 수 없다. 잠금의 정본은 서버다.
   */
  it('조회할 수 없는 값이 와도 요청은 있었던 것으로 본다', () => {
    expect(hasCancelRequest({ kind: 'unusable' })).toBe(true);
  });
});

describe('승인 완료 판정 — C4-6', () => {
  it('자리표시가 비어 있으면 판정할 수 없다', () => {
    expect(isApprovalJudgePending([])).toBe(true);
  });

  it('자리표시가 차면 판정할 수 있다', () => {
    expect(isApprovalJudgePending(['SYN_APPROVED'])).toBe(false);
  });

  /* 빈 자리표시에서 **어떤 코드도 승인이 되지 않는다.** */
  it('자리표시가 비어 있으면 어떤 코드도 승인이 아니다', () => {
    expect(isApproved('SYN_APPROVED', [])).toBe(false);
  });

  it('자리표시에 든 코드만 승인이다', () => {
    expect(isApproved('SYN_APPROVED', ['SYN_APPROVED'])).toBe(true);
    expect(isApproved('REJECTED', ['SYN_APPROVED'])).toBe(false);
  });
});

describe('toReasonLines', () => {
  /* 취소 사유가 곧 취소 이력이다 — 줄바꿈이 뜻을 나른다. */
  it('줄바꿈을 줄로 가른다', () => {
    expect(toReasonLines('첫 줄\n둘째 줄')).toEqual(['첫 줄', '둘째 줄']);
  });

  it('캐리지 리턴이 섞여도 줄만 가른다', () => {
    expect(toReasonLines('첫 줄\r\n둘째 줄')).toEqual(['첫 줄', '둘째 줄']);
  });

  it('빈 줄을 버리지 않는다', () => {
    expect(toReasonLines('첫 줄\n\n셋째 줄')).toEqual(['첫 줄', '', '셋째 줄']);
  });
});

describe('toStepProgressViews', () => {
  /*
   * ⭐ **서버가 매긴 단계 번호를 그대로 나른다**(C4-5). 픽스처의 `stepNo`가 배열 차례와
   * 어긋나(11·12·13) 인덱스+1을 쓰는 구현이 여기서 갈린다.
   */
  it('단계 번호가 배열 차례가 아니라 응답의 값이다', () => {
    const views = toStepProgressViews(approvalStepFixtures, []);

    expect(views.map((view) => view.stepNo)).toEqual([11, 12, 13]);
  });

  it('차례를 바꾸지 않는다', () => {
    const views = toStepProgressViews(approvalStepFixtures, []);

    expect(views.map((view) => view.approverLabel)).toEqual([
      '김승인',
      '박검토',
      t.values.unknownApprover,
    ]);
  });

  /* 결재 기록이 있으면 완료다. **반려 자리표시가 빈 동안 어떤 코드도 반려가 되지 않는다.** */
  it('자리표시가 비어 있으면 결재된 단계가 완료로 그려진다', () => {
    const [first] = toStepProgressViews([approvalStep({ decisionCode: 'REJECTED' })], []);

    expect(first?.status).toBe('complete');
  });

  it('자리표시를 채우면 그 코드의 단계가 반려가 된다', () => {
    const [first] = toStepProgressViews([approvalStep({ decisionCode: 'REJECTED' })], ['REJECTED']);

    expect(first?.status).toBe('rejected');
  });

  /*
   * **결재 기록이 있으면 `isCurrent`가 참이어도 완료다.** 두 값이 어긋나는 응답이 실재하고,
   * 그때 「진행 중」으로 그리면 사용자가 이미 끝난 단계를 기다린다.
   */
  it('결재된 단계는 지금 차례라고 와도 완료다', () => {
    const [first] = toStepProgressViews([approvalStep({ isCurrent: true })], []);

    expect(first?.status).toBe('complete');
  });

  it('결재 전 단계는 차례 여부로 갈린다', () => {
    const views = toStepProgressViews(
      [
        approvalStep({ decisionCode: null, decisionAt: null, isCurrent: true }),
        approvalStep({ decisionCode: null, decisionAt: null, isCurrent: false }),
      ],
      [],
    );

    expect(views.map((view) => view.status)).toEqual(['current', 'pending']);
    expect(views.map((view) => view.waitingText)).toEqual([
      t.approval.waitingCurrent,
      t.approval.waitingPending,
    ]);
  });

  /* 결재된 단계는 결과 코드가 그 자리를 맡는다 — 기다리는 글자를 함께 내면 두 말이 겹친다. */
  it('결재된 단계에는 기다리는 글자가 없다', () => {
    const [first] = toStepProgressViews([approvalStep()], []);

    expect(first?.waitingText).toBeNull();
    expect(first?.decisionCode).toBe('APPROVED');
  });

  /* 빈 문자열은 값이 아니다 — 계약이 선택으로 둔 자리라 빈 글자가 스키마를 통과한다. */
  it('빈 의견·빈 결과 코드를 값으로 세우지 않는다', () => {
    const [first] = toStepProgressViews(
      [approvalStep({ decisionCode: null, decisionAt: '', decisionComment: '' })],
      [],
    );

    expect(first?.decisionCode).toBeNull();
    expect(first?.decisionAtText).toBeNull();
    expect(first?.decisionComment).toBeNull();
  });

  it('결재 시각을 화면 표기로 옮긴다', () => {
    const [first] = toStepProgressViews([approvalStep()], []);

    expect(first?.decisionAtText).toBe('2026-08-06 15:02');
  });
});

describe('toRequestProgressView', () => {
  it('요청 정보를 응답 그대로 옮긴다', () => {
    const view = toRequestProgressView(approvalRequestDetail(), []);

    expect(view.requestNo).toBe('SYN-AP-2026-0001');
    expect(view.approvalTypeCode).toBe('GOODS_ISSUE_CANCEL');
    expect(view.statusCode).toBe('SYN_APPROVAL_IN_PROGRESS');
    expect(view.requesterLabel).toBe('이상신');
    expect(view.requestedAtText).toBe('2026-08-06 14:20');
  });

  /* 취소 사유가 곧 이력이다 — 전문이 줄째 온다. */
  it('사유를 줄째 나른다', () => {
    const view = toRequestProgressView(approvalRequestDetail(), []);

    expect(view.reasonLines).toEqual(['수량 오기입으로 취소합니다', '실사 차이표 대조 완료']);
  });

  /* 요청자 이름이 비어 오면 **내부 번호를 대신 내지 않는다**(omf-mes#44). */
  it('요청자 이름이 비면 그 사실을 적는다', () => {
    const view = toRequestProgressView(approvalRequestDetail({ requestedByName: '' }), []);

    expect(view.requesterLabel).toBe(t.values.unknownRequester);
    expect(view.requesterLabel).not.toContain('9701');
  });

  /* **서버가 준 두 수 그대로다** — `steps.length`로 다시 세지 않는다. */
  it('위치가 서버가 준 두 수로 그려진다', () => {
    const view = toRequestProgressView(approvalRequestDetail(), []);

    expect(view.positionText).toBe(t.approval.position(2, 3));
  });

  it('기다리는 단계가 없으면 종료 문면이 선다', () => {
    const view = toRequestProgressView(approvalRequestDetail({ currentStepNo: null }), []);

    expect(view.positionText).toBe(t.approval.finished(3));
  });

  /*
   * ⭐ **자리표시가 비어 있는 동안 승인은 늘 거짓이다.** 「결재가 끝났다」는 「승인됐다」가
   * 아니다 — 반려로 끝난 요청도 `currentStepNo`가 빈다.
   */
  it('자리표시가 비어 있으면 승인으로 판정하지 않는다', () => {
    const view = toRequestProgressView(
      approvalRequestDetail({ statusCode: 'SYN_APPROVED', currentStepNo: null }),
      [],
      [],
    );

    expect(view.isApproved).toBe(false);
  });

  it('자리표시를 채우면 그 상태가 승인이 된다', () => {
    const view = toRequestProgressView(
      approvalRequestDetail({ statusCode: 'SYN_APPROVED' }),
      [],
      ['SYN_APPROVED'],
    );

    expect(view.isApproved).toBe(true);
  });

  /* 두 자리표시가 **서로 다른 축**이다 — 반려 자리표시를 채운다고 승인이 판정되지 않는다. */
  it('반려 자리표시를 채워도 승인 판정은 열리지 않는다', () => {
    const view = toRequestProgressView(
      approvalRequestDetail({ statusCode: 'SYN_APPROVED' }),
      ['REJECTED'],
      [],
    );

    expect(view.isApproved).toBe(false);
  });

  it('단계 배열을 함께 옮긴다', () => {
    const view = toRequestProgressView(approvalRequestDetail(), []);

    expect(view.steps).toHaveLength(3);
    expect(view.steps[0]?.stepNo).toBe(11);
  });
});
