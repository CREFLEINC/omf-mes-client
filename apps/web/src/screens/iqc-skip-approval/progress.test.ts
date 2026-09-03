import { messages } from '@omf-mes/i18n';
import { describe, expect, it } from 'vitest';

import {
  SAMPLE_DECISION_CODE_A,
  SAMPLE_DECISION_CODE_B,
  contradictoryDetail,
  finishedDetail,
  namelessApproverDetail,
  noStepsDetail,
} from './fixtures';
import { REJECTION_DECISION_CODES, toRequestProgressView, toStepProgressViews } from './progress';
import type { ApprovalRequestDetail, ApprovalStep } from './types';

const t = messages.iqcSkipApproval;

/** 자리표시가 빈 지금의 판정. 시험이 채워 넣는 집합과 구분해 쓴다. */
const NO_REJECTION_CODES: readonly string[] = [];

describe('REJECTION_DECISION_CODES', () => {
  /**
   * **비어 있는 것이 지금의 사실이다.** 값 목록이 공통코드 소관이라(`omf-mes#64`) 어떤 코드가
   * 반려인지 화면이 알 근거가 없다. 채우는 순간 살아나는 것은 아래 전환 감지기가 잰다.
   */
  it('고정 OpenAPI의 반려 값을 쓴다', () => {
    expect(REJECTION_DECISION_CODES).toEqual(['REJECTED']);
  });
});

describe('toStepProgressViews — 단계 상태', () => {
  const pendingStep: ApprovalStep = {
    stepNo: 1,
    approverId: 9501,
    approverName: '합성 승인자1',
    isMine: false,
    isCurrent: false,
  };

  it('결재 전이고 지금 차례면 진행 중이다', () => {
    const [view] = toStepProgressViews([{ ...pendingStep, isCurrent: true }], NO_REJECTION_CODES);

    expect(view?.status).toBe('current');
  });

  it('결재 전이고 차례도 아니면 대기다', () => {
    const [view] = toStepProgressViews([pendingStep], NO_REJECTION_CODES);

    expect(view?.status).toBe('pending');
  });

  it('결재 기록이 있으면 완료다', () => {
    const [view] = toStepProgressViews(
      [{ ...pendingStep, decisionCode: SAMPLE_DECISION_CODE_A }],
      NO_REJECTION_CODES,
    );

    expect(view?.status).toBe('complete');
  });

  /**
   * **결재 기록과 `isCurrent`가 어긋나는 응답이 실재한다**(목 실측).
   * 그때 「진행 중」으로 그리면 사용자가 이미 끝난 단계를 기다린다.
   */
  it('결재 기록이 있으면 `isCurrent`가 참이어도 완료다', () => {
    const [view] = toStepProgressViews(
      [{ ...pendingStep, decisionCode: SAMPLE_DECISION_CODE_A, isCurrent: true }],
      NO_REJECTION_CODES,
    );

    expect(view?.status).toBe('complete');
  });

  it('고정 반려 코드만 반려로 그린다', () => {
    const views = toStepProgressViews(
      [
        { ...pendingStep, decisionCode: SAMPLE_DECISION_CODE_A },
        { ...pendingStep, stepNo: 2, decisionCode: SAMPLE_DECISION_CODE_B },
        { ...pendingStep, stepNo: 3, decisionCode: 'REJECTED' },
      ],
      REJECTION_DECISION_CODES,
    );

    expect(views.map((view) => view.status)).toEqual(['complete', 'rejected', 'rejected']);
  });

  /**
   * **전환 감지기**(M22) — 자리표시를 채우면 그 코드의 단계가 반려로 그려진다.
   *
   * 이 짝이 없으면 잠금을 상수로 굳힌 구현(`status`가 절대 `rejected`가 되지 않는 코드)이
   * 그대로 통과하고, 값이 확정되는 날 아무도 그 사실을 모른다.
   */
  it('자리표시를 채우면 그 코드가 반려가 된다 — 다른 코드는 그대로 완료다', () => {
    const views = toStepProgressViews(
      [
        { ...pendingStep, decisionCode: SAMPLE_DECISION_CODE_A },
        { ...pendingStep, stepNo: 2, decisionCode: SAMPLE_DECISION_CODE_B },
      ],
      [SAMPLE_DECISION_CODE_B],
    );

    expect(views[0]?.status).toBe('complete');
    expect(views[1]?.status).toBe('rejected');
  });

  it('빈 문자열 결재 코드는 「결재하지 않음」이다 — 선택 필드의 빈 값과 널이 같은 뜻이다', () => {
    const views = toStepProgressViews(
      [
        {
          ...pendingStep,
          decisionCode:
            '' as never /* 계약 밖 값 — 서버가 빈 판정을 내렸을 때의 화면 동작을 시험한다 */,
          isCurrent: true,
        },
        { ...pendingStep, stepNo: 2, decisionCode: null },
      ],
      NO_REJECTION_CODES,
    );

    expect(views[0]?.status).toBe('current');
    expect(views[0]?.decisionCode).toBeNull();
    expect(views[1]?.status).toBe('pending');
  });
});

