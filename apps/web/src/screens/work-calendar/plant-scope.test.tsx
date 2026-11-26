import { screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { SessionProvider } from '../../patterns/session';
import { createStubFetch, jsonResponse, renderWithProviders } from '../../test/api-harness';
import { SYNTHETIC_SESSION } from '../../test/session-harness';
import {
  applicationsResponse,
  calendarsResponse,
  makeApplication,
  makeCalendar,
  plantsResponse,
} from './fixtures';
import { WorkCalendarScreen } from './screen';

const at = (path: string) => (request: Request) => new URL(request.url).pathname === path;

describe('작업 캘린더 — 사업부의 공장 것만', () => {
  afterEach(() => globalThis.localStorage.clear());

  it('다른 공장에만 적용된 캘린더는 빼고, 이 공장 것과 아직 적용되지 않은 것은 남긴다', async () => {
    const other = makeApplication({ workCalendarId: 1, targetId: 11 });
    const mine = makeApplication({ workCalendarId: 2, targetId: 12 });
    renderWithProviders(
      <SessionProvider>
        <WorkCalendarScreen initialMonth={{ year: 2026, month: 8 }} />
      </SessionProvider>,
      {
        session: { ...SYNTHETIC_SESSION, scopes: [] },
        fetch: createStubFetch([
          {
            match: at('/mdm/work-calendar-applications'),
            respond: (request) =>
              jsonResponse(
                applicationsResponse(
                  new URL(request.url).searchParams.get('plantId') === '12'
                    ? [mine]
                    : [other, mine],
                ),
              ),
          },
          {
            match: at('/mdm/work-calendars'),
            respond: () =>
              jsonResponse(
                calendarsResponse([
                  makeCalendar(1, 'CAL-OTHER'),
                  makeCalendar(2, 'CAL-MINE'),
                  makeCalendar(3, 'CAL-FREE'),
                ]),
              ),
          },
          {
            match: at('/mdm/code-values'),
            respond: () =>
              jsonResponse({ items: [{ code: 'PL-2' }], page: { page: 1, size: 100, total: 1 } }),
          },
          { match: at('/mdm/plants'), respond: () => jsonResponse(plantsResponse()) },
        ]),
      },
    );

    expect(await screen.findByText('CAL-MINE')).toBeInTheDocument();
    expect(screen.getByText('CAL-FREE')).toBeInTheDocument();
    expect(screen.queryByText('CAL-OTHER')).not.toBeInTheDocument();
  });
});
