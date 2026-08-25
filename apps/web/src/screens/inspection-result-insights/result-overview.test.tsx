import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { components } from '@omf-mes/api-client';
import { describe, expect, it, vi } from 'vitest';
import { useState } from 'react';

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
    const onViewExpiredCalibration = vi.fn();
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
          calibrationExpiredCount: 2,
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
        onViewExpiredCalibration={onViewExpiredCalibration}
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
    expect(
      screen.getByText(/검교정 만료 장비 측정 건수 2건이 기본 집계에 포함/),
    ).toBeInTheDocument();
    expect(screen.queryByText(/검교정 만료 결과 2건/)).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '검교정 만료만 분리해 보기' }));
    expect(onViewExpiredCalibration).toHaveBeenCalledOnce();
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
        onViewExpiredCalibration={() => undefined}
      />,
      { fetch: async (request) => (calls.push(request), jsonResponse({})) },
    );

    expect(screen.getByText('기간과 검사유형을 선택하세요')).toBeInTheDocument();
    expect(calls).toHaveLength(0);
  });

  it('다음 page placeholder 동안 이전 page 행과 선택을 숨긴다', async () => {
    const user = userEvent.setup();
    const PendingPage = () => {
      const [page, setPage] = useState(1);
      return (
        <ResultOverview
          filters={filters}
          sort="inspectedAt,desc"
          page={page}
          labels={{ item: new Map([[101, '합성 품목']]), judgment: new Map() }}
          onSortChange={() => undefined}
          onPageChange={setPage}
          onSelectResult={() => undefined}
          onViewExpiredCalibration={() => undefined}
        />
      );
    };
    renderWithProviders(<PendingPage />, {
      fetch: async (request) => {
        const url = new URL(request.url);
        if (url.pathname.endsWith('/summary'))
          return jsonResponse({
            inspectionCount: 1,
            inspectedQty: 30,
            acceptedQty: 28,
            rejectedQty: 2,
            heldQty: 0,
            defectRate: 6.67,
            finalRoundOnly: true,
            asOf: '2026-08-31T09:30:00+09:00',
          });
        if (url.searchParams.get('page') === '2') return new Promise(() => undefined);
        return jsonResponse({
          items: [row(1, 'SAMPLE-PAGE-ONE')],
          page: { page: 1, size: 50, total: 51 },
        });
      },
    });

    await user.click(await screen.findByRole('button', { name: '다음 쪽' }));
    expect(
      await screen.findByRole('status', { name: '검사 결과 페이지를 불러오는 중' }),
    ).toBeInTheDocument();
    expect(screen.queryByText('SAMPLE-PAGE-ONE')).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'SAMPLE-PAGE-ONE 상세 보기' }),
    ).not.toBeInTheDocument();
  });

  it('재검 전체 보기에서 같은 페이지의 사슬을 회차 깊이로 표시한다', async () => {
    const root = row(1, 'SAMPLE-ROOT');
    const reinspection = {
      ...row(2, 'SAMPLE-REINSPECTION'),
      inspectionRequestId: root.inspectionRequestId,
      inspectionRound: 2,
      previousResultId: 1,
    };
    const allRounds = { ...filters, finalRoundOnly: false };
    const requests: URL[] = [];

    renderWithProviders(
      <ResultOverview
        filters={allRounds}
        sort="inspectedAt,desc"
        page={1}
        labels={{ item: new Map(), judgment: new Map() }}
        onSortChange={() => undefined}
        onPageChange={() => undefined}
        onSelectResult={() => undefined}
        onViewExpiredCalibration={() => undefined}
      />,
      {
        fetch: async (request) => {
          const url = new URL(request.url);
          requests.push(url);
          return url.pathname.endsWith('/summary')
            ? jsonResponse({
                inspectionCount: 1,
                inspectedQty: 30,
                acceptedQty: 28,
                rejectedQty: 2,
                heldQty: 0,
                defectRate: 6.67,
                finalRoundOnly: false,
                asOf: '2026-08-31T09:30:00+09:00',
              })
            : jsonResponse({
                items: [root, reinspection],
                page: { page: 1, size: 50, total: 1 },
              });
        },
      },
    );

    const rootLink = await screen.findByRole('button', { name: 'SAMPLE-ROOT 상세 보기' });
    const childLink = screen.getByRole('button', { name: 'SAMPLE-REINSPECTION 상세 보기' });
    expect(rootLink).toHaveAttribute('data-depth', '0');
    expect(childLink).toHaveAttribute('data-depth', '1');
    expect(childLink).toHaveStyle({ paddingInlineStart: '1rem' });
    expect(screen.getByText(/뿌리 결과 기준 페이지에서 재검 사슬 전체/)).toBeInTheDocument();
    for (const request of requests)
      expect(request.searchParams.get('finalRoundOnly')).toBe('false');
  });
});
