import { messages } from '@omf-mes/i18n';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { WorkOrderCloseStatusPane, type WorkOrderCloseStatusPaneState } from './close-status-pane';

const t = messages.workOrderClose.status;

const renderPane = (state: WorkOrderCloseStatusPaneState) =>
  render(<WorkOrderCloseStatusPane state={state} />);

describe('WorkOrderCloseStatusPane', () => {
  it('uses the exact localized vocabulary', () => {
    expect(t.pane).toBe('작업지시 마감 입력 상태');
    expect(t.heading).toBe('현재 입력 상태');
    expect(t.loading).toBe('현재 입력 조건을 확인하는 중입니다.');
    expect(t.complete).toBe('현재 입력 조건이 모두 갖춰졌습니다.');
    expect(t.blockers).toEqual({
      STATUS_NOT_CLOSABLE:
        '이 작업지시는 지금 상태에서 마감할 수 없습니다. 진행·중단·완료 상태인 작업지시만 마감할 수 있으니, 목록의 상태를 확인하세요.',
      OPEN_SESSION: '열린 작업 세션(중단 포함)이 있어 마감할 수 없습니다.',
      REMAINDER_DISPOSITION_REQUIRED:
        '미달이라 잔량 처리를 골라야 마감할 수 있습니다. 위 「잔량 처리」에서 이월 또는 소멸을 고르세요.',
      VARIANCE_REASON_REQUIRED:
        '미달·초과라 변동 사유를 골라야 마감할 수 있습니다. 위 「변동 사유」에서 고르세요.',
    });
  });

  it('shows only named checking status for CHECKING', () => {
    renderPane({ kind: 'CHECKING' });

    expect(screen.getByRole('region', { name: t.pane })).toHaveClass(
      'pane',
      'work-order-close-status-pane',
    );
    expect(screen.getByRole('heading', { name: t.heading })).toBeVisible();
    expect(screen.getByRole('status', { name: t.loading })).toBeVisible();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.queryByText(t.complete)).not.toBeInTheDocument();
  });

  it('retains caller-owned unavailable content without interpretation', () => {
    renderPane({
      kind: 'UNAVAILABLE',
      content: <aside data-testid="caller-content">Synthetic caller content</aside>,
    });

    expect(screen.getByTestId('caller-content')).toHaveTextContent('Synthetic caller content');
    expect(screen.queryByRole('status', { name: t.loading })).not.toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.queryByText(t.complete)).not.toBeInTheDocument();
  });

  it('renders resolved empty blockers as a polite current-input status only', () => {
    renderPane({ kind: 'RESOLVED', blockers: [] });

    expect(screen.getByRole('status')).toHaveTextContent(t.complete);
    expect(screen.getByRole('status')).toHaveAttribute('aria-live', 'polite');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.queryByText(/작업지시를 마감할 수|최종 마감/)).not.toBeInTheDocument();
  });

  it('preserves resolved blocker order in one warning list', () => {
    renderPane({
      kind: 'RESOLVED',
      blockers: ['VARIANCE_REASON_REQUIRED', 'OPEN_SESSION', 'REMAINDER_DISPOSITION_REQUIRED'],
    });

    const alert = screen.getByRole('alert');
    const list = within(alert).getByRole('list');
    expect(alert.className).toContain('warning');
    expect(
      within(list)
        .getAllByRole('listitem')
        .map((item) => item.textContent),
    ).toEqual([
      t.blockers.VARIANCE_REASON_REQUIRED,
      t.blockers.OPEN_SESSION,
      t.blockers.REMAINDER_DISPOSITION_REQUIRED,
    ]);
    expect(screen.queryByRole('status', { name: t.loading })).not.toBeInTheDocument();
  });

  it.each<WorkOrderCloseStatusPaneState>([
    { kind: 'CHECKING' },
    { kind: 'UNAVAILABLE', content: <p>Unavailable</p> },
    { kind: 'RESOLVED', blockers: [] },
    { kind: 'RESOLVED', blockers: ['OPEN_SESSION'] },
  ])('has no actions for %o', (state) => {
    renderPane(state);

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('열린 세션이 막으면 단말·작업자·시작·상태를 한 칸에 하나씩 보이고 끝낼 곳과 다시 확인을 준다', async () => {
    const onRecheckSessions = vi.fn();
    render(
      <WorkOrderCloseStatusPane
        state={{ kind: 'RESOLVED', blockers: ['OPEN_SESSION'] }}
        openSessions={[
          {
            workSessionId: 1,
            terminalCode: 'POP-SYN-1',
            workerName: '합성 작업자',
            workerNo: '900028',
            startedAt: '2026-08-23T09:00:00+07:00',
            statusCode: 'STOPPED',
          },
          {
            workSessionId: 2,
            terminalCode: null,
            workerName: null,
            workerNo: null,
            startedAt: '2026-08-23T10:00:00+07:00',
            statusCode: 'RUNNING',
          },
        ]}
        onRecheckSessions={onRecheckSessions}
      />,
    );

    const rows = within(screen.getByRole('table', { name: t.sessions.label }))
      .getAllByRole('row')
      .slice(1)
      .map((row) =>
        within(row)
          .getAllByRole('cell')
          .map((cell) => cell.textContent),
      );
    expect(rows[0]).toEqual(['POP-SYN-1', '합성 작업자(900028)', '2026-08-23 09:00', '중단']);
    expect(rows[1]).toEqual([t.sessions.unknown, t.sessions.unknown, '2026-08-23 10:00', '진행']);
    expect(
      screen.getByText(t.sessions.action(messages.workHoldRegister.title)),
    ).toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole('button', { name: t.sessions.recheck }));
    expect(onRecheckSessions).toHaveBeenCalledTimes(1);
  });
});
