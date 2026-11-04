import { ToastProvider } from '@crefle/web-ui';
import { createApiClient } from '@omf-mes/api-client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import { ApiClientProvider } from '../../../patterns/api-context';
import { jsonResponse } from '../../../test/api-harness';
import { MultiOrderPlanning } from './multi-order-planning';

const fixtures = vi.hoisted(() => {
  const orders = Object.fromEntries(
    [
      ['A', 101, 120],
      ['B', 102, 80],
    ].map(([no, id, qty]) => [
      String(no),
      {
        productionOrderNo: no,
        productionOrderId: id,
        plantId: 1,
        itemId: 1,
        uomId: 1,
        orderQty: qty,
        confirmedPlanQty: 0,
      },
    ]),
  );
  const boms = {
    data: {
      items: [
        { bomId: 11, bomCode: 'BOM', bomVersion: 1, isDefault: true, effectiveFrom: '2026-01-01' },
      ],
    },
    isPending: false,
    isError: false,
    refetch: () => {},
  };
  const routings = {
    data: { items: [{ routingId: 21, routingCode: 'R1', routingVersion: 1, isDefault: true }] },
    isPending: false,
    isError: false,
    refetch: () => {},
  };
  const lines = {
    data: { items: [{ productionLineId: 31, lineCode: 'L1', lineName: '라인 1', isActive: true }] },
    isPending: false,
    isError: false,
  };
  const units = { entries: [{ value: '1', label: 'EA' }] };
  const items = new Map([[1, { itemCode: 'ITEM1', itemName: '시험 품목' }]]);
  return { orders, boms, routings, lines, units, items };
});
vi.mock('../worklist-queries', () => ({
  useProductionOrderByNumber: (no: string) => ({
    data: fixtures.orders[no],
    isPending: false,
    isError: false,
  }),
}));
vi.mock('../../production-plan/reference-queries', () => ({
  useBomReferenceQuery: () => fixtures.boms,
  useRoutingReferenceQuery: () => fixtures.routings,
  useProductionLineReferenceQuery: () => fixtures.lines,
}));
vi.mock('../reference-lookups', () => ({ useUomReferenceLookup: () => fixtures.units }));
vi.mock('../item-lookups', () => ({ useItemCodeNames: () => fixtures.items }));
vi.mock('./process-screen', () => ({
  ProcessWorkspace: ({ initialStep }: { initialStep: string }) => <p>실행 단계 {initialStep}</p>,
}));

