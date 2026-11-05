import { messages } from '@omf-mes/i18n';
import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import {
  createStubFetch,
  jsonResponse,
  renderWithProviders,
  type StubRoute,
} from '../../test/api-harness';
import { MaterialIssueStatusScreen } from './screen';

const t = messages.materialIssueStatus;

/** 004 생산 창고 보충(omf-all-around#230) 뒤에도 W-02-11 부족 탭은 W/O 요청만 본다. 값은 모두 합성이다. */
describe('W-02-11 출고 요청 현황 — 004 뒤 부족 탭', () => {
  it('R2-1 부족 탭은 출고 예정 조회에 requestTypeCode=WORK_ORDER 를 실어 창고 보충 요청이 섞이지 않게 한다', async () => {
    const stockQueries: URL[] = [];
    const routes: StubRoute[] = [
      {
        match: (request) => new URL(request.url).pathname === '/mdm/plants',
        respond: () =>
          jsonResponse({
            items: [
              {
                plantId: 8401,
                businessUnitId: 8301,
                legalEntityId: 8201,
                plantCode: 'G1',
                plantName: '합성 1공장',
                timezoneCode: 'Asia/Ho_Chi_Minh',
                isActive: true,
              },
            ],
            page: { page: 1, size: 200, total: 1 },
          }),
      },
      {
        match: (request) =>
          new URL(request.url).pathname === '/logistics/material-issue-requests/planned-stock',
        respond: (request) => {
          stockQueries.push(new URL(request.url));
          return jsonResponse({ items: [], unsourced: [] });
        },
      },
      {
        match: () => true,
        respond: () => jsonResponse({ items: [], page: { page: 1, size: 50, total: 0 } }),
      },
    ];

    renderWithProviders(<MaterialIssueStatusScreen />, {
      fetch: createStubFetch(routes),
      route: '/production/material-issue-status?view=shortage',
    });

    expect(await screen.findByRole('button', { name: t.views.shortage })).toBeInTheDocument();
    await screen.findByRole('group', { name: t.views.label });
    await expect.poll(() => stockQueries.length).toBeGreaterThan(0);
    expect(
      stockQueries.every((url) => url.searchParams.get('requestTypeCode') === 'WORK_ORDER'),
    ).toBe(true);
    expect(stockQueries[0]?.searchParams.get('onlyShortage')).toBe('true');
  });
});
