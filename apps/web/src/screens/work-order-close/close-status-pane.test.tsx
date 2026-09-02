import { messages } from '@omf-mes/i18n';
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { WorkOrderCloseStatusPane, type WorkOrderCloseStatusPaneState } from './close-status-pane';

const t = messages.workOrderClose.status;

const renderPane = (state: WorkOrderCloseStatusPaneState) =>
  render(<WorkOrderCloseStatusPane state={state} />);

describe('WorkOrderCloseStatusPane', () => {
  it('uses the exact localized vocabulary', () => {
    expect(t).toEqual({
      pane: '작업지시 마감 입력 상태',
      heading: '현재 입력 상태',
      loading: '현재 입력 조건을 확인하는 중입니다.',
      complete: '현재 입력 조건이 모두 갖춰졌습니다.',
      blockers: {
        OPEN_SESSION: '열린 작업 세션을 마감하세요.',
        REMAINDER_DISPOSITION_REQUIRED: '잔량 처리 방법을 선택하세요.',
        VARIANCE_REASON_REQUIRED: '변동 사유를 선택하세요.',
      },
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
});
