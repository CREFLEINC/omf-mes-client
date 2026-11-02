import { screen, waitFor, within } from '@testing-library/react';
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
    />,
    { fetch: createStubFetch(routes) },
  );

const emptySummary = route('/quality/inspection-results/701/measurement-summary', () =>
  jsonResponse({ asOf: '2026-08-31T11:30:00+09:00', items: [] }),
);

describe('검사 결과 상세 Dialog', () => {
  it('상세와 「항목별 측정 결과」 표를 서버 값으로 표시한다', async () => {
    const onClose = vi.fn();
    let summaryRequests = 0;
    const { queryClient } = renderWithProviders(
      <ResultDetailDialog
        inspectionResultId={701}
        labels={{
          item: source('101', '합성 품목', false),
          judgment: source('REJECTED', '불합격'),
        }}
        onClose={onClose}
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
          route('/quality/inspection-results/701/measurements', () =>
            jsonResponse({
              items: [
                {
                  inspectionMeasurementId: 1001,
                  inspectionItemSpecId: 901,
                  sampleNo: 1,
                  numericValue: 12.07,
                  judgmentCode: 'REJECTED',
                  measuredAt: '2026-08-12T10:22:00+09:00',
                  calibrationExpiredAtMeasurement: true,
                },
              ],
              page: { page: 1, size: 50, total: 1 },
            }),
          ),
          route('/quality/lot-hold-events', () =>
            jsonResponse({
              items: [
                {
                  lotHoldId: 801,
                  eventTypeCode: 'HELD',
                  occurredAt: '2026-08-12T10:30:00+09:00',
                  lotId: 201,
                  lotNo: 'SAMPLE-LOT-201',
                  actorId: 601,
                  actorName: '합성 처리자',
                  reasonCode: null,
                },
                {
                  lotHoldId: 802,
                  eventTypeCode: 'RELEASED',
                  occurredAt: '2026-08-12T11:30:00+09:00',
                  lotId: 201,
                  lotNo: 'SAMPLE-LOT-201',
                  actorId: 602,
                  actorName: '합성 해제자',
                  reasonCode: null,
                },
              ],
              page: { page: 1, size: 100, total: 2 },
            }),
          ),
          route('/trace/lot-status-events', () => jsonResponse({ items: [] })),
        ]),
      },
    );

    const dialog = await screen.findByRole('dialog', { name: '검사 결과 상세' });
    expect(await within(dialog).findByText('SAMPLE-REQUEST-801')).toBeInTheDocument();
    expect(await within(dialog).findByText('4101')).toBeInTheDocument();
    expect(within(dialog).getByText('합성 품목 (미사용)')).toBeInTheDocument();
    // 측정 결과는 「검사 상세 및 이력」 안의 탭 — 따로 여는 단추 · 창은 없다(사용자 2026-11-02).
    expect(within(dialog).getByRole('tab', { name: '항목별 측정 결과' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(within(dialog).getByRole('tab', { name: '처리 이력' })).toBeInTheDocument();
    expect(within(dialog).getByText('검사 공정')).toBeInTheDocument();
    const table = await within(dialog).findByRole('table', { name: '검사 측정치' });
    expect(within(table).getByText('합성 치수')).toBeInTheDocument();
    expect(within(table).getByText('12.07')).toBeInTheDocument();
    expect(within(table).getByText('검교정 만료')).toBeInTheDocument();
    expect(within(table).getByRole('columnheader', { name: '측정 일시' })).toBeInTheDocument();
    expect(within(dialog).getByRole('combobox', { name: '교정 상태 필터' })).toBeInTheDocument();
    expect(
      within(dialog).queryByRole('button', { name: '측정 결과 보기' }),
    ).not.toBeInTheDocument();
    // 처리 이력 탭 — LOT 상태 화면과 같은 표를 쓰되 열 이름은 이 창에서만 바꿔 부른다(사용자 2026-11-02).
    await userEvent.click(within(dialog).getByRole('tab', { name: '처리 이력' }));
    const history = await within(dialog).findByRole('table', { name: 'LOT 변경 이력' });
    for (const name of ['처리 일시', '처리 유형', '상태 변경', '처리자', '처리 사유'])
      expect(within(history).getByRole('columnheader', { name })).toBeInTheDocument();
    // 처리 일시 머리로 오름 · 내림차순을 바꾼다 — 처음은 최신이 위(사용자 2026-11-02).
    const actors = () =>
      within(history)
        .getAllByRole('row')
        .slice(1)
        .map((row) => (row.textContent.includes('합성 해제자') ? '해제' : '등록'));
    expect(actors()).toEqual(['해제', '등록']);
    await userEvent.click(within(history).getByRole('button', { name: /처리 일시/ }));
    expect(actors()).toEqual(['등록', '해제']);
    await userEvent.click(within(history).getByRole('button', { name: /처리 일시/ }));
    expect(actors()).toEqual(['해제', '등록']);
    await userEvent.click(within(dialog).getByRole('tab', { name: '항목별 측정 결과' }));
    // 「기준 …」 시각은 뺐다(사용자 2026-10-30).
    expect(within(dialog).queryByText(/^기준 \d/)).not.toBeInTheDocument();
    expect(within(dialog).queryByText('901')).not.toBeInTheDocument();

    await queryClient.refetchQueries({
      queryKey: ['inspection-result-insights', 'measurement-summary', 701],
    });
    expect(await within(dialog).findByText('측정 요약을 불러오지 못했습니다.')).toBeInTheDocument();
    expect(within(dialog).queryByText('합성 치수')).not.toBeInTheDocument();

    // 오른쪽 위 닫기(X)는 없다 — 꼬리말 [닫기] 하나(사용자 시안 2026-11-02).
    await userEvent.click(within(dialog).getByRole('button', { name: '닫기' }));
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
    // 기준 버전·샘플링 방식(omf-all-around#85) 두 칸 모두 「기준 없음」이다.
    expect(await within(dialog).findAllByText(/기준 없음/)).toHaveLength(2);
    // 기준이 없어 측정 대상이 아니면 「항목별 측정 결과」 탭을 두지 않는다(사용자 2026-11-02).
    await waitFor(() =>
      expect(within(dialog).queryByText('항목별 측정 결과')).not.toBeInTheDocument(),
    );
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
