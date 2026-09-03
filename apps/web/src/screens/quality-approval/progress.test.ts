import { messages } from '@omf-mes/i18n';
import { describe, expect, it } from 'vitest';

import { REJECTION_DECISION_CODES, toApprovalProgressView } from './progress';
import type { ApprovalRequest, ApprovalRequestDetail } from './types';

type Step = ApprovalRequestDetail['steps'][number];
const t = messages.qualityApproval;

const request = (overrides: Partial<ApprovalRequest> = {}): ApprovalRequest => ({
  approvalRequestId: 31,
  approvalRequestNo: 'SYNTH-REQ-031',
  approvalTypeCode: 'IQC_SKIP',
  requestedBy: 700_001,
  requestedByName: '합성 상신자',
  requestedAt: '2026-08-22T09:30:00+09:00',
  statusCode: 'SYNTH-PENDING',
  reason: '합성 근거',
  target: {
    targetTypeCode: 'INBOUND_LOT',
    targetId: 700_002,
    displayName: '합성 대상',
    openable: false,
  },
  currentStepNo: 4,
  totalStepNo: 9,
  isMyTurn: true,
  ...overrides,
});

const step = (overrides: Partial<Step> = {}): Step => ({
  stepNo: 7,
  approverId: 900_007,
  approverName: '합성 결재자',
  isMine: false,
  isCurrent: false,
  ...overrides,
});

describe('toApprovalProgressView', () => {
  it('모순 응답에서도 서버 위치·차례·단계 번호와 flags를 그대로 나른다', () => {
    const source: ApprovalRequestDetail = {
      request: request(),
      steps: [
        step({
          approverName: ' ',
          decisionCode:
            'SYNTH-UNKNOWN' as never /* 계약 밖 판정 — 지어내지 않고 그대로 두는지 잰다 */,
          decisionAt: '2026-08-22T15:02:00+09:00',
          decisionComment: '합성 결재 의견',
          isCurrent: true,
        }),
      ],
    };
    const before = structuredClone(source);

    expect(toApprovalProgressView(source)).toEqual({
      currentStepNo: 4,
      totalStepNo: 9,
      isMyTurn: true,
      steps: [
        {
          stepNo: 7,
          status: 'complete',
          approverName: t.values.unknownApprover,
          decisionCode:
            'SYNTH-UNKNOWN' as never /* 계약 밖 판정 — 지어내지 않고 그대로 두는지 잰다 */,
          decisionAtText: '2026-08-22 15:02',
          decisionComment: '합성 결재 의견',
          isCurrent: true,
          isMine: false,
        },
      ],
    });
    expect(source).toEqual(before);
    expect(JSON.stringify(toApprovalProgressView(source))).not.toContain('900007');
  });

  it('미결 단계는 server isCurrent로만 갈리고 isMine·요청 isMyTurn을 재계산하지 않는다', () => {
    const view = toApprovalProgressView({
      request: request({ currentStepNo: null, totalStepNo: 6, isMyTurn: false }),
      steps: [step({ isCurrent: true }), step({ stepNo: 11, isMine: true })],
    });

    expect(view.currentStepNo).toBeNull();
    expect(view.totalStepNo).toBe(6);
    expect(view.isMyTurn).toBe(false);
    expect(view.steps.map(({ stepNo, status, isMine }) => ({ stepNo, status, isMine }))).toEqual([
      { stepNo: 7, status: 'current', isMine: false },
      { stepNo: 11, status: 'pending', isMine: true },
    ]);
  });

  it('고정 반려 코드를 rejected로 바꾼다', () => {
    const detail: ApprovalRequestDetail = {
      request: request(),
      steps: [step({ decisionCode: 'REJECTED' })],
    };

    expect(REJECTION_DECISION_CODES).toEqual(['REJECTED']);
    expect(toApprovalProgressView(detail).steps[0]?.status).toBe('rejected');
    expect(toApprovalProgressView(detail, ['REJECTED']).steps[0]?.status).toBe('rejected');
  });

  it('단계가 없어도 서버의 종료 위치와 차례를 보존한다', () => {
    const view = toApprovalProgressView({
      request: request({ currentStepNo: null, totalStepNo: 3, isMyTurn: false }),
      steps: [],
    });

    expect(view).toMatchObject({ currentStepNo: null, totalStepNo: 3, isMyTurn: false, steps: [] });
  });
});
