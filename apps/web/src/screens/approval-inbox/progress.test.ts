import { messages } from '@omf-mes/i18n';
import { describe, expect, it } from 'vitest';

import { REJECTION_DECISION_CODES, toRequestProgressView, toStepProgressViews } from './progress';
import type { ApprovalRequest, ApprovalStep } from './types';

const t = messages.approvalInbox;

/** 고정 OpenAPI가 닫은 반려 결과 코드. */
const SYNTHETIC_REJECTION_CODE = 'REJECTED';

const step = (overrides: Partial<ApprovalStep> = {}): ApprovalStep => ({
  stepNo: 1,
  approverId: 9501,
  approverName: '합성 승인자1',
  isMine: false,
  isCurrent: false,
  ...overrides,
});

/** 요청 몸통. 진행 구획이 읽는 값 셋만 갈아 끼운다. */
const request = (overrides: Partial<ApprovalRequest> = {}): ApprovalRequest => ({
  approvalRequestId: 9001,
  approvalRequestNo: 'SYNTH-REQ-001',
  approvalTypeCode: 'GOODS_ISSUE_DISPOSAL',
  requestedBy: 9301,
  requestedByName: '합성 상신자1',
  requestedAt: '2026-08-06T14:20:00+09:00',
  statusCode: 'SAMPLE-STATUS-OPEN',
  reason: '합성 사유',
  target: {
    targetTypeCode: 'INBOUND_LOT',
    targetId: 9401,
    displayName: '합성 대상 문서 가',
    openable: false,
  },
  currentStepNo: 1,
  totalStepNo: 1,
  isMyTurn: false,
  ...overrides,
});

describe('단계 상태', () => {
  it('결재했으면 완료다', () => {
    const [view] = toStepProgressViews(
      [step({ decisionCode: 'APPROVED' })],
      REJECTION_DECISION_CODES,
    );

    expect(view?.status).toBe('complete');
  });

  it('결재하지 않았고 지금 차례면 진행 중이다', () => {
    const [view] = toStepProgressViews([step({ isCurrent: true })], REJECTION_DECISION_CODES);

    expect(view?.status).toBe('current');
  });

  it('결재하지 않았고 차례도 아니면 대기다', () => {
    const [view] = toStepProgressViews([step()], REJECTION_DECISION_CODES);

    expect(view?.status).toBe('pending');
  });

  it('결재했으면 지금 차례라고 와도 완료다 — 두 값이 어긋나면 결재 기록이 이긴다', () => {
    /* 목 서버가 실제로 이런 응답을 준다(계획 §6.3). 결재된 단계를 「진행 중」으로 그리면
       사용자는 이미 끝난 단계를 기다린다. */
    const [view] = toStepProgressViews(
      [step({ decisionCode: 'APPROVED', isCurrent: true })],
      REJECTION_DECISION_CODES,
    );

    expect(view?.status).toBe('complete');
  });

  it('빈 결재 코드는 결재하지 않은 것이다', () => {
    const [empty] = toStepProgressViews(
      [
        step({
          decisionCode:
            '' as never /* 계약 밖 값 — 서버가 빈 판정을 내렸을 때의 화면 동작을 시험한다 */,
          isCurrent: true,
        }),
      ],
      REJECTION_DECISION_CODES,
    );
    const [nulled] = toStepProgressViews(
      [step({ decisionCode: null, isCurrent: true })],
      REJECTION_DECISION_CODES,
    );

    expect(empty?.status).toBe('current');
    expect(nulled?.status).toBe('current');
  });
});

