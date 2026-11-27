import { messages } from '@omf-mes/i18n';
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { ProgressPane } from './progress-pane';
import { REJECTION_DECISION_CODES, toRequestProgressView } from './progress';
import type { ApprovalRequest, ApprovalStep } from './types';

const t = messages.approvalInbox;

const SYNTHETIC_REJECTION_CODE = 'REJECTED';

const step = (overrides: Partial<ApprovalStep> = {}): ApprovalStep => ({
  stepNo: 1,
  approverId: 9501,
  approverName: '합성 승인자1',
  isMine: false,
  isCurrent: false,
  ...overrides,
});

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

const renderPane = (
  steps: ApprovalStep[],
  overrides: Partial<ApprovalRequest> = {},
  rejectionCodes: readonly string[] = REJECTION_DECISION_CODES,
): HTMLElement => {
  render(
    <ProgressPane
      view={toRequestProgressView({ request: request(overrides), steps }, rejectionCodes)}
      isMyTurn={overrides.isMyTurn ?? false}
    />,
  );

  return screen.getByRole('group', { name: t.panes.progress });
};

/** 단계 한 줄(표의 줄). 상태는 `data-status` 로 싣는다. */
const stepLines = (pane: HTMLElement): HTMLElement[] => [
  ...pane.querySelectorAll<HTMLElement>('tbody tr[data-status]'),
];

describe('ProgressPane — 배치(#361 · 단계 · 결재자 · 상태 · 처리 일시 표)', () => {
  it('표 머리는 단계 · 결재자 · 상태 · 처리 일시다', () => {
    const pane = renderPane([step()]);

    expect(
      within(pane)
        .getAllByRole('columnheader')
        .map((th) => th.textContent),
    ).toEqual(['단계', '결재자', '상태', '처리 일시']);
  });

  it('의견은 표 아래 「결재 의견」 줄로, 단계가 여럿이면 어느 단계인지 붙인다', () => {
    const pane = renderPane(
      [
        step({ decisionCode: 'APPROVED', decisionComment: '합성 의견 가' }),
        step({ stepNo: 2, isCurrent: true }),
      ],
      { currentStepNo: 2, totalStepNo: 2 },
    );

    expect(within(pane).getByText(t.progress.stepCommentLabel(1))).toBeVisible();
    expect(within(pane).getByText('합성 의견 가')).toBeVisible();
    expect(within(pane).queryByText(t.progress.stepCommentLabel(2))).toBeNull();
  });

  it('단계가 하나면 의견 이름은 「결재 의견」이다', () => {
    const pane = renderPane([step({ decisionCode: 'APPROVED', decisionComment: '진행하세요.' })]);

    expect(within(pane).getByText(t.progress.commentLabel)).toBeVisible();
  });

  it('단계마다 「n단계」 줄에 승인자 · 상태 라벨이 선다', () => {
    const pane = renderPane([step({ isCurrent: true })]);

    expect(within(pane).getByText(t.progress.stepNo(1))).toBeVisible();
    const [line] = stepLines(pane);
    expect(line).toHaveTextContent('합성 승인자1');
    expect(line).toHaveTextContent(t.progress.waitingCurrent);
  });

  it('단계가 하나면 「n / m 단계」를 내지 않는다', () => {
    const pane = renderPane([step()]);

    expect(within(pane).queryByText(t.progress.position(1, 1))).toBeNull();
  });

  it('단계가 여럿이면 서버가 준 진행 위치를 그대로 낸다', () => {
    const pane = renderPane([step(), step({ stepNo: 2 })], { currentStepNo: 2, totalStepNo: 3 });

    expect(within(pane).getByText(t.progress.position(2, 3))).toBeVisible();
  });

  it('끝난 요청은 종료라고 적는다', () => {
    const pane = renderPane(
      [step({ decisionCode: 'APPROVED' }), step({ stepNo: 2, decisionCode: 'APPROVED' })],
      { currentStepNo: null, totalStepNo: 2 },
    );

    expect(within(pane).getByText(t.progress.finished(2))).toBeVisible();
  });

  it('내 차례면 제목 옆에 「내 결재 차례」 라벨, 아니면 없다 — 왜 아닌지는 지어내지 않는다', () => {
    renderPane([step()], { isMyTurn: true });
    expect(screen.getByText(t.progress.myTurnBadge)).toBeVisible();
  });

  it('내 차례가 아니면 라벨이 없다', () => {
    renderPane([step()], { isMyTurn: false });
    expect(screen.queryByText(t.progress.myTurnBadge)).toBeNull();
  });

  it('단계가 오지 않으면 그 사실을 적고 줄을 지어내지 않는다', () => {
    const pane = renderPane([]);

    expect(within(pane).getByText(t.progress.noSteps)).toBeVisible();
    expect(stepLines(pane)).toHaveLength(0);
  });

  it('오류 배너를 세우지 않는다 — 승인자가 없어 멈춘 요청은 오류가 아니라 안내다', () => {
    const pane = renderPane([step({ isCurrent: true }), step({ stepNo: 2 })], {
      currentStepNo: 1,
      totalStepNo: 2,
    });

    expect(within(pane).queryByRole('alert')).not.toBeInTheDocument();
    expect(within(pane).getByText(t.progress.waitingCurrent)).toBeVisible();
  });
});

