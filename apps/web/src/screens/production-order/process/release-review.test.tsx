import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { renderWithProviders, jsonResponse } from '../../../test/api-harness';
import { ReleaseReview, type ReleaseReviewPlan } from './release-review';
import type { ReleaseLine } from './release-step';
const plan: ReleaseReviewPlan = {
  productionPlanId: 1,
  productionOrderId: 1,
  planNo: 'PLAN-1',
  planDate: '2026-11-06',
  plannedQty: 100,
  uomId: 1,
  bomId: 2,
  routingId: 3,
  plannedLineId: 1,
  statusCode: 'CONFIRMED',
  confirmedAt: '2026-11-06T00:00:00Z',
  remarks: null,
  versionNo: 1,
  bomLabel: 'BOM-A (개정 1)',
  routingLabel: 'RT-A (개정 1)',
};
const line: ReleaseLine = {
  workOrder: {
    workOrderId: 11,
    workOrderNo: 'WO-11',
    productionPlanId: 1,
    operationName: '성형',
    orderQty: 100,
    uomId: 1,
    itemId: 1,
    statusCode: 'CONFIRMED',
    priorityNo: 1,
  },
  lotSizeText: '50',
  lotSize: 50,
  lotCount: 2,
  error: null,
  touched: false,
};
const detail = {
  ...line.workOrder,
  routingOperationId: 31,
  workOrderTypeCode: 'NORMAL',
  productionLineId: 1,
  plannedEquipmentId: 88,
  plannedMoldId: null,
  defaultFgLocationId: null,
  defaultScrapLocationId: null,
  plannedStartAt: '2026-11-06T01:00:00Z',
  plannedEndAt: '2026-11-06T10:00:00Z',
};
const renderReview = (required = false) => {
  const calls: string[] = [];
  renderWithProviders(
    <ReleaseReview
      plans={[plan]}
      lines={[line]}
      plantId={1}
      uomLabelOf={() => 'EA'}
      lineNameOf={() => '생산 라인 A (LINE-01)'}
    />,
    {
      session: null,
      fetch: async (request) => {
        expect(request.method).toBe('GET');
        const path = new URL(request.url).pathname;
        calls.push(path);
        if (path.endsWith('/production/work-orders/11')) return jsonResponse(detail);
        if (path.endsWith('/planning/routings/3/operations'))
          return jsonResponse({
            items: [
              {
                routingOperationId: 31,
                operationSeq: 10,
                operationName: '성형',
                equipmentRequired: required,
                moldRequired: false,
              },
            ],
          });
        if (path.endsWith('/mdm/equipments/88'))
          return jsonResponse({
            equipment: {
              equipmentId: 88,
              plantId: 1,
              equipmentCode: 'EQ-01',
              equipmentName: '설비 A',
              equipmentTypeCode: 'INJECTION',
              statusCode: 'AVAILABLE',
              isActive: true,
            },
          });
        throw new Error(`unexpected GET: ${path}`);
      },
    },
  );
  return calls;
};
describe('배포 전 최종 정보 확인', () => {
  it('저장된 계획·작업지시·필수4M을 함께 읽기 전용으로 표시한다', async () => {
    const calls = renderReview();
    expect(screen.getByRole('region', { name: '생산계획 정보' })).toBeInTheDocument();
    expect(screen.getByText('BOM-A (개정 1)')).toBeInTheDocument();
    expect(await screen.findByText('2026-11-06 08:00')).toBeInTheDocument();
    expect(screen.getByRole('region', { name: '4M 배정 확인' })).toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(screen.queryByText('설비 A (EQ-01)')).not.toBeInTheDocument();
    expect(calls.some((path) => path.includes('equipments'))).toBe(false);
  });
  it('Routing에서 필수인 설비만 조회하고 표시한다', async () => {
    renderReview(true);
    expect(await screen.findByText('설비 A (EQ-01)')).toBeInTheDocument();
    expect(
      within(screen.getByRole('region', { name: '4M 배정 확인' })).queryByText('작업자'),
    ).not.toBeInTheDocument();
  });
});
