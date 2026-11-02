import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { useLocation, useNavigate } from 'react-router';

import {
  createStubFetch,
  jsonResponse,
  renderWithProviders,
  type StubRoute,
} from '../../test/api-harness';
import type { InspectionLookup } from './lookups';
import { plantToday } from '../../patterns/plant-time';
import { InspectionResultInsightsScreen } from './screen';

const source = (value: string, label: string): InspectionLookup => ({
  entries: [{ value, label, isActive: true }],
  isError: false,
  isLoading: false,
  truncated: false,
  refetch: vi.fn(),
});
const lookups = {
  inspectionType: source('PQC', '공정검사'),
  item: source('101', '합성 품목'),
  process: source('501', '합성 공정'),
  judgment: source('REJECTED', '불합격'),
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
        <InspectionResultInsightsScreen lookups={lookups} />
        <LocationProbe />
      </>,
      { fetch: () => new Promise(() => undefined) },
    );

    await user.clear(screen.getByLabelText('시작일 선택'));
    await user.type(screen.getByLabelText('시작일 선택'), '2026-08-01');
    await user.clear(screen.getByLabelText('종료일 선택'));
    await user.type(screen.getByLabelText('종료일 선택'), '2026-08-31');
    await user.click(screen.getByRole('button', { name: '상세 보기 펼치기' }));
    await user.click(screen.getByLabelText('검사 유형 선택'));
    await user.click(screen.getByRole('option', { name: 'PQC (공정검사)' }));
    await user.click(screen.getByRole('checkbox', { name: '최종 회차' }));
    await user.click(screen.getByRole('button', { name: '조회' }));

    await waitFor(() => expect(screen.getByLabelText('현재 주소')).toHaveTextContent('rounds=all'));
  });

  /* 종합 판정은 조회 조건 칸이 아니라 칩이다 — 누르면 바로 걸리고 「전체」로 풀린다(사용자 2026-10-30 · #217). */
  it('종합 판정 칩(전체 · 판정별)으로 바로 거르고 「전체」로 푼다', async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <>
        <InspectionResultInsightsScreen lookups={lookups} />
        <LocationProbe />
      </>,
      { fetch: () => new Promise(() => undefined) },
    );

    expect(screen.queryByLabelText('종합 판정 선택', { selector: 'button, input' })).toBeNull();
    const chips = screen.getByRole('group', { name: '종합 판정 선택' });
    await user.click(within(chips).getByRole('button', { name: '불합격', pressed: false }));
    await waitFor(() =>
      expect(screen.getByLabelText('현재 주소')).toHaveTextContent('judgment=REJECTED'),
    );
    // 「전체」를 누르면 거르기가 풀린다 — 칩은 하나만 눌려 있다.
    expect(within(chips).getByRole('button', { name: '전체', pressed: false })).toBeVisible();
    await user.click(within(chips).getByRole('button', { name: '전체' }));
    await waitFor(() =>
      expect(screen.getByLabelText('현재 주소')).not.toHaveTextContent('judgment='),
    );
  });

  it('종합 판정 칩마다 지금 조건의 건수를 붙인다', async () => {
    const totals: Record<string, number> = { '': 12, REJECTED: 3 };
    renderWithProviders(<InspectionResultInsightsScreen lookups={lookups} />, {
      route: '/?from=2026-08-01&to=2026-08-31',
      fetch: (request) => {
        const url = new URL(request.url);
        if (
          url.pathname === '/quality/inspection-results' &&
          url.searchParams.get('size') === '1'
        ) {
          const total = totals[url.searchParams.get('overallJudgmentCode') ?? ''] ?? 0;
          return Promise.resolve(
            new Response(JSON.stringify({ items: [], page: { page: 1, size: 1, total } }), {
              headers: { 'content-type': 'application/json' },
            }),
          );
        }
        return new Promise(() => undefined);
      },
    });

    const chips = screen.getByRole('group', { name: '종합 판정 선택' });
    expect(await within(chips).findByRole('button', { name: '전체 12' })).toBeVisible();
    expect(await within(chips).findByRole('button', { name: '불합격 3' })).toBeVisible();
  });

  /* 조건 없이 들어오면 시작일 · 종료일을 오늘로 채운다(사용자 지시 · omf-all-around#217). */
  it('조건 없이 들어오면 기간이 오늘로 채워진다', async () => {
    renderWithProviders(
      <>
        <InspectionResultInsightsScreen lookups={lookups} />
        <LocationProbe />
      </>,
      { fetch: () => new Promise(() => undefined) },
    );

    const today = plantToday();
    await waitFor(() =>
      expect(screen.getByLabelText('현재 주소')).toHaveTextContent(`from=${today}&to=${today}`),
    );
    expect(screen.getByLabelText('시작일 선택')).toHaveValue(today);
    expect(screen.getByLabelText('종료일 선택')).toHaveValue(today);
  });

  it('기간을 비우면 모든 집계 요청을 fail-closed한다', () => {
    const calls: Request[] = [];
    renderWithProviders(<InspectionResultInsightsScreen lookups={lookups} />, {
      fetch: async (request) => (calls.push(request), jsonResponse({})),
      route: '/quality/inspection-results?from=&to=',
    });

    expect(screen.getByText('조회 기간 또는 LOT 번호를 입력해 주세요.')).toBeInTheDocument();
    /* 조회 칸의 「조회 조건」 제목은 두지 않는다(사용자 지시 · #217). */
    expect(screen.queryByRole('heading', { level: 2, name: '조회 조건' })).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: '검사 실적 요약' })).toBeVisible();
    expect(screen.getByRole('heading', { level: 2, name: '불량 분석' })).toBeVisible();
    expect(screen.getByRole('region', { name: '검사 결과 분석' })).toHaveClass(
      'inspection-results-insights-pane-empty',
    );
    expect(calls).toHaveLength(0);
  });

  it.each([
    ['비실재 날짜', '?from=2026-02-30&to=2026-03-31&type=PQC'],
    ['미확정 검사유형', '?from=2026-08-01&to=2026-08-31&type=UNKNOWN'],
  ])('%s 주소는 모든 집계 요청을 fail-closed한다', async (_name, search) => {
    const user = userEvent.setup();
    const calls: Request[] = [];
    renderWithProviders(<InspectionResultInsightsScreen lookups={lookups} />, {
      route: `/quality/inspection-results${search}`,
      fetch: async (request) => (calls.push(request), jsonResponse({})),
    });

    expect(screen.getByText('주소의 날짜 또는 코드 조건이 유효하지 않습니다')).toBeInTheDocument();
    await user.click(screen.getByRole('tab', { name: '불량 분포' }));
    expect(calls).toHaveLength(0);
  });

  it('option에 없는 판정 주소값은 모든 집계 요청을 fail-closed한다', async () => {
    const user = userEvent.setup();
    const calls: Request[] = [];
    renderWithProviders(<InspectionResultInsightsScreen lookups={lookups} />, {
      route: '/quality/inspection-results?from=2026-08-01&to=2026-08-31&type=PQC&judgment=UNKNOWN',
      fetch: async (request) => (calls.push(request), jsonResponse({})),
    });

    expect(
      await screen.findByText('주소의 날짜 또는 코드 조건이 유효하지 않습니다'),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('tab', { name: '불량 분포' }));
    expect(calls).toHaveLength(0);
  });

  it('lookup 준비 전 주소 code와 안전한 표시를 보존하고 요청은 fail-closed한다', () => {
    const calls: Request[] = [];
    renderWithProviders(
      <InspectionResultInsightsScreen
        lookups={{
          ...lookups,
          inspectionType: {
            ...lookups.inspectionType,
            entries: [],
            isLoading: true,
          },
        }}
      />,
      {
        route: '/quality/inspection-results?from=2026-08-01&to=2026-08-31&type=PQC',
        fetch: async (request) => (calls.push(request), jsonResponse({})),
      },
    );

    expect(screen.getByText('조회 조건 이름을 확인하는 중입니다')).toBeInTheDocument();
    expect(screen.getByLabelText('검사 유형 선택')).toHaveTextContent('이름 불러오는 중');
    expect(
      screen.queryByText('주소의 날짜 또는 코드 조건이 유효하지 않습니다'),
    ).not.toBeInTheDocument();
    expect(screen.queryByText('PQC')).not.toBeInTheDocument();
    expect(calls).toHaveLength(0);
  });

  it('잘린 lookup 밖의 주소 code를 미등록으로 단정하지 않고 fail-closed한다', () => {
    const calls: Request[] = [];
    renderWithProviders(
      <InspectionResultInsightsScreen
        lookups={{
          ...lookups,
          inspectionType: {
            ...lookups.inspectionType,
            entries: [],
            truncated: true,
          },
        }}
      />,
      {
        route: '/quality/inspection-results?from=2026-08-01&to=2026-08-31&type=OQC',
        fetch: async (request) => (calls.push(request), jsonResponse({})),
      },
    );

    expect(screen.getByText('조회 조건 이름을 확인하는 중입니다')).toBeInTheDocument();
    expect(screen.getByLabelText('검사 유형 선택')).toHaveTextContent('알 수 없음');
    expect(
      screen.queryByText('주소의 날짜 또는 코드 조건이 유효하지 않습니다'),
    ).not.toBeInTheDocument();
    expect(screen.queryByText('OQC')).not.toBeInTheDocument();
    expect(calls).toHaveLength(0);
  });

  it('유효 주소의 모든 캐시와 상세를 무효 주소에서 숨긴다', async () => {
    const user = userEvent.setup();
    const calls: URL[] = [];
    const capture = (request: Request): void => void calls.push(new URL(request.url));
    renderWithProviders(
      <>
        <InspectionResultInsightsScreen lookups={lookups} />
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
        <InspectionResultInsightsScreen lookups={lookups} />
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

    await user.click(screen.getByText('SAMPLE-REQUEST-801'));
    expect(await screen.findByRole('dialog', { name: '검사 결과 상세' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '다음' }));
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
