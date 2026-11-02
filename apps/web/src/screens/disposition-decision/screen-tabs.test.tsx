import { messages } from '@omf-mes/i18n';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { SessionProvider } from '../../patterns/session';
import { renderWithProviders } from '../../test/api-harness';
import { SYNTHETIC_SESSION } from '../../test/session-harness';
import { dispositionStub, requestedPaths } from './fixtures';
import { DispositionDecisionScreen } from './screen';

const t = messages.dispositionDecision;
const TODAY = new Date(2026, 7, 12);
const KST = 540;

type User = ReturnType<typeof userEvent.setup>;

const renderScreen = (route = '/quality/dispositions'): { user: User } => {
  renderWithProviders(
    <SessionProvider>
      <DispositionDecisionScreen today={TODAY} offsetMinutes={KST} />
    </SessionProvider>,
    { session: SYNTHETIC_SESSION, fetch: dispositionStub({ decidedQty: 200 }), route },
  );

  return { user: userEvent.setup() };
};

const pendingCalls = (): number =>
  requestedPaths().filter((path) => path.startsWith('/quality/nonconformances?')).length;

const historyCalls = (): number =>
  requestedPaths().filter((path) => path.startsWith('/quality/disposition-decisions')).length;

describe('DispositionDecisionScreen 탭', () => {
  it('두 탭을 보이고 기본은 판정 대기다', async () => {
    renderScreen();

    /* 탭 줄 오른쪽 끝의 칩 둘(#223) — 켜진 칩이 지금 보는 쪽이다. */
    expect(await screen.findByRole('tab', { name: /^처분 대기/ })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(screen.getByRole('tab', { name: /^처분 이력/ })).toHaveAttribute(
      'aria-selected',
      'false',
    );
  });

  /* 탭 줄 칩은 두 목록의 건수를 함께 보인다(사용자 지시 · #223) — 보지 않는 쪽도 첫 쪽 하나는 부른다. */
  it('탭 옆 배지에 판정 대기 건수가 붙고, 처리 이력 건수를 위해 그 목록도 부른다', async () => {
    renderScreen();

    /* 건수는 탭 이름 옆 숫자 배지(#223) — 배지의 접근 이름으로 본다. */
    expect((await screen.findAllByLabelText(t.tabs.pendingCount(1))).length).toBeGreaterThan(0);
    await waitFor(() => {
      expect(historyCalls()).toBeGreaterThan(0);
    });
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
    await screen.findByText('NC-TEST-0041');

    await user.click(screen.getByRole('tab', { name: /^처분 이력/ }));

    await waitFor(() => {
      expect(historyCalls()).toBeGreaterThan(0);
    });
  });

  it('탭을 옮기면 고른 부적합을 지운다 — 탭마다 목록이 다르다', async () => {
    const { user } = renderScreen('/quality/dispositions?nonconformanceId=41');
    await screen.findByText('도장 표면 박리');

    await user.click(screen.getByRole('tab', { name: /^처분 이력/ }));
    await user.click(screen.getByRole('tab', { name: /^처분 대기/ }));

    expect(await screen.findByText(t.detail.select)).toBeInTheDocument();
  });
});
