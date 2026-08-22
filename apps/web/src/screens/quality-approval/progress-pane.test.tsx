import { messages } from '@omf-mes/i18n';
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { ProgressPane } from './progress-pane';
import type { ApprovalProgressView, ApprovalStepView } from './progress';

const t = messages.qualityApproval;

const step = (overrides: Partial<ApprovalStepView> = {}): ApprovalStepView => ({
  stepNo: 5,
  status: 'complete',
  approverName: '합성 결재자',
  decisionCode: 'SYNTH-UNKNOWN',
  decisionAtText: '2026-08-22 15:02',
  decisionComment: '합성 결재 의견',
  isCurrent: true,
  isMine: false,
  ...overrides,
});

const view = (overrides: Partial<ApprovalProgressView> = {}): ApprovalProgressView => ({
  currentStepNo: 8,
  totalStepNo: 12,
  isMyTurn: true,
  steps: [
    step(),
    step({
      stepNo: 9,
      status: 'current',
      approverName: '합성 결재자 둘',
      decisionCode: null,
      decisionAtText: null,
      decisionComment: null,
      isMine: true,
    }),
  ],
  ...overrides,
});

describe('ProgressPane', () => {
  it('서버 단계 번호와 보이는 상태를 vertical/sm Stepper로 표시한다', () => {
    render(<ProgressPane view={view()} />);
    const pane = screen.getByRole('group', { name: t.panes.progress });
    const list = within(pane).getByRole('list', { name: t.progress.steps });
    const items = [...list.querySelectorAll<HTMLElement>('li[data-status]')];

    expect(list).toHaveAttribute('data-orientation', 'vertical');
    expect(list).toHaveAttribute('data-size', 'sm');
    expect(items.map((item) => item.dataset.status)).toEqual(['complete', 'current']);
    expect(
      items.map((item) => item.querySelector<HTMLElement>('span[aria-hidden="true"]')?.textContent),
    ).toEqual(['5', '9']);
    expect(within(pane).getByText('SYNTH-UNKNOWN')).toBeVisible();
    expect(within(pane).getByText(t.progress.waitingCurrent)).toBeVisible();
    expect(within(pane).getByText(t.progress.mine)).toBeVisible();
    expect(within(pane).getByText('2026-08-22 15:02')).toBeVisible();
    expect(within(pane).getByText('합성 결재 의견')).toBeVisible();
    expect(items[0]).toHaveTextContent('완료');
    expect(items[1]).toHaveAttribute('aria-current', 'step');
  });

  it('현재 위치와 내 차례를 서버 값으로 밝힌다', () => {
    render(<ProgressPane view={view()} />);

    expect(screen.getByText(t.progress.position(8, 12))).toBeVisible();
    expect(screen.getByText(t.progress.myTurn)).toBeVisible();
  });

  it('단계가 없는 종료 요청도 종료 위치와 내 차례 아님을 말한다', () => {
    render(
      <ProgressPane
        view={view({ currentStepNo: null, totalStepNo: 3, isMyTurn: false, steps: [] })}
      />,
    );

    expect(screen.getByText(t.progress.finished(3))).toBeVisible();
    expect(screen.getByText(t.progress.notMyTurn)).toBeVisible();
    expect(screen.getByText(t.progress.noSteps)).toBeVisible();
    expect(screen.queryByRole('list')).toBeNull();
  });
});
