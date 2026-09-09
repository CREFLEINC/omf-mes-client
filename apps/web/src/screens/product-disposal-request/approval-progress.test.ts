import type { components } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';
import { describe, expect, it } from 'vitest';

import { progressSummary, toProgressSteps } from './approval-progress';

type ApprovalRequest = components['schemas']['ApprovalRequest'];
type ApprovalStep = components['schemas']['ApprovalStep'];

const t = messages.productDisposalRequest.approval;

const request = (over: Partial<ApprovalRequest> = {}): ApprovalRequest => ({
  approvalRequestId: 5001,
  approvalRequestNo: 'AR-2026-000051',
  approvalTypeCode: 'GOODS_ISSUE_DISPOSAL',
  requestedBy: 12,
  requestedByName: '김물류',
  requestedAt: '2026-09-09T10:00:00+09:00',
  statusCode: 'PENDING',
  reason: '재작업 불가',
  target: {
    targetTypeCode: 'GOODS_ISSUE',
    targetId: 4001,
    displayName: 'GI-2026-000401',
    openable: true,
  },
  currentStepNo: 1,
  totalStepNo: 2,
  isMyTurn: false,
  ...over,
});

const step = (over: Partial<ApprovalStep> = {}): ApprovalStep => ({
  stepNo: 1,
  approverId: 21,
  approverName: '김품질',
  isMine: false,
  isCurrent: true,
  ...over,
});

describe('toProgressSteps — 결재선 진행', () => {
  /**
   * ⛔ **반려를 승인과 같은 「완료」로 접지 않는다.**
   *
   * 접으면 **반려된 요청이 승인된 것처럼 보인다.** 되돌릴 수 없는 폐기 앞에서 그 오독은 비싸다.
   */
  it('승인과 반려를 서로 다른 상태로 가른다', () => {
    const steps = toProgressSteps({
      request: request({ currentStepNo: null }),
      steps: [
        step({ stepNo: 1, decisionCode: 'APPROVED' }),
        step({ stepNo: 2, decisionCode: 'REJECTED', approverName: '이관리' }),
      ],
    });

    expect(steps[0]?.status).toBe('complete');
    expect(steps[1]?.status).toBe('rejected');
    expect(steps[0]?.description).toBe(t.approved);
    expect(steps[1]?.description).toBe(t.rejected);
  });

  /** ⚠ 계약이 「대기」를 값으로 두지 않는다 — 판정의 **부재**가 곧 대기다. */
  it('판정이 비었으면 지금 차례만 진행 중이고 나머지는 대기다', () => {
    const steps = toProgressSteps({
      request: request({ currentStepNo: 2 }),
      steps: [
        step({ stepNo: 1, decisionCode: 'APPROVED' }),
        step({ stepNo: 2, approverName: '이관리' }),
        step({ stepNo: 3, approverName: '박대표' }),
      ],
    });

    expect(steps[1]?.status).toBe('current');
    expect(steps[2]?.status).toBe('pending');
    expect(steps[2]?.description).toBe(t.waiting);
  });

  /**
   * ⚠ **응답 차례를 믿지 않는다.** 목이 자기모순인 상세를 내려준 전례가 있어 화면이 단계
   * 번호로 스스로 세운다.
   */
  it('응답이 뒤섞여 와도 단계 번호로 세운다', () => {
    const steps = toProgressSteps({
      request: request(),
      steps: [step({ stepNo: 3, approverName: '박대표' }), step({ stepNo: 1 })],
    });

    expect(steps.map((one) => one.icon)).toEqual([1, 3]);
  });

  /** ⚠ 이름이 비어 오면 그 사실을 적는다 — 번호를 이름 자리에 넣지 않는다(G-9). */
  it('승인자 이름이 비어 오면 그 사실을 적는다', () => {
    const steps = toProgressSteps({ request: request(), steps: [step({ approverName: '  ' })] });

    expect(steps[0]?.label).toBe(t.unknownApprover);
  });

  /** ⭐ 「내 차례」 표기를 나르지 않는다 — 나르면 이 화면이 결재함처럼 읽힌다(J-10). */
  it('내 차례 여부를 화면 값으로 나르지 않는다', () => {
    const steps = toProgressSteps({
      request: request(),
      steps: [step({ isMine: true, isCurrent: true })],
    });

    expect(JSON.stringify(steps)).not.toContain('isMine');
    expect(JSON.stringify(steps)).not.toContain('isMyTurn');
  });
});

describe('progressSummary — 진행 요약', () => {
  it('진행 중이면 몇 단계 중 몇 단계인지 말한다', () => {
    expect(progressSummary(request({ currentStepNo: 1, totalStepNo: 2 }))).toBe(t.inProgress(1, 2));
  });

  /**
   * ⛔ **「승인 완료」라고 말하지 않는다.**
   *
   * 반려로 끝난 요청도 단계가 비므로, **끝났다**와 **승인됐다**는 다르다(통지 #674).
   */
  it('단계가 끝나도 승인됐다고 말하지 않는다', () => {
    const text = progressSummary(request({ currentStepNo: null, totalStepNo: 2 }));

    expect(text).toBe(t.finished(2));
    expect(text).not.toContain('승인');
  });

  /** ⚠ 단계 수를 `steps.length` 로 세지 않는다 — 응답이 일부만 실어 줄 수 있다. */
  it('전체 단계 수를 계약이 준 값으로 말한다', () => {
    expect(progressSummary(request({ currentStepNo: 1, totalStepNo: 5 }))).toContain('5');
  });
});
