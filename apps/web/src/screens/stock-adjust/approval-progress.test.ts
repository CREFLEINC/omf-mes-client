import { messages } from '@omf-mes/i18n';
import { describe, expect, it } from 'vitest';

import {
  APPROVED_APPROVAL_STATUS_CODES,
  REJECTION_DECISION_CODES,
  isApprovalJudgePending,
  isApproved,
  readSubmission,
  toRequestProgressView,
  toStepProgressViews,
} from './approval-progress';
import {
  SAMPLE_APPROVED_STATUS,
  SAMPLE_REJECTION_DECISION,
  approvalRequestDetailBody,
  approvalStep,
} from './fixtures';

const t = messages.stockAdjust;

/**
 * ⭐ **자리표시 둘**(D-13). 값 목록이 공통코드 소관이라(`omf-mes#64`) 어떤 코드가 승인이고
 * 반려인지 화면이 알 근거가 없다 — **비어 있는 것이 지금의 사실이다.**
 */
describe('자리표시 배열', () => {
  it('두 자리표시가 비어 있다', () => {
    expect(APPROVED_APPROVAL_STATUS_CODES).toEqual([]);
    expect(REJECTION_DECISION_CODES).toEqual([]);
  });

  /** 비어 있는 동안에는 **어떤 코드도 승인이 되지 않는다.** 짐작해 채우면 그것이 사실로 보인다. */
  it('비어 있는 동안 어떤 코드도 승인이 아니다', () => {
    expect(isApprovalJudgePending(APPROVED_APPROVAL_STATUS_CODES)).toBe(true);
    expect(isApproved(SAMPLE_APPROVED_STATUS, APPROVED_APPROVAL_STATUS_CODES)).toBe(false);
  });

  /**
   * ⭐ **채우면 살아난다** — 죽은 가지가 아니라는 것이 이 시험의 요점이다(D-13 · C37).
   *
   * 자리표시를 **인자로 받는 것**이 그 전환을 잴 수 있게 하는 형태다. 함수 안에서 상수를 직접
   * 읽으면 「값이 채워지면 무엇이 달라지는가」를 시험이 만들 길이 없어 그 자리가 죽는다.
   */
  it('채우면 그 코드가 승인이 된다', () => {
    expect(isApprovalJudgePending([SAMPLE_APPROVED_STATUS])).toBe(false);
    expect(isApproved(SAMPLE_APPROVED_STATUS, [SAMPLE_APPROVED_STATUS])).toBe(true);
  });

  it('채워도 목록에 없는 코드는 승인이 아니다', () => {
    expect(isApproved('SAMPLE_AP_STATUS_B', [SAMPLE_APPROVED_STATUS])).toBe(false);
  });
});

/**
 * 상신 여부는 **`approvalRequestId`가 있는가**로 읽는다 — 상태 코드 문자열을 비교하지 않는다
 * (공유계약 G-2 · D-13).
 */
describe('readSubmission', () => {
  it('값이 없으면 아직 상신되지 않은 것이다', () => {
    expect(readSubmission(null)).toEqual({ kind: 'notSubmitted' });
    expect(readSubmission(undefined)).toEqual({ kind: 'notSubmitted' });
  });

  it('쓸 수 있는 값이면 그대로 나른다 — 가공하지 않는다', () => {
    expect(readSubmission(9801)).toEqual({ kind: 'submitted', approvalRequestId: 9801 });
  });

  /**
   * ⭐ **셋째 갈래를 없애면 둘 중 하나가 거짓이 된다.**
   *
   * 값이 실려 왔다는 것은 상신이 있었을 수 있다는 뜻이라 「아직 상신되지 않았다」는 사실이
   * 아니고, 그 값으로 부르면 `/app/approval-requests/0` 같은 요청이 나가 남의 요청을 열거나 헛돈다.
   */
  it.each([0, -3, 1.5, Number.NaN])('조회 조각으로 쓸 수 없는 값 %o은 부르지 않는다', (raw) => {
    expect(readSubmission(raw)).toEqual({ kind: 'unusable' });
  });
});

/**
 * 단계 하나의 상태 — **결재했는가와 지금 차례인가, 둘로만 가른다.**
 */
