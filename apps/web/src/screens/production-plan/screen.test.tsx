import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { jsonResponse, renderWithProviders, type StubFetch } from '../../test/api-harness';
import { ProductionPlanScreen } from './screen';

const order = {
  productionOrderId: 701,
  productionOrderNo: 'PO-SYN-701',
  itemId: 4101,
  orderQty: 125,
  uomId: 8101,
  plantId: 3101,
  dueDate: '2026-09-01',
  statusCode: 'RELEASED',
};
const bom = {
  bomId: 8201,
  parentItemId: 4101,
  bomCode: 'BOM-SYN-01',
  bomVersion: 3,
  statusCode: 'ACTIVE',
  isDefault: true,
  effectiveFrom: '2026-01-01',
  baseQty: 1,
  baseUomId: 8101,
};
const routing = (routingId: number) => ({
  routingId,
  itemId: 4101,
  routingCode: `ROUTE-SYN-${String(routingId)}`,
  routingVersion: 1,
  statusCode: 'ACTIVE',
});

describe('ProductionPlanScreen', () => {
  it.each([null, '', '0', '-1', '1.5', '9007199254740992'])(
    '잘못된 P/O ID %s는 요청 없이 선택 화면으로 보낸다',
    (raw) => {
      let requested = false;
      const fetch: StubFetch = async () => {
        requested = true;
        throw new Error('invalid ID must not dispatch');
      };
      renderWithProviders(<ProductionPlanScreen />, {
        fetch,
        route: `/production/production-plans${raw === null ? '' : `?productionOrderId=${raw}`}`,
      });

      expect(screen.getByText('생산 P/O를 먼저 선택하세요.')).toBeVisible();
      expect(screen.getByRole('link', { name: 'P/O 수신·조회로 이동' })).toBeVisible();
      expect(requested).toBe(false);
    },
  );

  it('P/O와 전체 참조를 연결하고 Routing 선택 뒤 계획 추가를 허용한다', async () => {
    const user = userEvent.setup();
    let failedPath = '';
    let wrongOwner = false;
    let wrongPlanRequested = false;
    const fetch: StubFetch = async (request) => {
      const url = new URL(request.url);
      if (url.pathname === failedPath)
        return jsonResponse({ message: 'synthetic failure' }, { status: 503 });
      if (url.pathname === '/planning/production-orders/701')
        return jsonResponse(wrongOwner ? { ...order, productionOrderId: 702 } : order);
      if (url.pathname === '/mdm/items/4101') {
        return jsonResponse({ item: { itemId: 4101, itemCode: 'ITEM-01', itemName: '합성 품목' } });
      }
      if (url.pathname === '/mdm/uoms') {
        return jsonResponse({
          items: [{ uomId: 8101, uomCode: 'EA', uomName: '개' }],
          page: { page: 1, size: 25, total: 1 },
        });
      }
      if (url.pathname === '/planning/boms') return jsonResponse({ items: [bom] });
      if (url.pathname === '/planning/routings') {
        return jsonResponse({ items: [routing(8301), routing(8302)] });
      }
      if (url.pathname === '/mdm/production-lines') {
        return jsonResponse({
          items: [
            {
              productionLineId: 9101,
              plantId: 3101,
              lineCode: 'LINE-01',
              lineName: '합성 라인',
              lineTypeCode: 'LINE',
              isActive: false,
            },
          ],
          page: { page: 1, size: 100, total: 1 },
        });
      }
      if (url.pathname === '/planning/production-plans') {
        if (url.searchParams.get('productionOrderId') === '702') wrongPlanRequested = true;
        return jsonResponse({ items: [], page: { page: 1, size: 100, total: 0 } });
      }
      throw new Error(`unexpected request: ${request.method} ${request.url}`);
    };
    const { queryClient } = renderWithProviders(<ProductionPlanScreen />, {
      fetch,
      route: '/production/production-plans?productionOrderId=701',
    });

    expect(await screen.findByText('PO-SYN-701')).toBeVisible();
    const orderSummary = screen.getByLabelText('선택 생산 P/O');
    expect(orderSummary).toHaveClass('production-plan-order-summary');
    expect(orderSummary.parentElement).toHaveClass('production-plan-workspace');
    const add = await screen.findByRole('button', { name: '+ 계획 추가' });
    expect(add).toBeDisabled();

    await user.click(screen.getByRole('combobox', { name: 'Routing Rev' }));
    await user.click(screen.getByRole('option', { name: /ROUTE-SYN-8302/ }));
    await waitFor(() => expect(add).toBeEnabled());
    await user.click(add);

    const newRow = screen.getByText('신규 계획 1').closest('tr') as HTMLElement;
    await user.click(within(newRow).getByRole('button', { name: '저장' }));
    expect(within(newRow).getByRole('button', { name: '신규 계획 1 계획일' })).toHaveAttribute(
      'aria-invalid',
      'true',
    );
    const failures = [
      [
        '/mdm/production-lines',
        ['production-plan-references', 'production-lines', 3101],
        '생산라인',
        '생산라인 다시 시도',
      ],
      ['/planning/boms', ['production-plan-references', 'boms', 4101], 'BOM 개정', 'BOM 다시 시도'],
      [
        '/planning/routings',
        ['production-plan-references', 'routings', 4101],
        'Routing 개정',
        'Routing 다시 시도',
      ],
      [
        '/planning/production-orders/701',
        ['production-orders', 'detail', 701],
        '최신 생산 P/O',
        '다시 시도',
      ],
    ] as const;
    for (const [path, queryKey, title, retry] of failures) {
      failedPath = path;
      await act(() => queryClient.invalidateQueries({ queryKey: [...queryKey] }));
      expect(await screen.findByText(new RegExp(`${title}.*못했습니다`))).toBeVisible();
      expect(screen.getByText('신규 계획 1')).toBeVisible();
      expect(add).toBeDisabled();
      failedPath = '';
      await user.click(screen.getByRole('button', { name: retry }));
      await waitFor(() => expect(add).toBeEnabled());
    }
    wrongOwner = true;
    await act(() =>
      queryClient.invalidateQueries({ queryKey: ['production-orders', 'detail', 701] }),
    );
    expect(await screen.findByText('요청한 생산 P/O와 다른 상세가 반환되었습니다.')).toBeVisible();
    expect(screen.getByText('신규 계획 1')).not.toBeVisible();
    expect(add).toBeDisabled();
    expect(wrongPlanRequested).toBe(false);
    wrongOwner = false;
    await user.click(screen.getByRole('button', { name: '다시 시도' }));
    await waitFor(() => expect(add).toBeEnabled());
    expect(screen.getByText('신규 계획 1')).toBeVisible();
  });

  it('상세 응답 소유자가 URL과 다르면 종속 조회와 편집을 열지 않는다', async () => {
    let requests = 0;
    const fetch: StubFetch = async () => {
      requests += 1;
      return jsonResponse({ ...order, productionOrderId: 702 });
    };
    renderWithProviders(<ProductionPlanScreen />, {
      fetch,
      route: '/production/production-plans?productionOrderId=701',
    });

    expect(await screen.findByText('요청한 생산 P/O와 다른 상세가 반환되었습니다.')).toBeVisible();
    expect(screen.queryByLabelText('생산계획 편집')).not.toBeInTheDocument();
    expect(requests).toBe(1);
  });

  it('확정된 계획의 실제 결과 액션을 W/O 조회 화면에 연결한다', async () => {
    const user = userEvent.setup();
    const plan = {
      productionPlanId: 101,
      productionOrderId: 701,
      planNo: 'PLAN-101',
      planDate: '2026-08-26',
      plannedQty: 125,
      uomId: 8101,
      bomId: 8201,
      routingId: 8301,
      statusCode: 'CONFIRMED',
      confirmedAt: '2026-08-26T11:00:00+09:00',
    };
    const fetch: StubFetch = async (request) => {
      const path = new URL(request.url).pathname;
      if (path === '/planning/production-orders/701') return jsonResponse(order);
      if (path === '/mdm/items/4101')
        return jsonResponse({ item: { itemId: 4101, itemCode: 'ITEM-01', itemName: '합성 품목' } });
      if (path === '/mdm/uoms')
        return jsonResponse({
          items: [{ uomId: 8101, uomCode: 'EA', uomName: '개' }],
          page: { page: 1, size: 25, total: 1 },
        });
      if (path === '/planning/boms') return jsonResponse({ items: [bom] });
      if (path === '/planning/routings') return jsonResponse({ items: [routing(8301)] });
      if (path === '/mdm/production-lines')
        return jsonResponse({ items: [], page: { page: 1, size: 100, total: 0 } });
      if (path === '/planning/production-plans')
        return jsonResponse({ items: [plan], page: { page: 1, size: 100, total: 1 } });
      if (path === '/planning/production-plans/101') return jsonResponse(plan);
      if (path === '/planning/routings/8301/operations')
        return jsonResponse({
          items: [{ routingOperationId: 301, routingId: 8301, operationName: '절단' }],
        });
      if (path === '/production/work-orders')
        return jsonResponse({
          items: [
            {
              workOrderId: 201,
              workOrderNo: 'WO-201',
              productionPlanId: 101,
              routingOperationId: 301,
              itemId: 4101,
              orderQty: 125,
              uomId: 8101,
              workOrderTypeCode: 'NORMAL',
              priorityNo: 1,
              statusCode: 'CREATED',
            },
          ],
          page: { page: 1, size: 20, total: 1 },
        });
      throw new Error(`unexpected request: ${request.method} ${request.url}`);
    };
    renderWithProviders(<ProductionPlanScreen />, {
      fetch,
      route: '/production/production-plans?productionOrderId=701',
    });

    await user.click(await screen.findByRole('button', { name: '전개 결과' }));
    expect(await screen.findByRole('heading', { name: 'PLAN-101 전개 결과' })).toBeVisible();
    expect(screen.getByText('WO-201')).toBeVisible();
    expect(screen.getByText('1. 절단')).toBeVisible();
  });
});