const mount = (initialPlans: Record<string, unknown>[] = []) => {
  const plans: Record<string, unknown>[] = [...initialPlans];
  for (const order of Object.values(fixtures.orders))
    order.confirmedPlanQty = plans
      .filter(
        (p) => p.productionOrderId === order.productionOrderId && p.statusCode === 'CONFIRMED',
      )
      .reduce((sum, p) => sum + Number(p.plannedQty), 0);
  const writes: { method: string; owner?: number; match: string | null }[] = [];
  const state = { rejectB: false };
  const fetch = async (request: Request) => {
    const url = new URL(request.url);
    const page = (items: unknown[]) =>
      jsonResponse({ items, page: { page: 1, size: 100, total: items.length } });
    if (request.method === 'GET')
      return page(
        plans.filter(
          (row) => row.productionOrderId === Number(url.searchParams.get('productionOrderId')),
        ),
      );
    const match = /\/(\d+)(:confirm)?$/.exec(url.pathname);
    const body =
      request.method === 'POST' && !match
        ? ((await request.json()) as Record<string, unknown>)
        : {};
    writes.push({
      method: request.method,
      owner: body.productionOrderId as number | undefined,
      match: request.headers.get('If-Match'),
    });
    if (body.productionOrderId === 102 && state.rejectB)
      return jsonResponse(
        {
          errors: [
            {
              scope: 'field',
              field: 'plannedQty',
              code: 'INVALID',
              message: '수량을 다시 확인하세요.',
            },
          ],
        },
        { status: 422 },
      );
    if (!match) {
      const plan = {
        ...body,
        productionPlanId: 501 + plans.length,
        planNo: `PP-${501 + plans.length}`,
        versionNo: 1,
        statusCode: 'DRAFT',
        confirmedAt: null,
      };
      plans.push(plan);
      return jsonResponse(plan);
    }
    const row = plans.find((row) => row.productionPlanId === Number(match[1]));
    if (!row) return jsonResponse({}, { status: 404 });
    if (request.headers.get('If-Match') !== String(row.versionNo))
      return jsonResponse({ conflictCause: 'user', message: '' }, { status: 409 });
    row.versionNo = Number(row.versionNo) + 1;
    if (match[2]) {
      row.confirmedAt = '2026-11-03T00:00:00Z';
      row.statusCode = 'CONFIRMED';
      const order = Object.values(fixtures.orders).find(
        (o) => o.productionOrderId === row.productionOrderId,
      );
      if (order)
        order.confirmedPlanQty = plans
          .filter(
            (p) => p.productionOrderId === row.productionOrderId && p.statusCode === 'CONFIRMED',
          )
          .reduce((sum, p) => sum + Number(p.plannedQty), 0);
    } else Object.assign(row, await request.json());
    return jsonResponse(row);
  };
  const client = createApiClient({ baseUrl: 'http://api.test', fetch });
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, networkMode: 'always' },
      mutations: { retry: false, networkMode: 'always' },
    },
  });
  const router = createMemoryRouter([
    { path: '/', element: <MultiOrderPlanning orderNumbers={['A', 'B']} /> },
  ]);
  render(
    <QueryClientProvider client={queryClient}>
      <ApiClientProvider client={client}>
        <ToastProvider>
          <RouterProvider router={router} />
        </ToastProvider>
      </ApiClientProvider>
    </QueryClientProvider>,
  );
  return { plans, writes, state };
};
const distribute = async (targets: Record<string, string> = {}) => {
  const user = userEvent.setup();
  await waitFor(() => expect(screen.getByRole('button', { name: '다음: 생산계획' })).toBeEnabled());
  await user.click(screen.getByRole('button', { name: '다음: 생산계획' }));
  expect(screen.getByRole('tab', { name: '주간 편성' })).toHaveAttribute('aria-selected', 'true');
  if (Object.keys(targets).length)
    await user.click(screen.getByRole('tab', { name: 'ERP W/O별 계획 수량' }));
  for (const [order, qty] of Object.entries(targets)) {
    const input = screen.getByRole('spinbutton', { name: `${order} 이번 계획 수량` });
    await user.clear(input);
    await user.type(input, qty);
  }
  await user.click(screen.getByRole('tab', { name: '주간 편성' }));
  await user.click(screen.getByRole('button', { name: '자동 분배' }));
  const groups = screen.getAllByRole('group', { name: /^분배 구간 \d+$/ });
  for (const [index, group] of groups.entries()) {
    const total = Number(
      (within(group).getByRole('textbox', { name: `구간 ${index + 1} 수량` }) as HTMLInputElement)
        .value,
    );
    await user.click(
      within(group).getByRole('button', { name: `구간 ${index + 1} 생산 라인 선택` }),
    );
    await user.click(await screen.findByText('라인 1', { exact: true }));
    await user.click(screen.getByRole('button', { name: '선택' }));
    await user.click(within(group).getByRole('combobox', { name: `구간 ${index + 1} 배분 방식` }));
    await user.click(screen.getByRole('option', { name: '날짜별 직접 입력' }));
    const inputs = within(group).getAllByRole('textbox', {
      name: new RegExp(`구간 ${index + 1} [0-9]{4}-`),
    });
    for (const [day, input] of inputs.entries()) {
      const qty = index === 0 ? (day === 0 ? total : 0) : day < 2 ? total / 2 : 0;
      await user.clear(input);
      await user.type(input, String(qty));
    }
  }
  await user.click(screen.getByRole('button', { name: '분배 미리보기' }));
  expect(screen.queryByRole('button', { name: '계획 저장' })).toBeNull();
  await user.click(screen.getByRole('button', { name: '분배안 적용' }));

  return user;
};
describe('복수 ERP W/O 편성 저장 연결', () => {
  it('분배한 계획을 ERP W/O별 저장하고 If-Match로 확정한 뒤 실행 단계로 이동한다', async () => {
    const server = mount();
    const user = await distribute();
    expect(screen.getByRole('button', { name: '분배 미리보기' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: '계획 저장' }));
    await waitFor(() => expect(server.plans).toHaveLength(3));
    expect(
      server.plans
        .filter((p) => p.productionOrderId === 101)
        .reduce((sum, p) => sum + Number(p.plannedQty), 0),
    ).toBe(120);
    expect(
      server.plans
        .filter((p) => p.productionOrderId === 102)
        .reduce((sum, p) => sum + Number(p.plannedQty), 0),
    ).toBe(80);
    await waitFor(() =>
      expect(screen.getByRole('button', { name: '전개 확정 후 4M 배정' })).toBeEnabled(),
    );
    await user.click(screen.getByRole('button', { name: '전개 확정 후 4M 배정' }));
    const buttons = screen.getAllByRole('button', { name: '전개 확정' });
    await user.click(buttons.at(-1)!);
    expect(await screen.findByText('실행 단계 assign')).toBeVisible();
    expect(server.writes.filter((w) => w.match !== null).map((w) => w.match)).toEqual([
      '1',
      '1',
      '1',
    ]);
    await user.click(screen.getByRole('tab', { name: '2. 생산계획' }));
    expect(await screen.findByRole('button', { name: '4M 배정으로' })).toBeVisible();
    expect(screen.queryByRole('button', { name: '전개 확정 후 4M 배정' })).toBeNull();
    expect(screen.queryByRole('button', { name: /주간 편성에서 확인/ })).toBeNull();
  });
  it('일부 ERP W/O 저장 실패를 표시하고 재시도 시 완료한 계획을 중복 생성하지 않는다', async () => {
    const server = mount();
    server.state.rejectB = true;
    const user = await distribute();
    await user.click(screen.getByRole('button', { name: '계획 저장' }));
    await waitFor(() =>
      expect(screen.getByRole('region', { name: '계획 처리 결과' })).toHaveTextContent('B /'),
    );
    expect(server.plans).toHaveLength(1);
    server.state.rejectB = false;
    await user.click(screen.getByRole('button', { name: '계획 저장' }));
    await waitFor(() => expect(server.plans).toHaveLength(3));
    expect(server.plans.filter((p) => p.productionOrderId === 101)).toHaveLength(1);
  });
  it('ERP W/O 전량 대신 이번 계획 수량만 분배하고 0인 ERP W/O는 추가하지 않는다', async () => {
    const server = mount();
    const user = await distribute({ A: '60', B: '0' });
    await user.click(screen.getByRole('button', { name: '계획 저장' }));
    await waitFor(() => expect(server.plans).toHaveLength(1));
    expect(server.plans[0]?.productionOrderId).toBe(101);
    expect(server.plans[0]?.plannedQty).toBe(60);
    expect(screen.getByRole('button', { name: '전개 확정 후 4M 배정' })).toBeDisabled();
    expect(screen.getByRole('tab', { name: '3. 4M 배정' })).toHaveAttribute(
      'aria-disabled',
      'true',
    );
    expect(screen.getByRole('tab', { name: '4. 배포 확인' })).toHaveAttribute(
      'aria-disabled',
      'true',
    );
  });
  it('ERP W/O 선택은 계획 추가 때만 표시하고 새 계획의 편집 대상과 연결한다', async () => {
    mount();
    const user = userEvent.setup();
    await waitFor(() =>
      expect(screen.getByRole('button', { name: '다음: 생산계획' })).toBeEnabled(),
    );
    await user.click(screen.getByRole('button', { name: '다음: 생산계획' }));
    expect(screen.queryByRole('columnheader', { name: '계획 추가 대상' })).toBeNull();
    expect(screen.queryByRole('button', { name: /주간 편성에서 확인/ })).toBeNull();
    await user.click(screen.getByRole('tab', { name: '주간 편성' }));
    expect(screen.queryByRole('combobox', { name: '계획 추가 대상' })).toBeNull();
    await user.click(screen.getByRole('button', { name: '계획 추가' }));
    const dialog = screen.getByRole('dialog', { name: '계획 추가' });
    await user.click(within(dialog).getByRole('combobox', { name: '계획을 추가할 ERP W/O' }));
    await user.click(screen.getByRole('option', { name: 'B / 시험 품목 (ITEM1)' }));
    await user.click(within(dialog).getByRole('button', { name: '추가' }));
    expect(await screen.findByRole('region', { name: '선택 계획 편집' })).toHaveTextContent(
      'B / 시험 품목',
    );
    expect(screen.getByRole('button', { name: '전개 확정 후 4M 배정' })).toBeDisabled();
    expect(screen.queryByRole('button', { name: '4M 배정으로' })).toBeNull();
  });
  it.each([
    [60, 80],
    [120, 0],
  ])(
    '기존 확정 계획만 있어도 ERP W/O 전량이 아니거나 빈 대상이 있으면 진입을 막는다 (%s/%s)',
    async (a, b) => {
      mount(
        [
          [101, a],
          [102, b],
        ]
          .filter(([, qty]) => Number(qty) > 0)
          .map(([owner, qty], index) => ({
            productionPlanId: 501 + index,
            productionOrderId: owner,
            planNo: `PP-${501 + index}`,
            planDate: '2026-11-04',
            plannedQty: qty,
            uomId: 1,
            bomId: 11,
            routingId: 21,
            plannedLineId: 31,
            statusCode: 'CONFIRMED',
            confirmedAt: '2026-11-04T00:00:00Z',
            versionNo: 1,
          })),
      );
      const user = userEvent.setup();
      await waitFor(() =>
        expect(screen.getByRole('button', { name: '다음: 생산계획' })).toBeEnabled(),
      );
      await user.click(screen.getByRole('button', { name: '다음: 생산계획' }));
      expect(screen.getByRole('tab', { name: '3. 4M 배정' })).toHaveAttribute(
        'aria-disabled',
        'true',
      );
      expect(screen.getByRole('tab', { name: '4. 배포 확인' })).toHaveAttribute(
        'aria-disabled',
        'true',
      );
      expect(screen.queryByRole('button', { name: '4M 배정으로' })).toBeNull();
    },
  );
  it('적용하지 않은 분배 조건이 있으면 단계 이동 전에 버릴지 확인한다', async () => {
    mount();
    const user = userEvent.setup();
    await waitFor(() =>
      expect(screen.getByRole('button', { name: '다음: 생산계획' })).toBeEnabled(),
    );
    await user.click(screen.getByRole('button', { name: '다음: 생산계획' }));
    await user.click(screen.getByRole('tab', { name: '주간 편성' }));
    await user.click(screen.getByRole('button', { name: '자동 분배' }));
    await user.click(screen.getByRole('button', { name: '구간 1 생산 라인 선택' }));
    await user.click(await screen.findByText('라인 1', { exact: true }));
    await user.click(screen.getByRole('button', { name: '선택' }));
    await user.click(screen.getByRole('tab', { name: '1. BOM·Routing' }));
    expect(screen.getByRole('dialog')).toBeVisible();
  });
});