describe('toStepProgressViews', () => {
  it('결재 기록이 있으면 완료다', () => {
    const [view] = toStepProgressViews([approvalStep()], REJECTION_DECISION_CODES);

    expect(view?.status).toBe('complete');
    expect(view?.decisionCode).toBe(SAMPLE_REJECTION_DECISION);
  });

  /**
   * **결재 기록이 있으면 `isCurrent`가 참이어도 완료다.** 두 값이 어긋나는 응답이 실재하고
   * (목 실측), 그때 「진행 중」으로 그리면 사용자가 이미 끝난 단계를 기다린다.
   */
  it('결재된 단계는 지금 차례로 와도 완료다', () => {
    const [view] = toStepProgressViews(
      [approvalStep({ isCurrent: true })],
      REJECTION_DECISION_CODES,
    );

    expect(view?.status).toBe('complete');
  });

  it('결재 전이고 지금 차례면 진행 중이다', () => {
    const [view] = toStepProgressViews(
      [approvalStep({ decisionCode: null, isCurrent: true })],
      REJECTION_DECISION_CODES,
    );

    expect(view?.status).toBe('current');
    expect(view?.waitingText).toBe(t.progress.waitingCurrent);
  });

  it('결재 전이고 차례가 아니면 대기다', () => {
    const [view] = toStepProgressViews(
      [approvalStep({ decisionCode: null, isCurrent: false })],
      REJECTION_DECISION_CODES,
    );

    expect(view?.status).toBe('pending');
    expect(view?.waitingText).toBe(t.progress.waitingPending);
  });

  /** 자리표시가 빈 지금은 **어떤 코드도 반려가 되지 않는다.** */
  it('반려 자리표시가 비어 있으면 반려로 그리지 않는다', () => {
    const [view] = toStepProgressViews(
      [approvalStep({ decisionCode: SAMPLE_REJECTION_DECISION })],
      REJECTION_DECISION_CODES,
    );

    expect(view?.status).toBe('complete');
  });

  /** ⭐ **채우면 그 코드의 단계가 반려로 그려진다** — 자리표시가 죽은 가지가 아니다. */
  it('반려 자리표시를 채우면 그 코드가 반려가 된다', () => {
    const [view] = toStepProgressViews([approvalStep()], [SAMPLE_REJECTION_DECISION]);

    expect(view?.status).toBe('rejected');
  });

  /** **서버가 매긴 단계 번호를 그대로 쓴다** — 배열 차례로 다시 매기지 않는다. */
  it('단계 번호를 다시 매기지 않는다', () => {
    const views = toStepProgressViews(approvalRequestDetailBody().steps, REJECTION_DECISION_CODES);

    expect(views.map((view) => view.stepNo)).toEqual([1, 4]);
  });

  /** 이름이 비어 오면 **번호를 대신 내지 않는다**(`omf-mes#44`). */
  it('승인자 이름이 비어 오면 그 사실을 적는다', () => {
    const [view] = toStepProgressViews(
      [approvalStep({ approverName: '' })],
      REJECTION_DECISION_CODES,
    );

    expect(view?.approverLabel).toBe(t.values.unknownApprover);
    expect(view?.approverLabel).not.toContain('9811');
  });

  /** 결재된 단계는 결과 코드가 그 자리를 맡는다 — 기다림 문구를 함께 내지 않는다. */
  it('결재된 단계에는 기다림 문구가 없다', () => {
    const [view] = toStepProgressViews([approvalStep()], REJECTION_DECISION_CODES);

    expect(view?.waitingText).toBeNull();
    expect(view?.decisionAtText).toBe('2026-08-18 15:02');
  });
});

/**
 * 상세 응답 하나에서 결재 진행 구획이 그릴 것을 **전부** 만든다.
 *
 * **조회는 하나뿐이다** — 계약이 `steps`를 상세에 실어 준다. 두 번 부르면 두 응답이 서로 다른
 * 시점을 보게 되고, 그 어긋남이 「진행은 4단계인데 단계 목록은 2단계까지」로 나타난다.
 */
