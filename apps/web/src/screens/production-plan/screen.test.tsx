import { act, screen, waitFor } from '@testing-library/react';
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
  it('유효한 생산 P/O가 없으면 요청하지 않고 선택 화면으로 안내한다', () => {
    const fetch: StubFetch = async (request) => {
      throw new Error(`unexpected request: ${request.url}`);
    };
    renderWithProviders(<ProductionPlanScreen />, {
      fetch,
      route: '/production/production-plans?productionOrderId=not-a-number',
    });

    expect(screen.getByText('생산 P/O를 먼저 선택하세요.')).toBeVisible();
    expect(screen.getByRole('link', { name: 'P/O 수신·조회로 이동' })).toHaveAttribute(
      'href',
      '/production/production-orders',
    );
  });

  it('P/O와 전체 참조를 연결하고 Routing 선택 뒤 계획 추가를 허용한다', async () => {
    const user = userEvent.setup();
    const requests: Request[] = [];
    let linesFail = false;
    const fetch: StubFetch = async (request) => {
      requests.push(request.clone());
      const url = new URL(request.url);
      if (url.pathname === '/planning/production-orders/701') return jsonResponse(order);
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
        if (linesFail) return jsonResponse({ message: 'synthetic failure' }, { status: 503 });
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
        return jsonResponse({ items: [], page: { page: 1, size: 100, total: 0 } });
      }
      throw new Error(`unexpected request: ${request.method} ${request.url}`);
    };
    const { queryClient } = renderWithProviders(<ProductionPlanScreen />, {
      fetch,
      route: '/production/production-plans?productionOrderId=701',
    });

    expect(await screen.findByText('PO-SYN-701')).toBeVisible();
    expect(await screen.findByText(/ITEM-01 · 합성 품목 · 125 EA · 개/)).toBeVisible();
    const add = await screen.findByRole('button', { name: '+ 계획 추가' });
    expect(add).toBeDisabled();

    await user.click(screen.getByRole('combobox', { name: 'Routing Rev' }));
    await user.click(screen.getByRole('option', { name: /ROUTE-SYN-8302/ }));
    await waitFor(() => expect(add).toBeEnabled());
    await user.click(add);

    expect(screen.getByRole('spinbutton', { name: '신규 계획 1 계획수량' })).toHaveValue(null);
    expect(screen.getByRole('combobox', { name: '신규 계획 1 라인' })).toHaveTextContent('미지정');
    linesFail = true;
    await act(() =>
      queryClient.invalidateQueries({
        queryKey: ['production-plan-references', 'production-lines', 3101],
      }),
    );
    expect(await screen.findByText('생산라인을 불러오지 못했습니다.')).toBeVisible();
    expect(screen.getByText('신규 계획 1')).toBeVisible();
    expect(add).toBeDisabled();
    linesFail = false;
    await user.click(screen.getByRole('button', { name: '생산라인 다시 시도' }));
    await waitFor(() => expect(add).toBeEnabled());
    expect(requests.find((request) => new URL(request.url).pathname === '/planning/boms')).toEqual(
      expect.objectContaining({ method: 'GET' }),
    );
    const lineRequest = requests.find(
      (request) => new URL(request.url).pathname === '/mdm/production-lines',
    );
    expect(new URL(lineRequest?.url ?? '').searchParams.get('includeInactive')).toBe('true');
    expect(
      screen.getByText('생산 LOT 크기와 선발행은 W/O 확정·배포 단계에서 입력합니다.'),
    ).toBeVisible();
  });

  it('상세 응답 소유자가 URL과 다르면 종속 조회와 편집을 열지 않는다', async () => {
    const requests: Request[] = [];
    const fetch: StubFetch = async (request) => {
      requests.push(request);
      const url = new URL(request.url);
      if (url.pathname === '/planning/production-orders/701') {
        return jsonResponse({ ...order, productionOrderId: 702, productionOrderNo: 'PO-SYN-702' });
      }
      throw new Error(`unexpected dependent request: ${request.url}`);
    };
    renderWithProviders(<ProductionPlanScreen />, {
      fetch,
      route: '/production/production-plans?productionOrderId=701',
    });

    expect(await screen.findByText('요청한 생산 P/O와 다른 상세가 반환되었습니다.')).toBeVisible();
    expect(screen.queryByLabelText('생산계획 편집')).not.toBeInTheDocument();
    expect(requests).toHaveLength(1);
  });
});