describe('toStepProgressViews — 단계가 나르는 값', () => {
  it('서버가 매긴 단계 번호를 그대로 나른다 — 배열 차례로 다시 매기지 않는다', () => {
    const views = toStepProgressViews(namelessApproverDetail.steps, NO_REJECTION_CODES);

    expect(views.map((view) => view.stepNo)).toEqual([1, 2]);
  });

  /**
   * **배열 차례와 `stepNo`가 어긋나는 응답에서 갈린다.** 인덱스+1로 매기는 구현은
   * `[1, 2]`를 내고 서버 값을 나르는 구현은 `[3, 7]`을 낸다.
   */
  it('배열 차례와 어긋나는 단계 번호도 서버 값 그대로다', () => {
    const views = toStepProgressViews(
      [
        {
          stepNo: 3,
          approverId: 9501,
          approverName: '합성 승인자1',
          isMine: false,
          isCurrent: false,
        },
        {
          stepNo: 7,
          approverId: 9502,
          approverName: '합성 승인자2',
          isMine: false,
          isCurrent: true,
        },
      ],
      NO_REJECTION_CODES,
    );

    expect(views.map((view) => view.stepNo)).toEqual([3, 7]);
  });

  it('결재 결과 코드·시각·의견을 응답 값 그대로 나른다', () => {
    const [view] = toStepProgressViews(contradictoryDetail.steps, NO_REJECTION_CODES);

    expect(view?.decisionCode).toBe(SAMPLE_DECISION_CODE_A);
    expect(view?.decisionAtText).toBe('2026-08-06 15:02');
    expect(view?.decisionComment).toBe('합성 결재 의견 하나');
  });

  it('승인자 이름이 비어 오면 그 사실을 적고 번호를 대신 내지 않는다(omf-mes#44)', () => {
    const [view] = toStepProgressViews(namelessApproverDetail.steps, NO_REJECTION_CODES);

    /* 짝 방향 — 이름이 있는 단계는 그 이름이 그대로 선다. */
    expect(
      toStepProgressViews(contradictoryDetail.steps, NO_REJECTION_CODES)[0]?.approverLabel,
    ).toBe('합성 승인자1');
    expect(view?.approverLabel).toBe(t.values.unknownApprover);
    expect(JSON.stringify(view)).not.toContain(String(namelessApproverDetail.steps[0]?.approverId));
  });

  it('결재 전 단계에는 보이는 글자가 선다 — 색·아이콘에만 기대지 않는다', () => {
    const views = toStepProgressViews(namelessApproverDetail.steps, NO_REJECTION_CODES);

    expect(views[0]?.waitingText).toBeNull();
    expect(views[1]?.waitingText).toBe(t.progress.waitingCurrent);
  });

  it('결재 전이고 차례도 아닌 단계의 글자가 진행 중인 단계와 다르다', () => {
    const [view] = toStepProgressViews(
      [
        {
          stepNo: 1,
          approverId: 9501,
          approverName: '합성 승인자1',
          isMine: false,
          isCurrent: false,
        },
      ],
      NO_REJECTION_CODES,
    );

    expect(view?.waitingText).toBe(t.progress.waitingPending);
    expect(t.progress.waitingPending).not.toBe(t.progress.waitingCurrent);
  });

  it('내 단계인지는 서버 값 그대로다 — 로그인 사용자와 승인자 번호를 맞춰 보지 않는다', () => {
    const views = toStepProgressViews(finishedDetail.steps, NO_REJECTION_CODES);

    expect(views.map((view) => view.isMine)).toEqual([false, true]);
  });

  it('차례를 바꾸지 않는다 — 배열 순서가 곧 결재 순서다', () => {
    const views = toStepProgressViews(finishedDetail.steps, NO_REJECTION_CODES);

    expect(views.map((view) => view.stepNo)).toEqual([1, 2]);
  });
});