describe('toRequestProgressView', () => {
  it('업무 번호와 요청 정보를 옮긴다', () => {
    const view = toRequestProgressView(
      approvalRequestDetailBody(),
      REJECTION_DECISION_CODES,
      APPROVED_APPROVAL_STATUS_CODES,
    );

    expect(view.requestNo).toBe('SAMPLE-AP-0001');
    expect(view.approvalTypeCode).toBe('SAMPLE_AT_A');
    expect(view.statusCode).toBe('SAMPLE_AP_STATUS_A');
    expect(view.requesterLabel).toBe('합성 상신자 가');
    expect(view.requestedAtText).toBe('2026-08-18 14:35');
  });

  /**
   * ⛔ **결재함이 쓰는 표기를 나르지 않는다**(C36 · D-13).
   *
   * `isMyTurn`·`isMine`을 나르면 이 화면이 결재함처럼 읽히고, 사용자는 있지도 않은 승인 버튼을
   * 찾는다 — 여기서 말하는 것은 **어디까지 왔는가**뿐이다.
   */
  it('내 차례 표기를 나르지 않는다', () => {
    const view = toRequestProgressView(
      approvalRequestDetailBody(),
      REJECTION_DECISION_CODES,
      APPROVED_APPROVAL_STATUS_CODES,
    );

    /* 짝 양성 — 옮길 것은 실제로 옮긴다. 「아무것도 안 옮긴다」로 통과하지 않게 한다. */
    expect(view.requestNo).toBe('SAMPLE-AP-0001');
    expect(view).not.toHaveProperty('isMyTurn');
    for (const step of view.steps) expect(step).not.toHaveProperty('isMine');
  });

  /** 사유 **전문**이 줄로 온다 — 첫 줄만 내는 것은 결재함 목록의 일이다. */
  it('사유 전문을 줄로 나눠 옮긴다', () => {
    const view = toRequestProgressView(
      approvalRequestDetailBody(),
      REJECTION_DECISION_CODES,
      APPROVED_APPROVAL_STATUS_CODES,
    );

    expect(view.reasonLines).toEqual(['합성 조정 사유 첫 줄', '', '둘째 문단 — 근거를 적는 자리']);
  });

  /**
   * 사유가 **빈 채로 오는 길**이 있다(계약이 `NOT NULL`이라 적었으나 빈 문자열이 스키마를
   * 통과한다). 줄이 하나도 없으면 그 자리가 통째로 비어 「불러오지 못한 것」처럼 보인다.
   */
  it.each(['', '   '])('사유가 %j이면 그 사실을 한 줄로 적는다', (reason) => {
    const view = toRequestProgressView(
      approvalRequestDetailBody({ reason }),
      REJECTION_DECISION_CODES,
      APPROVED_APPROVAL_STATUS_CODES,
    );

    expect(view.reasonLines).toEqual([t.progress.emptyReason]);
  });

  /** **서버가 준 두 수 그대로다** — 배열 길이로 다시 세지 않는다. */
  it('위치를 서버가 준 두 수로 말한다', () => {
    const view = toRequestProgressView(
      approvalRequestDetailBody({ currentStepNo: 2, totalStepNo: 3 }),
      REJECTION_DECISION_CODES,
      APPROVED_APPROVAL_STATUS_CODES,
    );

    expect(view.positionText).toBe(t.progress.position(2, 3));
  });

  it('결재가 끝났으면 종료로 말한다', () => {
    const view = toRequestProgressView(
      approvalRequestDetailBody({ currentStepNo: null, totalStepNo: 3 }),
      REJECTION_DECISION_CODES,
      APPROVED_APPROVAL_STATUS_CODES,
    );

    expect(view.positionText).toBe(t.progress.finished(3));
  });

  /**
   * ⭐ **「결재가 끝났다」는 「승인됐다」가 아니다.** 반려로 끝난 요청도 `currentStepNo`가
   * 비므로, 그것으로 승인을 판정하면 **반려된 조정이 처리할 수 있는 것처럼 보인다.**
   */
  it('결재가 끝났어도 자리표시가 비어 있으면 승인으로 읽지 않는다', () => {
    const view = toRequestProgressView(
      approvalRequestDetailBody({ currentStepNo: null }),
      REJECTION_DECISION_CODES,
      APPROVED_APPROVAL_STATUS_CODES,
    );

    expect(view.isApproved).toBe(false);
  });

  /** ⭐ 채우면 살아난다 — 그 코드일 때만 승인이다. */
  it('자리표시를 채우면 그 상태가 승인이 된다', () => {
    const approved = toRequestProgressView(approvalRequestDetailBody(), REJECTION_DECISION_CODES, [
      SAMPLE_APPROVED_STATUS,
    ]);
    const other = toRequestProgressView(
      approvalRequestDetailBody({ statusCode: 'SAMPLE_AP_STATUS_B' }),
      REJECTION_DECISION_CODES,
      [SAMPLE_APPROVED_STATUS],
    );

    expect(approved.isApproved).toBe(true);
    expect(other.isApproved).toBe(false);
  });
});