describe('ProgressPane — 단계', () => {
  it('승인자 이름이 없으면 번호를 대신 내지 않는다', () => {
    const pane = renderPane([step({ approverName: '', approverId: 9501 })]);

    expect(within(pane).getByText(t.values.unknownApprover)).toBeVisible();
    expect(pane.textContent).not.toContain('9501');
  });

  it('결재 결과 코드는 상태 이름으로(APPROVED → 승인), 시각 · 의견은 그대로 낸다(#360)', () => {
    const pane = renderPane([
      step({
        decisionCode: 'APPROVED',
        decisionAt: '2026-08-06T15:02:00+09:00',
        decisionComment: '합성 결재 의견',
      }),
    ]);

    expect(within(pane).queryByText('APPROVED')).toBeNull();
    expect(within(pane).getByText('승인')).toBeVisible();
    expect(within(pane).getByText('2026-08-06 13:02')).toBeVisible();
    expect(within(pane).getByText('합성 결재 의견')).toBeVisible();
  });

  it('결재 전 단계는 상태를 글자로 말한다 — 색에만 기대지 않는다', () => {
    const pane = renderPane([step({ isCurrent: true }), step({ stepNo: 2 })]);

    expect(within(pane).getByText(t.progress.waitingCurrent)).toBeVisible();
    expect(within(pane).getByText(t.progress.waitingPending)).toBeVisible();
  });

  it('이름은 서버가 매긴 단계 번호다 — 배열 차례로 다시 매기지 않는다', () => {
    const pane = renderPane([step({ stepNo: 3 }), step({ stepNo: 7 })]);

    expect(within(pane).getByText(t.progress.stepNo(3))).toBeVisible();
    expect(within(pane).getByText(t.progress.stepNo(7))).toBeVisible();
  });

  it('진행 중인 단계에만 현재 표식이 붙는다', () => {
    const pane = renderPane([
      step({ decisionCode: 'APPROVED' }),
      step({ stepNo: 2, isCurrent: true }),
      step({ stepNo: 3 }),
    ]);

    expect(stepLines(pane).map((line) => line.getAttribute('aria-current'))).toEqual([
      null,
      'step',
      null,
    ]);
  });
});

describe('ProgressPane — 반려 자리표시', () => {
  it('고정 반려 코드는 반려로, 승인 코드는 완료로 그린다', () => {
    const pane = renderPane([
      step({ decisionCode: SYNTHETIC_REJECTION_CODE }),
      step({ stepNo: 2, decisionCode: 'APPROVED' }),
    ]);

    expect(stepLines(pane).map((line) => line.dataset.status)).toEqual(['rejected', 'complete']);
  });

  it('자리표시를 채우면 그 코드의 단계가 반려로 그려지고 결과는 글자로도 남는다', () => {
    const pane = renderPane(
      [
        step({ decisionCode: SYNTHETIC_REJECTION_CODE }),
        step({ stepNo: 2, decisionCode: 'APPROVED' }),
      ],
      {},
      [SYNTHETIC_REJECTION_CODE],
    );

    expect(stepLines(pane).map((line) => line.dataset.status)).toEqual(['rejected', 'complete']);
    expect(within(pane).getByText('반려')).toBeVisible();
  });
});
