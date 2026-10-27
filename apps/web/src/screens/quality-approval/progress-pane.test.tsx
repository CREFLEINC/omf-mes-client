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
  it('결재 대기 요청은 서버 단계 번호와 상태를 가로(horizontal)/sm Stepper로 표시한다', () => {
    render(<ProgressPane view={view()} isFinished={false} />);
    const pane = screen.getByRole('group', { name: t.panes.progress });
    const list = within(pane).getByRole('list', { name: t.progress.steps });
    const items = [...list.querySelectorAll<HTMLElement>('li[data-status]')];

    expect(list).toHaveAttribute('data-orientation', 'horizontal');
    expect(list).toHaveAttribute('data-size', 'sm');
    expect(items.map((item) => item.dataset.status)).toEqual(['complete', 'current']);
    expect(
      items.map((item) => item.querySelector<HTMLElement>('span[aria-hidden="true"]')?.textContent),
    ).toEqual(['5', '9']);
    /* 모르는 결정 코드는 원문 그대로, 아는 코드는 사람 말로(#193). */
    expect(within(pane).getByText('SYNTH-UNKNOWN')).toBeVisible();
    expect(within(pane).getByText(t.progress.waitingCurrent)).toBeVisible();
    expect(within(pane).getByText('2026-08-22 15:02')).toBeVisible();
    expect(within(pane).getByText('합성 결재 의견')).toBeVisible();
    expect(items[1]).toHaveAttribute('aria-current', 'step');
  });

  it('현재 위치와 내 차례를 서버 값으로 한 줄에 밝힌다', () => {
    render(<ProgressPane view={view()} isFinished={false} />);

    expect(screen.getByText(t.progress.position(8, 12))).toBeVisible();
    expect(screen.getByText(t.progress.myTurn)).toBeVisible();
  });

  it('끝난 요청은 결재한 단계를 한 줄씩(결재자 · 결정 · 일시) 보이고 단계 그림을 세우지 않는다', () => {
    render(
      <ProgressPane
        isFinished
        view={view({
          isMyTurn: false,
          steps: [
            step({ stepNo: 1, decisionCode: 'APPROVED', decisionComment: '사용 승인' }),
            step({
              stepNo: 2,
              status: 'rejected',
              approverName: '합성 반려자',
              decisionCode: 'REJECTED',
              decisionAtText: '2026-08-23 09:11',
              decisionComment: '근거 부족',
            }),
          ],
        })}
      />,
    );
    const list = screen.getByRole('list', { name: t.progress.steps });
    const rows = within(list).getAllByRole('listitem');

    expect(list).not.toHaveAttribute('data-orientation');
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveTextContent('합성 결재자승인2026-08-22 15:02사용 승인');
    expect(rows[1]).toHaveTextContent('합성 반려자반려2026-08-23 09:11');
    /* 반려 사유는 요청 상세 끝 붉은 칸이 말한다 — 여기서 겹쳐 보이지 않는다. */
    expect(rows[1]).not.toHaveTextContent('근거 부족');
    expect(screen.queryByText(t.progress.notMyTurn)).toBeNull();
  });

  it('결재한 단계가 없는 종료 요청은 단계 없음 안내만 보인다', () => {
    render(<ProgressPane isFinished view={view({ isMyTurn: false, steps: [] })} />);

    expect(screen.getByText(t.progress.noSteps)).toBeVisible();
    expect(screen.queryByRole('list')).toBeNull();
  });
});