describe('반려 코드', () => {
  it('고정 OpenAPI의 반려 값을 쓴다', () => {
    expect(REJECTION_DECISION_CODES).toEqual(['REJECTED']);
  });

  it('고정 반려 코드는 반려로, 승인 코드는 완료로 그린다', () => {
    const views = toStepProgressViews(
      [
        step({ decisionCode: SYNTHETIC_REJECTION_CODE }),
        step({ stepNo: 2, decisionCode: 'APPROVED' }),
      ],
      REJECTION_DECISION_CODES,
    );

    /* 선행 단언 — 두 단계가 실제로 그려졌다. */
    expect(views).toHaveLength(2);
    expect(views.map((view) => view.status)).toEqual(['rejected', 'complete']);
  });

  it('자리표시를 채우면 그 코드가 반려가 된다 — 자리표시가 죽은 가지가 아니다', () => {
    /* 전환 감지기(계획 M22). */
    const views = toStepProgressViews(
      [
        step({ decisionCode: SYNTHETIC_REJECTION_CODE }),
        step({ stepNo: 2, decisionCode: 'APPROVED' }),
      ],
      [SYNTHETIC_REJECTION_CODE],
    );

    expect(views.map((view) => view.status)).toEqual(['rejected', 'complete']);
  });

  it('반려 코드라도 결재 전 단계는 반려가 아니다 — 결재 기록이 있어야 결과가 있다', () => {
    const [view] = toStepProgressViews([step({ isCurrent: true })], [SYNTHETIC_REJECTION_CODE]);

    expect(view?.status).toBe('current');
  });
});

describe('단계 보조 값', () => {
  it('결재 결과 코드를 그대로 나른다 — 화면 낱말로 바꾸지 않는다', () => {
    const [view] = toStepProgressViews(
      [step({ decisionCode: 'APPROVED' })],
      REJECTION_DECISION_CODES,
    );

    expect(view?.decisionCode).toBe('APPROVED');
  });

  it('결재 시각을 저장소 형식으로 낸다', () => {
    const [view] = toStepProgressViews(
      [
        step({
          decisionCode: 'APPROVED',
          decisionAt: '2026-08-06T15:02:00+09:00',
        }),
      ],
      REJECTION_DECISION_CODES,
    );

    expect(view?.decisionAtText).toBe('2026-08-06 15:02');
  });

  it('결재 시각·의견이 오지 않으면 자리를 만들지 않는다', () => {
    const [view] = toStepProgressViews(
      [step({ decisionCode: 'APPROVED', decisionAt: null, decisionComment: '' })],
      REJECTION_DECISION_CODES,
    );

    expect(view?.decisionAtText).toBeNull();
    expect(view?.decisionComment).toBeNull();
  });

  it('의견을 그대로 나른다', () => {
    const [view] = toStepProgressViews(
      [step({ decisionCode: 'APPROVED', decisionComment: '합성 결재 의견' })],
      REJECTION_DECISION_CODES,
    );

    expect(view?.decisionComment).toBe('합성 결재 의견');
  });

  it('결재 전 단계는 결과 대신 보이는 글자를 갖는다 — 색·아이콘에만 기대지 않는다', () => {
    const [current] = toStepProgressViews([step({ isCurrent: true })], REJECTION_DECISION_CODES);
    const [pending] = toStepProgressViews([step()], REJECTION_DECISION_CODES);

    expect(current?.waitingText).toBe(t.progress.waitingCurrent);
    expect(pending?.waitingText).toBe(t.progress.waitingPending);
  });

  it('결재된 단계는 결과 코드가 말하므로 대기 글자를 두지 않는다', () => {
    const [view] = toStepProgressViews(
      [step({ decisionCode: 'APPROVED' })],
      REJECTION_DECISION_CODES,
    );

    expect(view?.waitingText).toBeNull();
    expect(view?.decisionCode).not.toBeNull();
  });

  it('내 단계인지를 서버 값 그대로 나른다', () => {
    const views = toStepProgressViews(
      [step({ isMine: true }), step({ stepNo: 2, isMine: false })],
      REJECTION_DECISION_CODES,
    );

    expect(views.map((view) => view.isMine)).toEqual([true, false]);
  });

  it('단계 번호를 서버 값 그대로 나른다 — 배열 차례로 다시 매기지 않는다', () => {
    const views = toStepProgressViews(
      [step({ stepNo: 2 }), step({ stepNo: 5 })],
      REJECTION_DECISION_CODES,
    );

    expect(views.map((view) => view.stepNo)).toEqual([2, 5]);
  });
});

