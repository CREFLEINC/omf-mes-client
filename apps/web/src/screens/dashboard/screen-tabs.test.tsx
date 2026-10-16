import { messages } from '@omf-mes/i18n';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { createStubFetch, jsonResponse, renderWithProviders } from '../../test/api-harness';
import { quality } from './quality.fixture';
import { DashboardScreen } from './screen';

const t = messages.dashboard;

const summaryBody = {
  baseDate: '2026-10-16',
  asOf: '2026-10-16T03:00:00Z',
  cards: [],
  quality: quality(),
};

const isSummary = (request: Request): boolean =>
  new URL(request.url).pathname === '/app/dashboard-summary';

/**
 * 품질 탭은 **같은 집계 응답을 나눠 보인다**(omf-all-around#113 · 규격 보정) — 탭을 바꿔도 요청이
 * 더 나가지 않는다. 조건 줄은 탭 밖이라 모든 탭에 걸린다.
 */
describe('DashboardScreen — 탭', () => {
  it('대시보드 · 품질 종합 · IQC · PQC · OQC · 부적합 탭이 있고, 탭을 바꿔도 다시 부르지 않는다', async () => {
    const user = userEvent.setup();
    const fetch = vi.fn(
      createStubFetch([
        { match: isSummary, respond: () => jsonResponse(summaryBody) },
        {
          match: (request) => new URL(request.url).pathname === '/mdm/plants',
          respond: () => jsonResponse({ items: [], page: { page: 1, size: 100, total: 0 } }),
        },
      ]),
    );

    renderWithProviders(<DashboardScreen />, { fetch });

    for (const label of Object.values(t.tabs).slice(1)) {
      expect(screen.getByRole('tab', { name: label })).toBeInTheDocument();
    }
    await waitFor(() =>
      expect(fetch.mock.calls.some(([request]) => isSummary(request))).toBe(true),
    );
    const summaryCalls = (): number =>
      fetch.mock.calls.filter(([request]) => isSummary(request)).length;
    const before = summaryCalls();

    await user.click(screen.getByRole('tab', { name: t.tabs.pqc }));
    expect(await screen.findByRole('group', { name: t.quality.pendingLots })).toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: t.tabs.oqc }));
    expect(
      await screen.findByRole('group', { name: t.quality.customerReturn }),
    ).toBeInTheDocument();

    /* 조건 줄은 탭 밖에 있다. */
    expect(screen.getByRole('button', { name: t.filters.refresh })).toBeInTheDocument();
    expect(summaryCalls()).toBe(before);
  });
});
