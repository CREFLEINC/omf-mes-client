import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import {
  createStubFetch,
  jsonResponse,
  renderWithProviders,
  type StubRoute,
} from '../../test/api-harness';
import type { LookupSource } from '../../patterns/lookup-display';
import { ResultDetailDialog } from './result-detail-dialog';

const source = (value: string, label: string, isActive = true): LookupSource => ({
  entries: [{ value, label, isActive }],
  isError: false,
  isLoading: false,
});

const route = (path: string, respond: StubRoute['respond']): StubRoute => ({
  match: (request) => new URL(request.url).pathname === path,
  respond,
});
const detail = {
  inspectionResultId: 701,
  inspectionResultNo: 'SAMPLE-RESULT-701',
  inspectionRequestId: 801,
  inspectionRequestNo: 'SAMPLE-REQUEST-801',
  inspectionTypeCode: 'PQC',
  itemId: 101,
  lotId: 201,
  lotNo: 'SAMPLE-LOT-201',
  inspectionRound: 2,
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

const request = {
  inspectionRequestId: 801,
  inspectionRequestNo: 'SAMPLE-REQUEST-801',
  inspectionTypeCode: 'PQC',
  targetTypeCode: 'WORK_ORDER',
  targetId: 601,
  itemId: 101,
  targetQty: 30,
  requestedAt: '2026-08-12T09:00:00+09:00',
  statusCode: '접수',
};

const renderDialog = (routes: StubRoute[]) =>
  renderWithProviders(
    <ResultDetailDialog
      inspectionResultId={701}
      labels={{
        item: source('101', '합성 품목', false),
        judgment: source('REJECTED', '불합격'),
      }}
      onClose={vi.fn()}
      onViewMeasurements={vi.fn()}
    />,
    { fetch: createStubFetch(routes) },
  );

const emptySummary = route('/quality/inspection-results/701/measurement-summary', () =>
  jsonResponse({ asOf: '2026-08-31T11:30:00+09:00', items: [] }),
);

describe('검사 결과 상세 Dialog', () => {
  it('상세와 항목별 측정 요약을 서버 값으로 표시하고 남은 예시 수를 전체 건수로 계산한다', async () => {
    const onClose = vi.fn();
    const onViewMeasurements = vi.fn();
    let summaryRequests = 0;
    const { queryClient } = renderWithProviders(
      <ResultDetailDialog
        inspectionResultId={701}
        labels={{
          item: source('101', '합성 품목', false),
          judgment: source('REJECTED', '불합격'),
        }}
        onClose={onClose}
        onViewMeasurements={onViewMeasurements}
      />,
      {
        fetch: createStubFetch([
          route('/quality/inspection-results/701', () => jsonResponse(detail)),
          route('/quality/inspection-requests/801', () =>
            jsonResponse({ ...request, inspectionPlanVersionId: 4101 }),
          ),
          route('/quality/inspection-results/701/measurement-summary', () => {
            summaryRequests += 1;
            if (summaryRequests > 1)
              return jsonResponse({ message: 'synthetic error' }, { status: 500 });
            return jsonResponse({
              asOf: '2026-08-31T11:30:00+09:00',
              items: [
                {
                  inspectionItemSpecId: 901,
                  itemName: '합성 치수',
                  specText: '11.95 ~ 12.05 mm',
                  measuredCount: 30,
                  acceptedCount: 27,
                  rejectedCount: 2,
                  unmeasuredCount: 1,
                  outOfSpecValues: ['12.07', '12.09'],
                  outOfSpecTotalCount: 15,
                  equipmentName: '합성 캘리퍼',
                  equipmentCalibrationExpired: true,
                  equipmentCalibrationDueDate: '2026-07-28',
                },
                {
                  inspectionItemSpecId: 902,
                  itemName: '합성 중량',
                  specText: '98 ~ 102 g',
                  measuredCount: 30,
                  acceptedCount: 15,
                  rejectedCount: 15,
                  unmeasuredCount: 0,
                  outOfSpecValues: [],
                  outOfSpecTotalCount: 15,
                  equipmentName: null,
                  equipmentCalibrationExpired: false,
                  equipmentCalibrationDueDate: null,
                },
              ],
            });
          }),
        ]),
      },
    );

    const dialog = await screen.findByRole('dialog', { name: '검사 결과 상세' });
    expect(await within(dialog).findByText('SAMPLE-REQUEST-801')).toBeInTheDocument();
    expect(await within(dialog).findByText('4101')).toBeInTheDocument();
    expect(within(dialog).getByText('합성 품목 (미사용)')).toBeInTheDocument();
    expect(within(dialog).getByText('합성 치수')).toBeInTheDocument();
    const [summary, countOnlySummary] = within(dialog).getAllByRole('listitem');
    expect(summary).toBeDefined();
    expect(countOnlySummary).toBeDefined();
    expect(summary).toHaveTextContent('미측정 1건');
    expect(summary).toHaveTextContent('일부 예시: 12.07, 12.09 · 외 13건');
    expect(summary).not.toHaveTextContent('외 0건');
    expect(summary).toHaveTextContent('검교정 만료 · 예정일 2026-07-28');
    expect(countOnlySummary).toHaveTextContent('일부 예시: 외 15건');
    expect(within(dialog).getByText('기준 2026-08-31 11:30')).toBeInTheDocument();
    expect(within(dialog).queryByText('901')).not.toBeInTheDocument();

    await queryClient.refetchQueries({
      queryKey: ['inspection-result-insights', 'measurement-summary', 701],
    });
    expect(await within(dialog).findByText('측정 요약을 불러오지 못했습니다.')).toBeInTheDocument();
    expect(within(dialog).queryByText('합성 치수')).not.toBeInTheDocument();
    expect(within(dialog).queryByText('기준 2026-08-31 11:30')).not.toBeInTheDocument();

    await userEvent.click(within(dialog).getByRole('button', { name: '측정치 전체 보기' }));
    expect(onViewMeasurements).toHaveBeenCalledWith(701);
    await userEvent.click(within(dialog).getAllByRole('button', { name: '닫기' })[1]!);
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('기준 버전이 빈 의뢰는 「기준 없음」으로 그린다 — 못 읽은 값과 다른 모양이다', async () => {
    renderDialog([
      route('/quality/inspection-results/701', () => jsonResponse(detail)),
      route('/quality/inspection-requests/801', () =>
        jsonResponse({ ...request, inspectionPlanVersionId: null }),
      ),
      emptySummary,
    ]);

    const dialog = await screen.findByRole('dialog', { name: '검사 결과 상세' });
    expect(await within(dialog).findByText('기준 없음')).toBeInTheDocument();
  });

  it('의뢰를 못 읽으면 「기준 없음」이 아니라 모르는 값으로 그린다', async () => {
    renderDialog([
      route('/quality/inspection-results/701', () => jsonResponse(detail)),
      route('/quality/inspection-requests/801', () =>
        jsonResponse({ message: 'synthetic error' }, { status: 500 }),
      ),
      emptySummary,
    ]);

    const dialog = await screen.findByRole('dialog', { name: '검사 결과 상세' });
    expect(await within(dialog).findByText('SAMPLE-REQUEST-801')).toBeInTheDocument();
    expect(within(dialog).queryByText('기준 없음')).not.toBeInTheDocument();
    expect(within(dialog).getAllByText('미확인').length).toBeGreaterThan(0);
  });
});