describe('승인자 이름', () => {
  it('이름을 그대로 낸다', () => {
    const [view] = toStepProgressViews([step()], REJECTION_DECISION_CODES);

    expect(view?.approverLabel).toBe('합성 승인자1');
  });

  it('이름이 없으면 번호를 대신 내지 않는다', () => {
    const [view] = toStepProgressViews(
      [step({ approverName: '', approverId: 9501 })],
      REJECTION_DECISION_CODES,
    );

    expect(view?.approverLabel).toBe(t.values.unknownApprover);
    expect(view?.approverLabel).not.toContain('9501');
  });

  it('공백만인 이름도 비어 있는 것과 같이 다룬다', () => {
    const [view] = toStepProgressViews([step({ approverName: '   ' })], REJECTION_DECISION_CODES);

    expect(view?.approverLabel).toBe(t.values.unknownApprover);
  });
});

describe('진행 위치와 차례 — 서버 값을 그대로 쓴다', () => {
  it('현재 단계는 서버가 준 번호다 — 단계 배열에서 다시 찾지 않는다', () => {
    /*
     * **모순 픽스처**(계획 M19): 서버가 「2단계」라 하는데 배열에는 단계가 하나뿐이고
     * 그 하나가 `isCurrent`다. 배열을 훑어 인덱스+1로 만들면 「1」이 나온다.
     */
    const view = toRequestProgressView(
      {
        request: request({ currentStepNo: 2, totalStepNo: 3 }),
        steps: [step({ decisionCode: 'APPROVED', isCurrent: true })],
      },
      REJECTION_DECISION_CODES,
    );

    expect(view.positionText).toBe(t.progress.position(2, 3));
    expect(view.positionText).not.toBe(t.progress.position(1, 3));
  });

  it('현재 단계가 전체보다 커도 서버 값을 그대로 낸다', () => {
    const view = toRequestProgressView(
      { request: request({ currentStepNo: 2, totalStepNo: 1 }), steps: [step()] },
      REJECTION_DECISION_CODES,
    );

    expect(view.positionText).toBe(t.progress.position(2, 1));
  });

  it('현재 단계가 비었으면 종료로 적고 0으로 메우지 않는다', () => {
    const view = toRequestProgressView(
      {
        request: request({ currentStepNo: null, totalStepNo: 2 }),
        steps: [step({ decisionCode: 'APPROVED' })],
      },
      REJECTION_DECISION_CODES,
    );

    expect(view.positionText).toBe(t.progress.finished(2));
    expect(view.positionText).not.toContain('0');
  });

  it('내 차례인지는 서버 값이다 — 배열로는 아니라고 나와도 서버를 따른다', () => {
    /* **모순 픽스처 방향 ①**(계획 M20): 내 단계가 하나도 없는데 서버는 내 차례라 한다. */
    const view = toRequestProgressView(
      {
        request: request({ isMyTurn: true }),
        steps: [step({ isMine: false, isCurrent: true })],
      },
      REJECTION_DECISION_CODES,
    );

    expect(view.turnText).toBe(t.progress.myTurn);
  });

  it('내 차례가 아닌 것도 서버 값이다 — 배열로는 맞다고 나와도 서버를 따른다', () => {
    /* **모순 픽스처 방향 ②**: 미결인 내 단계가 지금 차례인데 서버는 내 차례가 아니라 한다. */
    const view = toRequestProgressView(
      {
        request: request({ isMyTurn: false }),
        steps: [step({ isMine: true, isCurrent: true })],
      },
      REJECTION_DECISION_CODES,
    );

    expect(view.turnText).toBe(t.progress.notMyTurn);
  });

  it('단계 배열을 순서 그대로 옮긴다 — 다시 정렬하지 않는다', () => {
    const view = toRequestProgressView(
      {
        request: request({ currentStepNo: 1, totalStepNo: 3 }),
        steps: [step({ stepNo: 3 }), step({ stepNo: 1 }), step({ stepNo: 2 })],
      },
      REJECTION_DECISION_CODES,
    );

    expect(view.steps.map((one) => one.stepNo)).toEqual([3, 1, 2]);
  });

  it('단계가 오지 않아도 위치와 차례는 선다 — 진행을 모르는 것과 요청이 없는 것은 다르다', () => {
    const view = toRequestProgressView(
      { request: request({ currentStepNo: 1, totalStepNo: 2 }), steps: [] },
      REJECTION_DECISION_CODES,
    );

    expect(view.steps).toHaveLength(0);
    expect(view.positionText).toBe(t.progress.position(1, 2));
  });
});
