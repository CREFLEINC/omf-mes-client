import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { useLocation, useNavigate } from 'react-router';

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
const InvalidRouteButton = () => {
  const navigate = useNavigate();
  return (
    <button
      type="button"
      onClick={() =>
        navigate('?from=2026-08-01&to=2026-08-31&type=PQC&judgment=UNKNOWN&selected=701')
      }
    >
      무효 주소로 이동
    </button>
  );
};

describe('검사실적·검사결과 조회 조립', () => {
  it('재검 전체 보기를 주소 rounds=all로 보존한다', async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <>
        <InspectionResultInsightsScreen
          options={options}
          labels={labels}
          sourceAxisCode="PQC"
          onViewMeasurements={() => undefined}
        />
        <LocationProbe />
      </>,
      { fetch: () => new Promise(() => undefined) },
    );

    await user.type(screen.getByLabelText('시작일'), '2026-08-01');
    await user.type(screen.getByLabelText('종료일'), '2026-08-31');
    await user.click(screen.getByLabelText('검사유형'));
    await user.click(screen.getByRole('option', { name: '공정검사' }));
    await user.click(screen.getByRole('checkbox', { name: '최종 회차만' }));
    await user.click(screen.getByRole('button', { name: '조회' }));

    await waitFor(() => expect(screen.getByLabelText('현재 주소')).toHaveTextContent('rounds=all'));
  });

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

  it.each([
    ['비실재 날짜', '?from=2026-02-30&to=2026-03-31&type=PQC'],
    ['미확정 검사유형', '?from=2026-08-01&to=2026-08-31&type=UNKNOWN'],
  ])('%s 주소는 모든 집계 요청을 fail-closed한다', async (_name, search) => {
    const user = userEvent.setup();
    const calls: Request[] = [];
    renderWithProviders(
      <InspectionResultInsightsScreen
        options={options}
        labels={labels}
        sourceAxisCode="PQC"
        onViewMeasurements={() => undefined}
      />,
      {
        route: `/quality/inspection-results${search}`,
        fetch: async (request) => (calls.push(request), jsonResponse({})),
      },
    );

    expect(screen.getByText('주소의 날짜 또는 코드 조건이 유효하지 않습니다')).toBeInTheDocument();
    await user.click(screen.getByRole('tab', { name: '불량 분포' }));
    expect(calls).toHaveLength(0);
  });

  it('option에 없는 판정 주소값은 모든 집계 요청을 fail-closed한다', async () => {
    const user = userEvent.setup();
    const calls: Request[] = [];
    renderWithProviders(
      <InspectionResultInsightsScreen
        options={options}
        labels={labels}
        sourceAxisCode="PQC"
        onViewMeasurements={() => undefined}
      />,
      {
        route:
          '/quality/inspection-results?from=2026-08-01&to=2026-08-31&type=PQC&judgment=UNKNOWN',
        fetch: async (request) => (calls.push(request), jsonResponse({})),
      },
    );

    expect(
      await screen.findByText('주소의 날짜 또는 코드 조건이 유효하지 않습니다'),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('tab', { name: '불량 분포' }));
    expect(calls).toHaveLength(0);
  });

  it('유효 주소의 모든 캐시와 상세를 무효 주소에서 숨긴다', async () => {
    const user = userEvent.setup();
    const calls: URL[] = [];
    const capture = (request: Request): void => void calls.push(new URL(request.url));
    renderWithProviders(
      <>
        <InspectionResultInsightsScreen
          options={options}
          labels={labels}
          sourceAxisCode="PQC"
          onViewMeasurements={() => undefined}
        />
        <InvalidRouteButton />
      </>,
      {
        route: '/quality/inspection-results?from=2026-08-01&to=2026-08-31&type=PQC&selected=701',
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
            capture(request);
            return jsonResponse({ items: [row], page: { page: 1, size: 50, total: 1 } });
          }),
          pathRoute('/quality/inspection-results/defect-rate-trend', (request) => {
            capture(request);
            return jsonResponse({
              points: [{ bucket: '2026-08-01', inspectedQty: 30, rejectedQty: 3, defectRate: 10 }],
              asOf: '2026-08-31T09:31:00+09:00',
            });
          }),
          pathRoute('/quality/defect-records/distribution', (request) => {
            capture(request);
            return jsonResponse({
              nodes: [{ defectCodeId: 901, label: '합성 분포', recordCount: 1, defectQty: 2 }],
              groupBy: 'defectCode',
              asOf: '2026-08-31T09:32:00+09:00',
            });
          }),
          pathRoute('/quality/inspection-results/701', (request) => {
            capture(request);
            return jsonResponse(row);
          }),
          pathRoute('/quality/inspection-results/701/measurement-summary', (request) => {
            capture(request);
            return jsonResponse({ items: [], asOf: '2026-08-31T09:33:00+09:00' });
          }),
        ]),
      },
    );

    await screen.findByText('SAMPLE-REQUEST-801');
    expect(await screen.findByRole('img', { name: /2026-08-01 10%/ })).toBeInTheDocument();
    expect(await screen.findByRole('dialog', { name: '검사 결과 상세' })).toBeInTheDocument();
    await user.click(screen.getByRole('tab', { name: '불량 분포' }));
    expect(await screen.findByText('합성 분포')).toBeInTheDocument();
    const validCallCount = calls.length;

    await user.click(screen.getByRole('button', { name: '무효 주소로 이동' }));
    expect(
      await screen.findByText('주소의 날짜 또는 코드 조건이 유효하지 않습니다'),
    ).toBeInTheDocument();
    expect(screen.queryByText('SAMPLE-REQUEST-801')).not.toBeInTheDocument();
    expect(screen.queryByRole('group', { name: '검사실적 요약 카드' })).not.toBeInTheDocument();
    expect(screen.queryByText('합성 분포')).not.toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await user.click(screen.getByRole('tab', { name: '불량률 추이' }));
    expect(screen.queryByRole('img', { name: /2026-08-01 10%/ })).not.toBeInTheDocument();
    expect(calls).toHaveLength(validCallCount);
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
              calibrationExpiredCount: 1,
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
    await user.click(screen.getByRole('button', { name: '검교정 만료만 분리해 보기' }));
    await waitFor(() =>
      expect(screen.getByLabelText('현재 주소')).toHaveTextContent('calibration=only'),
    );
    expect(screen.getByLabelText('현재 주소')).not.toHaveTextContent('page=');
  });
});
