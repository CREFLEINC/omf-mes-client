import { messages } from '@omf-mes/i18n';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { renderWithProviders } from '../../test/api-harness';
import { dispositionStub, requestedPaths } from './fixtures';
import { DispositionDecisionScreen } from './screen';

const t = messages.dispositionDecision;
const TODAY = new Date(2026, 7, 12);
const KST = 540;

type User = ReturnType<typeof userEvent.setup>;

const renderScreen = (route = '/quality/dispositions'): { user: User } => {
  renderWithProviders(<DispositionDecisionScreen today={TODAY} offsetMinutes={KST} />, {
    fetch: dispositionStub({ decidedQty: 200 }),
    route,
  });

  return { user: userEvent.setup() };
};

const pendingCalls = (): number =>
  requestedPaths().filter((path) => path.startsWith('/quality/nonconformances?')).length;

const historyCalls = (): number =>
  requestedPaths().filter((path) => path.startsWith('/quality/disposition-decisions')).length;

describe('DispositionDecisionScreen 탭', () => {
  it('두 탭을 보이고 기본은 판정 대기다', async () => {
    renderScreen();

    expect(await screen.findByRole('tab', { name: t.tabs.pending })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(screen.getByRole('tab', { name: t.tabs.history })).toHaveAttribute(
      'aria-selected',
      'false',
    );
  });

  it('⛔ 판정 대기 탭에서는 처리 이력을 부르지 않는다 — 보지 않는 목록이다', async () => {
    renderScreen();
    await screen.findByRole('button', { name: t.actions.selectRow('NC-TEST-0041') });

    expect(historyCalls()).toBe(0);
  });

  it('⛔ 처리 이력 탭에서는 판정 대기 목록을 부르지 않는다', async () => {
    renderScreen('/quality/dispositions?tab=history');

    await waitFor(() => {
      expect(historyCalls()).toBeGreaterThan(0);
    });
    expect(pendingCalls()).toBe(0);
  });

  it('처리 이력 탭은 판정일 기간을 반열림으로 싣는다', async () => {
    renderScreen('/quality/dispositions?tab=history');

    await waitFor(() => {
      const url = requestedPaths().find((path) =>
        path.startsWith('/quality/disposition-decisions'),
      );
      expect(url).toBeDefined();
      const params = new URLSearchParams(url?.split('?')[1] ?? '');
      expect(params.get('decidedFrom')).toBe('2026-07-14T00:00:00+09:00');
      expect(params.get('decidedTo')).toBe('2026-08-13T00:00:00+09:00');
    });
  });

  it('탭을 옮기면 그 탭의 목록을 부른다', async () => {
    const { user } = renderScreen();
    await screen.findByRole('button', { name: t.actions.selectRow('NC-TEST-0041') });

    await user.click(screen.getByRole('tab', { name: t.tabs.history }));

    await waitFor(() => {
      expect(historyCalls()).toBeGreaterThan(0);
    });
  });

  it('탭을 옮기면 고른 부적합을 지운다 — 탭마다 목록이 다르다', async () => {
    const { user } = renderScreen('/quality/dispositions?nonconformanceId=41');
    await screen.findByText('도장 표면 박리');

    await user.click(screen.getByRole('tab', { name: t.tabs.history }));
    await user.click(screen.getByRole('tab', { name: t.tabs.pending }));

    expect(await screen.findByText(t.detail.select)).toBeInTheDocument();
  });
});
