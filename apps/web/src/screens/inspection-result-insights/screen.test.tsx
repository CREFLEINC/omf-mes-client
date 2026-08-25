import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { useLocation } from 'react-router';

import {
  createStubFetch,
  jsonResponse,
  renderWithProviders,
  type StubRoute,
} from '../../test/api-harness';
import { InspectionResultInsightsScreen } from './screen';

const options = {
  inspectionType: [{ value: 'PQC', label: '공정검사' }],
  item: [{ value: '101', label: '합성 품목' }],
  process: [{ value: '501', label: '합성 공정' }],
  judgment: [{ value: 'REJECTED', label: '불합격' }],
};
const labels = {
  item: new Map([[101, '합성 품목']]),
  judgment: new Map([['REJECTED', '불합격']]),
};
const row = {
  inspectionResultId: 701,
  inspectionResultNo: 'SAMPLE-RESULT-701',
  inspectionRequestId: 801,
  inspectionRequestNo: 'SAMPLE-REQUEST-801',
  inspectionTypeCode: 'PQC',
  itemId: 101,
  lotId: 201,
  lotNo: 'SAMPLE-LOT-201',
  inspectionRound: 1,
  inspectedQty: 30,
  acceptedQty: 27,
  rejectedQty: 2,
  heldQty: 1,
  uomId: 301,
  overallJudgmentCode: 'REJECTED',
  inspectorId: 401,
  inspectedAt: '2026-08-12T10:22:00+09:00',
  statusCode: '확정',
  processId: 501,
  processName: '합성 공정',
};
const pathRoute = (path: string, respond: StubRoute['respond']): StubRoute => ({
  match: (request) => new URL(request.url).pathname === path,
  respond,
});
const LocationProbe = () => <output aria-label="현재 주소">{useLocation().search}</output>;

describe('검사실적·검사결과 조회 조립', () => {
  it('기간·검사유형이 없으면 모든 집계 요청을 fail-closed한다', () => {
    const calls: Request[] = [];
    renderWithProviders(
      <InspectionResultInsightsScreen
        options={options}
        labels={labels}
        sourceAxisCode="PQC"
        onViewMeasurements={() => undefined}
      />,
      { fetch: async (request) => (calls.push(request), jsonResponse({})) },
    );

    expect(screen.getByText('기간과 검사유형을 선택하세요')).toBeInTheDocument();
    expect(calls).toHaveLength(0);
  });

  it('공통 모집단을 조회하고 선택 상세를 연 뒤 page 이동에서 선택을 정리한다', async () => {
    const user = userEvent.setup();
    const calls: URL[] = [];
    const capture = (request: Request): URL => {
      const url = new URL(request.url);
      calls.push(url);
      return url;
    };
    renderWithProviders(
      <>
        <InspectionResultInsightsScreen
          options={options}
          labels={labels}
          sourceAxisCode="PQC"
          onViewMeasurements={vi.fn()}
        />
        <LocationProbe />
      </>,
      {
        route: '/quality/inspection-results?from=2026-08-01&to=2026-08-31&type=PQC',
        fetch: createStubFetch([
          pathRoute('/quality/inspection-results/summary', (request) => {
            capture(request);
            return jsonResponse({
              inspectionCount: 1,
              inspectedQty: 30,
              acceptedQty: 27,
              rejectedQty: 2,
              heldQty: 1,
              defectRate: 6.67,
              finalRoundOnly: true,
              asOf: '2026-08-31T09:30:00+09:00',
            });
          }),
          pathRoute('/quality/inspection-results', (request) => {
            const url = capture(request);
            const page = Number(url.searchParams.get('page') ?? '1');
            return jsonResponse({
              items: page === 1 ? [row] : [],
              page: { page, size: 50, total: 51 },
            });
          }),
          pathRoute('/quality/inspection-results/defect-rate-trend', (request) => {
            capture(request);
            return jsonResponse({ points: [], asOf: '2026-08-31T09:31:00+09:00' });
          }),
          pathRoute('/quality/inspection-results/701', () => jsonResponse(row)),
          pathRoute('/quality/inspection-results/701/measurement-summary', () =>
            jsonResponse({ items: [], asOf: '2026-08-31T09:32:00+09:00' }),
          ),
        ]),
      },
    );

    await screen.findByText('SAMPLE-REQUEST-801');
    for (const path of [
      '/quality/inspection-results',
      '/quality/inspection-results/summary',
      '/quality/inspection-results/defect-rate-trend',
    ]) {
      const request = calls.find((url) => url.pathname === path);
      expect(request?.searchParams.get('inspectionTypeCode')).toBe('PQC');
      expect(request?.searchParams.get('finalRoundOnly')).toBe('true');
    }

    await user.click(screen.getByRole('button', { name: 'SAMPLE-REQUEST-801 상세 보기' }));
    expect(await screen.findByRole('dialog', { name: '검사 결과 상세' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '다음 쪽' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(screen.getByLabelText('현재 주소')).toHaveTextContent('page=2');
    expect(screen.getByLabelText('현재 주소')).not.toHaveTextContent('selected=');
  });
});
