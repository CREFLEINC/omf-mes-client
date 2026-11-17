import { planningDaysResponse } from '../../../test/planning-day-fixture';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { PlanProposal } from '@omf-mes/api-client';
import { SessionProvider } from '../../../patterns/session';
import { renderWithProviders, jsonResponse } from '../../../test/api-harness';
import { SYNTHETIC_SESSION } from '../../../test/session-harness';
import { AutoPlanResultPage } from '../auto-plan-result-page';
const proposal: PlanProposal = {
  productionOrderId: 701,
  productionOrderNo: 'PD261106000001',
  plantId: 1,
  itemId: 1,
  uomId: 1,
  kind: 'NEW_PLAN',
  status: 'NEEDS_INPUT',
  reasons: [{ code: 'WORK_ORDER_LINE_REQUIRED', category: 'INPUT' }],
  orderQty: 100,
  confirmedPlanQty: 0,
  draftPlanQty: 0,
  remainingQty: 100,
  erpStorage: {
    erpStorageLocationCode: 'WH-A',
    warehouse: { id: 5, code: 'WH-A', name: '입고 창고 A' },
    location: {
      id: 50,
      code: 'K7PM-SYS-WHOLE',
      name: '창고 전체',
      systemRoleCode: 'WAREHOUSE_WHOLE',
    },
    reasonCode: null,
  },
  issues: [],
  basis: {
    calendar: '1',
    productionOrder: '1',
    plans: '1',
    bom: '1',
    routing: '1',
    resources: '1',
  },
  plans: [
    {
      proposalPlanKey: 'new-1',
      planSource: 'NEW',
      planDate: '2026-11-06',
      planDateSourceCode: 'SYSTEM',
      planDateCalendar: {
        date: '2026-11-06',
        statusCode: 'WORKING',
        sourceCode: 'WEEKLY_POLICY',
        workCalendarId: null,
        calendarCode: null,
        appliedProductionLineId: null,
        reasonCode: null,
        remarks: null,
        startTime: null,
        endTime: null,
        weeklyWorkingDays: 5,
      },
      planDateAdjustment: {
        originalDate: '2026-11-06',
        adjustedDate: null,
        outcomeCode: 'NOT_NEEDED',
        searchLimitDays: 31,
        skippedDays: [],
      },
      proposedQty: 100,
      uomId: 1,
      bomId: 1,
      bomCode: 'BOM-A',
      bomVersion: 1,
      routingId: 1,
      routingCode: 'RT-A',
      routingVersion: 1,
      plannedLineId: null,
      issues: [],
      workOrders: [
        {
          routingOperationId: 10,
          operationSeq: 10,
          operationName: '성형',
          processId: 1,
          processCode: 'PROC-01',
          proposedQty: 100,
          predecessors: [],
          plannedStartAt: '2026-11-06T08:00:00+07:00',
          plannedEndAt: '2026-11-07T08:00:00+07:00',
          equipmentRequired: false,
          moldRequired: false,
          productionLineId: null,
          plannedEquipmentId: null,
          plannedMoldId: null,
          responsibleWorkerId: null,
          plannedShiftId: null,
          defaultWipLocationId: null,
          defaultFgLocationId: 50,
          defaultFgLocationSource: 'ERP_STORAGE_LOCATION',
          defaultScrapLocationId: null,
          issues: [],
        },
      ],
    },
  ],
};
afterEach(() => vi.unstubAllGlobals());
describe('실제 결과 경로의 제안 조회', () => {
  it('실제 계약 GET 응답으로 시안을 표시하고 보완·보기 전환에도 업무 쓰기를 호출하지 않는다', async () => {
    const requests: Request[] = [];
    const fetch = async (input: RequestInfo | URL) => {
      const request = input instanceof Request ? input : new Request(input);
      requests.push(request);
      const url = new URL(request.url);
      if (url.pathname === '/planning/working-days:resolve') return planningDaysResponse(request);
      if (request.method !== 'GET') throw new Error('No business writes allowed');
      if (url.pathname.endsWith(':plan-proposals'))
        return jsonResponse({ items: [proposal], notFoundProductionOrderIds: [] });
      const items =
        url.pathname === '/mdm/plants'
          ? [{ plantId: 1, plantName: 'OA Plant' }]
          : url.pathname === '/mdm/uoms'
            ? [{ uomId: 1, uomCode: 'EA' }]
            : url.pathname === '/mdm/production-lines'
              ? [
                  {
                    productionLineId: 31,
                    plantId: 1,
                    lineCode: 'LINE-A',
                    lineName: '생산 라인 A',
                    isActive: true,
                  },
                ]
              : [];
      if (url.pathname === '/mdm/items/1')
        return jsonResponse({
          item: { itemId: 1, itemCode: 'ITEM-A', itemName: '실제 응답 품목' },
        });
      if (url.pathname === '/mdm/locations/50')
        return jsonResponse({
          location: {
            locationId: 50,
            warehouseId: 5,
            locationCode: 'SYS-WHOLE',
            locationName: '창고 전체',
            isActive: true,
          },
        });
      return jsonResponse({ items, page: { page: 1, size: 200, total: items.length } });
    };
    vi.stubGlobal('fetch', fetch);
    renderWithProviders(
      <SessionProvider>
        <AutoPlanResultPage />
      </SessionProvider>,
      {
        fetch,
        session: SYNTHETIC_SESSION,
        route: '/production/production-orders/auto-plan-results?ids=701',
        dataRouter: true,
      },
    );
    expect(await screen.findByRole('heading', { name: '생산계획 자동 전개 제안' })).toBeVisible();
    expect(screen.getAllByText('실제 응답 품목').length).toBeGreaterThan(0);
    expect(screen.getByText('OA Plant')).toBeVisible();
    const quantities = screen.getByRole('group', { name: 'ERP W/O 계획 수량' });
    expect(within(quantities).getByText('미확정 계획량').parentElement).toHaveTextContent('0 EA');
    expect(screen.queryByText('화면 미리보기')).toBeNull();
    const user = userEvent.setup();
    await user.click(screen.getByRole('tab', { name: '4M 배정' }));
    expect(screen.getByRole('region', { name: '생산품 입고 창고' })).toHaveTextContent(
      '입고 창고 A (WH-A)',
    );
    const operation = screen.getByRole('region', { name: '4M 배정 입력' });
    await user.click(within(operation).getByRole('button', { name: '생산 라인' }));
    const dialog = await screen.findByRole('dialog');
    await user.click(await within(dialog).findByText('생산 라인 A', { exact: true }));
    await user.click(within(dialog).getByRole('button', { name: '선택' }));
    expect(await screen.findByText('보완한 제안의 서버 재검증 필요')).toBeVisible();
    await user.click(screen.getByRole('tab', { name: '생산계획' }));
    expect(screen.getByRole('button', { name: '주간 편성' })).toBeVisible();
    expect(screen.getByRole('button', { name: '선택 제안 확정' })).toBeDisabled();
    await waitFor(() =>
      expect(
        requests.some((request) => new URL(request.url).pathname.endsWith(':plan-proposals')),
      ).toBe(true),
    );
    expect(
      new URL(
        requests.find((request) => new URL(request.url).pathname.endsWith(':plan-proposals'))!.url,
      ).searchParams.get('productionOrderIds'),
    ).toBe('701');
    expect(
      requests.every(
        (request) =>
          request.method === 'GET' ||
          (request.method === 'POST' &&
            new URL(request.url).pathname === '/planning/working-days:resolve'),
      ),
    ).toBe(true);
  });
});
