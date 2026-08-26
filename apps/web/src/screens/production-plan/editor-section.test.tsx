import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { jsonResponse, renderWithProviders, type StubFetch } from '../../test/api-harness';
import { ProductionPlanEditorSection } from './editor-section';

const plan = (productionPlanId: number, plannedQty: number) => ({
  productionPlanId,
  productionOrderId: 701,
  planNo: `PLAN-${String(productionPlanId)}`,
  planDate: '2026-08-26',
  plannedQty,
  uomId: 8101,
  bomId: 8201,
  routingId: 8301,
  statusCode: 'DRAFT',
});
const props = {
  productionOrderId: 701,
  orderQty: 100,
  uomId: 8101,
  uomLabel: 'EA',
  defaults: {
    planDate: '2026-08-27',
    plannedQty: '25',
    bomId: '8201',
    routingId: '8301',
  },
  bomOptions: [{ value: '8201', label: 'BOM-A · Rev 1' }],
  routingOptions: [{ value: '8301', label: 'ROUTE-A · Rev 1' }],
  lineOptions: [],
};

describe('ProductionPlanEditorSection', () => {
  it('전체 계획을 편집 표에 연결하고 기존 수정과 신규 저장을 실제 계약으로 보낸다', async () => {
    const user = userEvent.setup();
    const requests: Request[] = [];
    let plans = [plan(501, 50)];
    const fetch: StubFetch = async (request) => {
      requests.push(request.clone());
      const url = new URL(request.url);
      if (request.method === 'GET' && url.pathname === '/planning/production-plans') {
        return jsonResponse({
          items: plans,
          page: { page: 1, size: 100, total: plans.length },
        });
      }
      if (request.method === 'GET' && /^\/planning\/production-plans\/\d+$/.test(url.pathname)) {
        const id = Number(url.pathname.split('/').at(-1));
        return jsonResponse(
          plans.find((item) => item.productionPlanId === id),
          {
            headers: { ETag: `"plan-${String(id)}-v1"` },
          },
        );
      }
      if (request.method === 'PUT' && url.pathname === '/planning/production-plans/501') {
        const body = (await request.json()) as { plannedQty: number };
        plans = [plan(501, body.plannedQty)];
        return jsonResponse(plans[0], { headers: { ETag: '"plan-501-v2"' } });
      }
      if (request.method === 'POST' && url.pathname === '/planning/production-plans') {
        const body = (await request.json()) as { plannedQty: number };
        plans = [...plans, plan(502, body.plannedQty)];
        return jsonResponse(plans[1], { status: 201 });
      }
      throw new Error(`unexpected request: ${request.method} ${request.url}`);
    };
    renderWithProviders(<ProductionPlanEditorSection {...props} />, { fetch });

    const existingQty = await screen.findByRole('spinbutton', { name: 'PLAN-501 계획수량' });
    await user.clear(existingQty);
    await user.type(existingQty, '60');
    const existingRow = screen.getByText('PLAN-501').closest('tr') as HTMLElement;
    const saveExisting = within(existingRow).getByRole('button', { name: '저장' });
    await waitFor(() => expect(saveExisting).toBeEnabled());
    await user.click(saveExisting);
    await waitFor(() => expect(requests.some((request) => request.method === 'PUT')).toBe(true));

    await user.click(screen.getByRole('button', { name: '+ 계획 추가' }));
    const newRow = screen.getByText('신규 계획 2').closest('tr') as HTMLElement;
    await user.click(within(newRow).getByRole('button', { name: '저장' }));
    expect(await screen.findByText('PLAN-502')).toBeVisible();

    const update = requests.find((request) => request.method === 'PUT') as Request;
    const create = requests.find((request) => request.method === 'POST') as Request;
    expect(update.headers.get('If-Match')).toBe('"plan-501-v1"');
    expect(update.headers.get('Idempotency-Key')).toBeTruthy();
    expect(await update.json()).toEqual({ plannedQty: 60 });
    expect(await create.json()).toEqual({
      productionOrderId: 701,
      planDate: '2026-08-27',
      plannedQty: 25,
      uomId: 8101,
      bomId: 8201,
      routingId: 8301,
    });
    expect(screen.getByText('85 / 100 EA')).toBeVisible();
  });

  it('첫 전체 조회 실패는 편집기를 열지 않고 재시도 성공 뒤 빈 계획 추가를 허용한다', async () => {
    const user = userEvent.setup();
    let requests = 0;
    const fetch: StubFetch = async () => {
      requests += 1;
      return requests === 1
        ? jsonResponse({ message: 'synthetic failure' }, { status: 503 })
        : jsonResponse({ items: [], page: { page: 1, size: 100, total: 0 } });
    };
    renderWithProviders(<ProductionPlanEditorSection {...props} />, { fetch });

    expect(await screen.findByText('생산계획을 불러오지 못했습니다.')).toBeVisible();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '다시 시도' }));

    expect(await screen.findByRole('button', { name: '+ 계획 추가' })).toBeEnabled();
    expect(screen.getByText('계획을 1건 이상 추가해야 전개할 수 있습니다.')).toBeVisible();
  });

  it('편집 중 최신 조회 실패는 행을 보존하고 추가만 잠근 뒤 재시도로 해제한다', async () => {
    const user = userEvent.setup();
    let listFails = false;
    const fetch: StubFetch = async (request) => {
      const url = new URL(request.url);
      if (url.pathname === '/planning/production-plans') {
        return listFails
          ? jsonResponse({ message: 'synthetic refetch failure' }, { status: 503 })
          : jsonResponse({
              items: [plan(501, 50)],
              page: { page: 1, size: 100, total: 1 },
            });
      }
      if (url.pathname === '/planning/production-plans/501') {
        return jsonResponse(plan(501, 50), { headers: { ETag: '"plan-501-v1"' } });
      }
      throw new Error(`unexpected request: ${request.method} ${request.url}`);
    };
    const { queryClient } = renderWithProviders(<ProductionPlanEditorSection {...props} />, {
      fetch,
    });
    const quantity = await screen.findByRole('spinbutton', { name: 'PLAN-501 계획수량' });
    await user.clear(quantity);
    await user.type(quantity, '60');
    await user.click(screen.getByRole('button', { name: '+ 계획 추가' }));

    listFails = true;
    await act(() => queryClient.invalidateQueries({ queryKey: ['production-plans'] }));
    expect(await screen.findByText('최신 생산계획을 확인하지 못했습니다.')).toBeVisible();

    expect(screen.getByRole('table')).toBeVisible();
    expect(screen.getByRole('spinbutton', { name: 'PLAN-501 계획수량' })).toHaveValue(60);
    expect(screen.getByText('신규 계획 2')).toBeVisible();
    expect(screen.getByRole('button', { name: '+ 계획 추가' })).toBeDisabled();
    const existingRow = screen.getByText('PLAN-501').closest('tr') as HTMLElement;
    expect(within(existingRow).getByRole('button', { name: '저장' })).toBeVisible();
    expect(within(existingRow).getByRole('button', { name: '삭제' })).toBeVisible();

    listFails = false;
    await user.click(screen.getByRole('button', { name: '다시 시도' }));
    await waitFor(() =>
      expect(screen.queryByText('최신 생산계획을 확인하지 못했습니다.')).toBeNull(),
    );
    expect(screen.getByRole('button', { name: '+ 계획 추가' })).toBeEnabled();
    expect(screen.getByRole('spinbutton', { name: 'PLAN-501 계획수량' })).toHaveValue(60);
  });
});
