import { screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import {
  createStubFetch,
  jsonResponse,
  renderWithProviders,
  type StubRoute,
} from '../../test/api-harness';
import type { LookupSource } from '../../patterns/lookup-display';
import { EMPTY_INSPECTION_INSIGHT_FILTERS, type InspectionInsightFilters } from './filters';
import { ResultDetailDialog } from './result-detail-dialog';
import { ResultOverview } from './result-overview';

/* IQC 이력 상세 조회(omf-all-around#85) — LOT 번호로 찾기 · 검사자 · 상세 창 이력 구획. */

const source = (entries: LookupSource['entries'] = []): LookupSource => ({
  entries,
  isError: false,
  isLoading: false,
});
const labels = {
  item: source([{ value: '101', label: '합성 품목', isActive: true }]),
  judgment: source([{ value: 'REJECTED', label: '불합격', isActive: true }]),
};
const route = (path: string, respond: StubRoute['respond']): StubRoute => ({
  match: (request) => new URL(request.url).pathname === path,
  respond,
});
const page = (items: unknown[]) => ({ items, page: { page: 1, size: 50, total: items.length } });

const result = {
  inspectionResultId: 701,
  inspectionResultNo: 'SAMPLE-RESULT-701',
  inspectionRequestId: 801,
  inspectionRequestNo: 'SAMPLE-IRQ-801',
  inspectionTypeCode: 'IQC',
  itemId: 101,
  lotId: 201,
  lotNo: 'SAMPLE-LOT-201',
  inspectionRound: 1,
  inspectedQty: 10,
  acceptedQty: 6,
  rejectedQty: 4,
  heldQty: 0,
  uomId: 301,
  overallJudgmentCode: 'REJECTED',
  inspectorId: 401,
  inspectorName: '합성 검사원',
  inspectedAt: '2026-08-12T10:22:00+09:00',
  statusCode: 'CONFIRMED',
};

const renderOverview = (filters: InspectionInsightFilters, routes: StubRoute[]) =>
  renderWithProviders(
    <ResultOverview
      filters={filters}
      sort="inspectedAt,desc"
      page={1}
      labels={labels}
      onSortChange={vi.fn()}
      onPageChange={vi.fn()}
      onSelectResult={vi.fn()}
      onViewExpiredCalibration={vi.fn()}
    />,
    { fetch: createStubFetch(routes) },
  );

describe('W-03-05 LOT 번호로 찾기 (omf-all-around#85)', () => {
  const lotOnly: InspectionInsightFilters = {
    ...EMPTY_INSPECTION_INSIGHT_FILTERS,
    lotNo: 'SAMPLE-LOT-201',
  };

  it('LOT 번호만으로 기간 없이 그 LOT 의 결과를 묻고, 검사자 이름을 열로 보인다', async () => {
    const listQueries: URLSearchParams[] = [];
    const lotQueries: URLSearchParams[] = [];
    renderOverview(lotOnly, [
      route('/trace/lots', (request) => {
        lotQueries.push(new URL(request.url).searchParams);
        return jsonResponse(page([{ lotId: 201, lotNo: 'SAMPLE-LOT-201' }]));
      }),
      route('/quality/inspection-results', (request) => {
        listQueries.push(new URL(request.url).searchParams);
        return jsonResponse(page([result]));
      }),
    ]);

    const table = await screen.findByRole('table', { name: '검사 결과 목록' });
    expect(within(table).getByRole('columnheader', { name: '검사자' })).toBeInTheDocument();
    expect(within(table).getByText('합성 검사원')).toBeInTheDocument();
    expect(lotQueries[0]?.get('lotNo')).toBe('SAMPLE-LOT-201');
    expect(listQueries[0]?.get('lotId')).toBe('201');
    expect(listQueries[0]?.has('inspectedFrom')).toBe(false);
    // 집계는 기간이 필수라 비워 두고 그렇다고 말한다 · LOT 조건은 목록에만 건다.
    expect(screen.getByText('기간을 정하면 검사실적 요약이 보입니다.')).toBeInTheDocument();
    expect(screen.getByText(/LOT 조건은 아래 검사 결과 목록에만 적용됩니다/)).toBeInTheDocument();
  });

  it('없는 LOT 번호면 목록을 묻지 않고 찾을 수 없다고 말한다', async () => {
    const list = vi.fn(() => jsonResponse(page([])));
    renderOverview(lotOnly, [
      route('/trace/lots', () => jsonResponse(page([]))),
      route('/quality/inspection-results', list),
    ]);

    expect(
      await screen.findByText('LOT SAMPLE-LOT-201 을(를) 찾을 수 없습니다'),
    ).toBeInTheDocument();
    expect(list).not.toHaveBeenCalled();
  });
});

const request = {
  inspectionRequestId: 801,
  inspectionRequestNo: 'SAMPLE-IRQ-801',
  inspectionTypeCode: 'IQC',
  targetTypeCode: 'LOT',
  targetId: 201,
  itemId: 101,
  lotId: 201,
  targetQty: 10,
  requestedAt: '2026-08-12T09:00:00+09:00',
  statusCode: 'COMPLETED',
  inspectionPlanVersionId: 901,
};

const codes = (group: string) =>
  group === 'INSPECTION_SAMPLING_METHOD'
    ? [{ code: 'SAMPLE_BY_LOT', codeName: 'LOT 샘플링', displayOrder: 1, isActive: true }]
    : group === 'NONCONFORMANCE_STATUS'
      ? [{ code: 'PENDING_DECISION', codeName: '판정 대기', displayOrder: 1, isActive: true }]
      : [];

describe('W-03-05 상세 창 이력 구획 (omf-all-around#85)', () => {
  it('검사자·샘플링 방식 · 그 회차 불량 사유 · 그 LOT 의 부적합별 처분 판정을 보인다', async () => {
    renderWithProviders(
      <ResultDetailDialog
        inspectionResultId={701}
        labels={labels}
        onClose={vi.fn()}
        onViewMeasurements={vi.fn()}
      />,
      {
        fetch: createStubFetch([
          route('/quality/inspection-results/701', () => jsonResponse(result)),
          route('/quality/inspection-requests/801', () => jsonResponse(request)),
          route('/quality/inspection-results/701/measurement-summary', () =>
            jsonResponse({ asOf: '2026-08-31T11:30:00+09:00', items: [] }),
          ),
          route('/quality/inspection-plan-versions/901', () =>
            jsonResponse({
              inspectionPlanVersion: {
                inspectionPlanVersionId: 901,
                inspectionPlanId: 91,
                planVersion: 1,
                effectiveFrom: '2026-01-01',
                samplingMethodCode: 'SAMPLE_BY_LOT',
                inspectionFrequencyCode: 'EVERY_LOT',
                statusCode: 'CONFIRMED',
              },
              editability: {},
            }),
          ),
          route('/mdm/code-values', (req) =>
            jsonResponse(page(codes(new URL(req.url).searchParams.get('codeGroupCode') ?? ''))),
          ),
          route('/quality/defect-records', () =>
            jsonResponse(
              page([
                {
                  defectRecordId: 1,
                  inspectionResultId: 701,
                  workOrderId: null,
                  defectCodeId: 11,
                  suspectedCauseCodeId: 21,
                  defectDescription: '표면 긁힘',
                  defectQty: 4,
                  uomId: 301,
                  occurrenceProcessId: 1,
                  detectionProcessId: 1,
                  detectedAt: '2026-08-12T10:22:00+09:00',
                },
              ]),
            ),
          ),
          route('/quality/defect-codes', () =>
            jsonResponse(
              page([
                { defectCodeId: 11, defectCode: 'D-SCR', defectName: '스크래치', isActive: true },
              ]),
            ),
          ),
          route('/quality/cause-codes', () =>
            jsonResponse(
              page([
                { causeCodeId: 21, causeCode: 'C-SUP', causeName: '공급사 공정', isActive: true },
              ]),
            ),
          ),
          route('/quality/nonconformances', (req) => {
            expect(new URL(req.url).searchParams.get('lotId')).toBe('201');
            return jsonResponse(
              page([
                {
                  nonconformanceId: 31,
                  nonconformanceNo: 'SAMPLE-NC-31',
                  itemId: 101,
                  sourceCode: 'PRODUCT',
                  severityCode: 'MAJOR',
                  description: '수입검사 불합격',
                  statusCode: 'PENDING_DECISION',
                  openedAt: '2026-08-12T10:30:00+09:00',
                  affectedQtyTotal: 4,
                  uomId: 301,
                  dispositionProgressCode: 'PARTIAL',
                  lots: [],
                },
              ]),
            );
          }),
          route('/quality/nonconformances/31/disposition-decisions', () =>
            jsonResponse({
              ...page([
                {
                  dispositionDecisionId: 41,
                  nonconformanceId: 31,
                  dispositionTypeCode: 'SCRAP',
                  decisionQty: 4,
                  uomId: 301,
                  reason: '수리 불가',
                  decidedBy: 1,
                  decidedAt: '2026-08-13T09:00:00+09:00',
                  followUpStatusCode: 'NOT_STARTED',
                  followUpQty: 0,
                },
              ]),
              summary: {},
            }),
          ),
        ]),
      },
    );

    const dialog = await screen.findByRole('dialog', { name: '검사 결과 상세' });
    expect(await within(dialog).findByText('합성 검사원')).toBeInTheDocument();
    expect(await within(dialog).findByText('LOT 샘플링')).toBeInTheDocument();

    const defects = await within(dialog).findByRole('table', { name: '이 회차의 불량 사유' });
    expect(within(defects).getByText('D-SCR · 스크래치')).toBeInTheDocument();
    expect(within(defects).getByText('C-SUP · 공급사 공정')).toBeInTheDocument();
    expect(within(defects).getByText('표면 긁힘')).toBeInTheDocument();

    expect(await within(dialog).findByText(/SAMPLE-NC-31 · 판정 대기/)).toBeInTheDocument();
    const decisions = within(dialog).getByRole('table', { name: 'SAMPLE-NC-31 처분 판정 이력' });
    expect(within(decisions).getByText('폐기')).toBeInTheDocument();
    expect(within(decisions).getByText('수리 불가')).toBeInTheDocument();
  });

  it('LOT 이 없는 검사(PQC 등)는 불합격 처리·LOT 상태 이력이 없다고 말한다', async () => {
    renderWithProviders(
      <ResultDetailDialog
        inspectionResultId={701}
        labels={labels}
        onClose={vi.fn()}
        onViewMeasurements={vi.fn()}
      />,
      {
        fetch: createStubFetch([
          route('/quality/inspection-results/701', () =>
            jsonResponse({
              ...result,
              inspectionTypeCode: 'PQC',
              lotId: undefined,
              lotNo: undefined,
            }),
          ),
        ]),
      },
    );

    const dialog = await screen.findByRole('dialog', { name: '검사 결과 상세' });
    expect(
      await within(dialog).findByText('LOT 이 없는 검사라 표시할 이력이 없습니다.'),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByText('LOT 이 없는 검사라 LOT 상태 이력이 없습니다.'),
    ).toBeInTheDocument();
  });
});