describe('toRequestProgressView — 위치와 차례', () => {
  /**
   * **M19의 단위 몫** — `currentStepNo`가 배열 인덱스+1과 어긋나는 픽스처다.
   * 재계산하는 구현은 「1 / 1 단계」를 내고 서버 값을 쓰는 구현만 「2 / 3 단계」를 낸다.
   */
  it('현재 단계와 전체 단계가 서버가 준 두 수 그대로다', () => {
    const view = toRequestProgressView(contradictoryDetail, NO_REJECTION_CODES);

    expect(view.positionText).toBe(t.progress.position(2, 3));
    expect(view.positionText).not.toBe(t.progress.position(1, 1));
  });

  it('현재 단계가 비어 있으면 종료다 — 0으로 메우지 않는다', () => {
    const view = toRequestProgressView(finishedDetail, NO_REJECTION_CODES);

    expect(view.positionText).toBe(t.progress.finished(2));
    expect(view.positionText).not.toContain('0');
  });

  /**
   * **M20의 단위 몫 — 두 방향이다.**
   *
   * ① 서버가 참인데 배열로는 거짓(미결 단계가 없다) ② 서버가 거짓인데 배열로는 참
   * (앞 단계가 결재됐고 지금 단계가 내 것이며 미결이다). 한 방향만 두면 「늘 서버 값」과
   * 「늘 그 값」이 구분되지 않는다.
   */
  it('내 차례 판정이 서버 값 그대로다 — 참인데 배열로는 거짓인 요청', () => {
    const view = toRequestProgressView(contradictoryDetail, NO_REJECTION_CODES);

    expect(contradictoryDetail.request.isMyTurn).toBe(true);
    expect(contradictoryDetail.steps.every((step) => step.decisionCode !== undefined)).toBe(true);
    expect(view.turnText).toBe(t.progress.myTurn);
  });

  it('내 차례 판정이 서버 값 그대로다 — 거짓인데 배열로는 참인 요청', () => {
    const view = toRequestProgressView(finishedDetail, NO_REJECTION_CODES);

    expect(finishedDetail.request.isMyTurn).toBe(false);
    /* 배열로 재계산하면 참이 된다 — 앞 단계가 결재됐고 지금 단계는 미결이며 내 것이다. */
    expect(finishedDetail.steps[1]?.isMine).toBe(true);
    expect(finishedDetail.steps[1]?.isCurrent).toBe(true);
    expect(view.turnText).toBe(t.progress.notMyTurn);
  });

  it('단계 배열이 비어 와도 위치·차례는 서버 값으로 선다', () => {
    const view = toRequestProgressView(noStepsDetail, NO_REJECTION_CODES);

    expect(view.steps).toEqual([]);
    expect(view.positionText).toBe(t.progress.position(1, 4));
  });

  it('전체 단계 수를 배열 길이로 세지 않는다', () => {
    const oneStep: ApprovalRequestDetail = {
      request: { ...contradictoryDetail.request, currentStepNo: 1, totalStepNo: 5 },
      steps: [contradictoryDetail.steps[0] as ApprovalStep],
    };

    expect(toRequestProgressView(oneStep, NO_REJECTION_CODES).positionText).toBe(
      t.progress.position(1, 5),
    );
  });
});
