import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { components } from '@omf-mes/api-client';
import { describe, expect, it, vi } from 'vitest';

import {
  createStubFetch,
  jsonResponse,
  renderWithProviders,
  type StubRoute,
} from '../../test/api-harness';
import { EMPTY_INSPECTION_INSIGHT_FILTERS, type InspectionInsightFilters } from './filters';
import { ResultOverview } from './result-overview';

const filters: InspectionInsightFilters = {
  ...EMPTY_INSPECTION_INSIGHT_FILTERS,
  from: '2026-08-01',
  to: '2026-08-31',
  inspectionTypeCode: 'IQC',
};
const row = (id: number, no: string): components['schemas']['InspectionResult'] => ({
  inspectionResultId: id,
  inspectionResultNo: `SAMPLE-RESULT-${id}`,
  inspectionRequestId: 900 + id,
  inspectionRequestNo: no,
  inspectionTypeCode: 'IQC',
  itemId: 101,
  lotId: 200 + id,
  lotNo: `SAMPLE-LOT-${id}`,
  inspectionRound: 1,
  inspectedQty: 30,
  acceptedQty: 28,
  rejectedQty: 2,
  heldQty: 0,
  uomId: 301,
  overallJudgmentCode: 'REJECTED',
  inspectorId: 401,
  inspectedAt: '2026-08-12T10:22:00+09:00',
  statusCode: '확정',
  processId: 501,
  processName: '합성 공정',
});
const route = (path: string, respond: StubRoute['respond']): StubRoute => ({
  match: (request) => new URL(request.url).pathname === path,
  respond,
});

describe('검사 결과 요약·목록', () => {
  it('같은 모집단의 5카드와 서버 순서의 7열 평면 목록을 표시한다', async () => {
    const user = userEvent.setup();
    const onSortChange = vi.fn();
    const onPageChange = vi.fn();
    const requests: URL[] = [];
    const routes = [
      route('/quality/inspection-results/summary', (request) => {
        requests.push(new URL(request.url));
        return jsonResponse({
          inspectionCount: 2,
          inspectedQty: 60,
          acceptedQty: 56,
          rejectedQty: 4,
          heldQty: 0,
          defectRate: 6.67,
          finalRoundOnly: true,
          asOf: '2026-08-31T09:30:00+09:00',
        });
      }),
      route('/quality/inspection-results', (request) => {
        requests.push(new URL(request.url));
        return jsonResponse({
          items: [row(2, 'SAMPLE-REQ-B'), row(1, 'SAMPLE-REQ-A')],
          page: { page: 1, size: 50, total: 51 },
        });
      }),
    ];

    renderWithProviders(
      <ResultOverview
        filters={filters}
        sort="inspectedAt,desc"
        page={1}
        labels={{
          item: new Map([[101, '합성 품목']]),
          judgment: new Map([['REJECTED', '불합격']]),
        }}
        onSortChange={onSortChange}
        onPageChange={onPageChange}
        onSelectResult={() => undefined}
      />,
      { fetch: createStubFetch(routes) },
    );

    expect(await screen.findByText('SAMPLE-REQ-B')).toBeInTheDocument();
    const table = screen.getByRole('table', { name: '검사 결과 목록' });
    expect(within(table).getAllByRole('columnheader')).toHaveLength(7);
    expect(within(table).getAllByRole('row')[1]).toHaveTextContent('SAMPLE-REQ-B');
    expect(within(table).getAllByRole('row')[2]).toHaveTextContent('SAMPLE-REQ-A');
    expect(within(table).getByRole('columnheader', { name: /검사시각\/회차/ })).toHaveAttribute(
      'aria-sort',
      'descending',
    );
    await user.click(within(table).getByRole('button', { name: /의뢰번호/ }));
    expect(onSortChange).toHaveBeenCalledWith('inspectionRequestNo,asc');
    await user.click(screen.getByRole('button', { name: '다음 쪽' }));
    expect(onPageChange).toHaveBeenCalledWith(2);
    const cards = screen.getByRole('group', { name: '검사실적 요약 카드' });
    for (const label of ['검사건수', '검사수량', '합격수량', '불합격수량', '불량률']) {
      expect(within(cards).getByText(label)).toBeInTheDocument();
    }
    expect(screen.getByText('기준 2026-08-31 09:30')).toBeInTheDocument();
    expect(screen.getByText('최종 회차만 집계합니다.')).toBeInTheDocument();
    expect(screen.queryByText('101')).not.toBeInTheDocument();
    expect(requests).toHaveLength(2);
    for (const request of requests) {
      expect(request.searchParams.get('inspectionTypeCode')).toBe('IQC');
      expect(request.searchParams.get('finalRoundOnly')).toBe('true');
    }
  });

  it('검사유형이 미확정이면 API를 호출하지 않는다', () => {
    const calls: Request[] = [];
    renderWithProviders(
      <ResultOverview
        filters={EMPTY_INSPECTION_INSIGHT_FILTERS}
        sort="inspectedAt,desc"
        page={1}
        labels={{ item: new Map(), judgment: new Map() }}
        onSortChange={() => undefined}
        onPageChange={() => undefined}
        onSelectResult={() => undefined}
      />,
      { fetch: async (request) => (calls.push(request), jsonResponse({})) },
    );

    expect(screen.getByText('기간과 검사유형을 선택하세요')).toBeInTheDocument();
    expect(calls).toHaveLength(0);
  });
});
