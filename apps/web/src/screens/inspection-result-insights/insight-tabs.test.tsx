import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import {
  createStubFetch,
  jsonResponse,
  renderWithProviders,
  type StubRoute,
} from '../../test/api-harness';
import { EMPTY_INSPECTION_INSIGHT_FILTERS, type InspectionInsightFilters } from './filters';
import { InsightTabs } from './insight-tabs';

const filters: InspectionInsightFilters = {
  ...EMPTY_INSPECTION_INSIGHT_FILTERS,
  from: '2026-08-01',
  to: '2026-08-31',
  inspectionTypeCode: 'PQC',
  itemId: '101',
};
const route = (path: string, respond: StubRoute['respond']): StubRoute => ({
  match: (request) => new URL(request.url).pathname === path,
  respond,
});

describe('검사 추이·불량 분포', () => {
  it('추이 탭은 서버 point 순서와 기준 시각을 Chart에 전달한다', async () => {
    const calls: URL[] = [];
    renderWithProviders(<InsightTabs filters={filters} sourceAxisCode="PQC" />, {
      fetch: createStubFetch([
        route('/quality/inspection-results/defect-rate-trend', (request) => {
          calls.push(new URL(request.url));
          return jsonResponse({
            points: [
              { bucket: '2026-08-02', inspectedQty: 20, rejectedQty: 2, defectRate: 10 },
              { bucket: '2026-08-01', inspectedQty: 10, rejectedQty: 1, defectRate: 10 },
            ],
            asOf: '2026-08-31T10:30:00+09:00',
          });
        }),
      ]),
    });

    const chart = await screen.findByRole('img', { name: /2026-08-02 10%.*2026-08-01 10%/ });
    expect(chart).toBeInTheDocument();
    expect(screen.getByText('기준 2026-08-31 10:30')).toBeInTheDocument();
    expect(calls).toHaveLength(1);
    expect(calls[0]?.searchParams.get('finalRoundOnly')).toBe('true');
  });

  it('분포 탭은 다른 모집단을 알리고 빈 응답에도 5열 골격을 유지한다', async () => {
    const user = userEvent.setup();
    const calls: URL[] = [];
    renderWithProviders(<InsightTabs filters={filters} sourceAxisCode="PQC" />, {
      fetch: createStubFetch([
        route('/quality/inspection-results/defect-rate-trend', () =>
          jsonResponse({ points: [], asOf: '2026-08-31T10:30:00+09:00' }),
        ),
        route('/quality/defect-records/distribution', (request) => {
          calls.push(new URL(request.url));
          return jsonResponse({
            nodes: [],
            groupBy: 'defectCode',
            asOf: '2026-08-31T10:31:00+09:00',
          });
        }),
      ]),
    });

    await user.click(screen.getByRole('tab', { name: '불량 분포' }));
    const table = await screen.findByRole('table', { name: '불량코드 분포' });
    expect(within(table).getAllByRole('columnheader')).toHaveLength(5);
    expect(within(table).getByText('분포 데이터가 없습니다')).toBeInTheDocument();
    expect(screen.getByText(/목록·요약·추이와 다른 모집단/)).toBeInTheDocument();
    expect(screen.getByText(/현재 담기지 않는 불량 원천/)).toBeInTheDocument();
    expect(screen.getByText('기준 2026-08-31 10:31')).toBeInTheDocument();
    expect(calls).toHaveLength(1);
    expect(Object.fromEntries(calls[0]?.searchParams ?? [])).toEqual({
      groupBy: 'defectCode',
      sourceAxisCode: 'PQC',
      itemId: '101',
      detectedFrom: '2026-08-01',
      detectedTo: '2026-08-31',
    });
  });
});
