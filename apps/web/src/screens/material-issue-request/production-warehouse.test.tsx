import { messages } from '@omf-mes/i18n';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import {
  createStubFetch,
  jsonResponse,
  renderWithProviders,
  type StubRoute,
} from '../../test/api-harness';
import {
  itemFixtures,
  locationFixtures,
  reasonCodeValueFixtures,
  shortageFixtures,
  uomFixtures,
  warehouseFixtures,
  workOrderFixtures,
} from './fixtures';
import { MaterialIssueRequestScreen } from './screen';

const t = messages.materialIssueRequest;

/**
 * W-02-10 생산 창고 공장(피처 003 · tasks T052) — 출발 생산 창고 칸, 예정 재고 경고(US4-7 · US4-8),
 * 창고별 결과, W-02-11 보충 요청으로 채워 열기(US4-6 · US2-12). 값은 모두 합성이다.
 */

const WORK_ORDER = workOrderFixtures[0]!;
const WORK_ORDER_LABEL = t.values.workOrderOption(
  WORK_ORDER.workOrderNo,
  WORK_ORDER.routingOperationName ?? '',
  WORK_ORDER.itemCode ?? '',
);

const PRODUCTION_WAREHOUSES = [
  { warehouseId: 7211, warehouseCode: 'SAMPLE-PW-A', warehouseName: '합성 생산창고 A' },
  { warehouseId: 7212, warehouseCode: 'SAMPLE-PW-B', warehouseName: '합성 생산창고 B' },
];

const pageOf = (items: readonly unknown[]) => ({
  page: 1,
  size: items.length,
  total: items.length,
});

const created = (count: number) =>
  jsonResponse(
    {
      requests: PRODUCTION_WAREHOUSES.slice(0, count).map((warehouse, index) => ({
        materialIssueRequestId: 7710 + index,
        issueRequestNo: `SAMPLE-MIR-001${String(index)}`,
        workOrderId: WORK_ORDER.workOrderId,
        destinationLocationId: 7301,
        statusCode: 'WAITING',
        displayStatus: 'WAITING',
        sourceWarehouseId: warehouse.warehouseId,
        sourceWarehouseName: warehouse.warehouseName,
        lineCount: 1,
      })),
    },
    { status: 201 },
  );

const conflict = (overridable: boolean) =>
  jsonResponse(
    {
      errors: [
        {
          scope: 'screen',
          code: 'PLANNED_STOCK_CONFLICT',
          message: '예정 재고를 넘습니다',
          details: [
            {
              itemId: 7401,
              sourceWarehouseId: 7211,
              sourceWarehouseName: '합성 생산창고 A',
              requestedQty: 80,
              freeQty: 50,
              takeFromPlannedQty: 30,
              overridable,
              affectedRequests: [
                {
                  issueRequestNo: 'SAMPLE-MIR-0040',
                  workOrderNo: 'SAMPLE-WO-0040',
                  issueWorkDate: '2026-11-11',
                },
              ],
            },
          ],
        },
      ],
    },
    { status: 409 },
  );

const setup = (
  respondToPost: (body: Record<string, unknown>) => Response,
  route = '/production/material-issue-requests',
  warehouses: readonly (typeof PRODUCTION_WAREHOUSES)[number][] = PRODUCTION_WAREHOUSES,
) => {
  const posts: Record<string, unknown>[] = [];
  const get = (pathname: string, body: unknown): StubRoute => ({
    match: (request) => request.method === 'GET' && new URL(request.url).pathname === pathname,
    respond: () => jsonResponse(body),
  });

  const routes: StubRoute[] = [
    get('/production/work-orders', { items: [WORK_ORDER], page: pageOf([WORK_ORDER]) }),
    get(`/production/work-orders/${String(WORK_ORDER.workOrderId)}`, {
      ...WORK_ORDER,
      productionWarehouseMode: true,
      productionWarehouses: warehouses,
    }),
    get('/mdm/warehouses', { items: warehouseFixtures, page: pageOf(warehouseFixtures) }),
    get('/mdm/locations', { items: locationFixtures, page: pageOf(locationFixtures) }),
    get('/mdm/locations/7301', {
      location: locationFixtures[0],
      editability: { editableFields: [], readOnlyFields: [] },
    }),
    get('/mdm/items', { items: itemFixtures, page: pageOf(itemFixtures) }),
    get('/mdm/items/7401', {
      item: { ...itemFixtures[0], isActive: true },
      editability: { editableFields: [], readOnlyFields: [] },
    }),
    get('/mdm/uoms', { items: uomFixtures, page: pageOf(uomFixtures) }),
    get('/mdm/code-values', {
      items: reasonCodeValueFixtures,
      page: pageOf(reasonCodeValueFixtures),
    }),
    get('/logistics/material-issue-requests/shortage', { items: shortageFixtures }),
    get('/logistics/material-issue-requests', { items: [], page: pageOf([]) }),
    {
      match: (request) =>
        request.method === 'POST' &&
        new URL(request.url).pathname === '/logistics/material-issue-requests',
      respond: async (request) => {
        const body = JSON.parse(await request.clone().text()) as Record<string, unknown>;
        posts.push(body);
        return respondToPost(body);
      },
    },
  ];

  renderWithProviders(<MaterialIssueRequestScreen />, {
    fetch: createStubFetch(routes),
    route,
  });
  return { user: userEvent.setup(), posts };
};

type User = ReturnType<typeof userEvent.setup>;

const readyToPublish = async (user: User): Promise<void> => {
  await user.click(await screen.findByLabelText(t.formFields.workOrder));
  await user.click(await screen.findByRole('option', { name: WORK_ORDER_LABEL }));
  await screen.findByLabelText(t.sourceWarehouse.label);
  await user.click(screen.getByRole('button', { name: t.actions.loadShortage }));
  await waitFor(() =>
    expect(screen.getByLabelText(t.lineTable.requestedQtyLabel(1))).toHaveValue('80'),
  );
  await user.click(screen.getAllByRole('radio')[0]!);
};

describe('W-02-10 생산 창고 공장', () => {
  it('US2-4 출발 생산 창고는 기본 「자동」이라 sourceWarehouseId 를 빼고 보내고, 「창고」 칸은 숨긴다', async () => {
    const { user, posts } = setup(() => created(1));
    await readyToPublish(user);

    expect(screen.queryByLabelText(t.formFields.warehouse)).not.toBeInTheDocument();
    expect(screen.getByLabelText(t.sourceWarehouse.label)).toHaveTextContent(
      t.sourceWarehouse.auto,
    );
    expect(screen.getByText(t.sourceWarehouse.autoHelp(2))).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: t.actions.publish }));

    await waitFor(() => expect(posts).toHaveLength(1));
    expect(posts[0]).not.toHaveProperty('sourceWarehouseId');
    expect(posts[0]).not.toHaveProperty('acceptPlannedOverride');
  });

  it('특정 생산 창고를 고르면 모든 줄을 그 창고에서 낸다고 안내하고 sourceWarehouseId 를 싣는다', async () => {
    const { user, posts } = setup(() => created(1));
    await readyToPublish(user);

    await user.click(screen.getByLabelText(t.sourceWarehouse.label));
    await user.click(await screen.findByRole('option', { name: 'SAMPLE-PW-B 합성 생산창고 B' }));
    expect(screen.getByText(t.sourceWarehouse.fixedHelp('합성 생산창고 B'))).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: t.actions.publish }));

    await waitFor(() => expect(posts).toHaveLength(1));
    expect(posts[0]).toMatchObject({ sourceWarehouseId: 7212 });
  });

  it('창고별로 나뉜 배열 응답은 요청 N장과 출발 생산 창고 · 상태 라벨을 보인다', async () => {
    const { user } = setup(() => created(2));
    await readyToPublish(user);

    await user.click(screen.getByRole('button', { name: t.actions.publish }));

    expect(await screen.findByText(t.result.splitTitle(2))).toBeInTheDocument();
    expect(screen.getByText('합성 생산창고 A')).toBeInTheDocument();
    expect(screen.getByText('합성 생산창고 B')).toBeInTheDocument();
    expect(screen.getAllByText(t.status.WAITING ?? '')).toHaveLength(2);
  });

  it('US4-7 409 가져갈 수 있음이면 경고 창 뒤 「그래도 요청」이 acceptPlannedOverride 를 실어 다시 보낸다', async () => {
    const { user, posts } = setup((body) =>
      body.acceptPlannedOverride === true ? created(1) : conflict(true),
    );
    await readyToPublish(user);

    await user.click(screen.getByRole('button', { name: t.actions.publish }));

    const dialog = within(await screen.findByRole('dialog', { name: t.override.title }));
    const table = within(dialog.getByRole('table', { name: t.override.tableLabel }));
    expect(table.getByText('합성 생산창고 A')).toBeInTheDocument();
    expect(table.getByText(/SAMPLE-MIR-0040/)).toBeInTheDocument();

    await user.click(dialog.getByRole('button', { name: t.override.submit }));

    await waitFor(() => expect(posts).toHaveLength(2));
    expect(posts[1]).toMatchObject({ acceptPlannedOverride: true });
    expect(await screen.findByText(t.result.overrideNote)).toBeInTheDocument();
  });

  it('US4-8 409 가져갈 수 없음(overridable=false)이면 막힘 창만 보이고 다시 보낼 길이 없다', async () => {
    const { user, posts } = setup(() => conflict(false));
    await readyToPublish(user);

    await user.click(screen.getByRole('button', { name: t.actions.publish }));

    const dialog = within(await screen.findByRole('dialog', { name: t.override.blockedTitle }));
    expect(dialog.getByText(t.override.blockedBody)).toBeInTheDocument();
    expect(dialog.queryByRole('button', { name: t.override.submit })).not.toBeInTheDocument();

    await user.click(dialog.getByRole('button', { name: t.override.fix }));
    await waitFor(() =>
      expect(
        screen.queryByRole('dialog', { name: t.override.blockedTitle }),
      ).not.toBeInTheDocument(),
    );
    expect(posts).toHaveLength(1);
  });

  it('US4-6 · US2-12 W-02-11 「보충 요청」으로 열면 W/O · 품목 · 수량 · 사유를 채우고 미배정 부족 행을 함께 보낸다', async () => {
    const { user, posts } = setup(
      () => created(1),
      `/production/material-issue-requests?wo=${String(WORK_ORDER.workOrderId)}&woNo=${WORK_ORDER.workOrderNo}&item=7401&qty=20&reason=SAMPLE_MIR_R_B&unsourced=71`,
    );

    expect(await screen.findByText(t.prefilled)).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByLabelText(t.lineTable.requestedQtyLabel(1))).toHaveValue('20'),
    );
    await user.click(screen.getByRole('button', { name: t.actions.publish }));

    await waitFor(() => expect(posts).toHaveLength(1));
    expect(posts[0]).toMatchObject({
      workOrderId: WORK_ORDER.workOrderId,
      reasonCode: 'SAMPLE_MIR_R_B',
      unsourcedShortageId: 71,
      lines: [{ itemId: 7401, requestedQty: 20, uomId: 7501 }],
    });
    expect(await screen.findByText(t.result.unsourcedNote)).toBeInTheDocument();
  });

  it('새 규칙 공장인데 라인 부서에 생산 창고가 없으면(빈 배열) 알리고 발행을 막는다', async () => {
    const { user, posts } = setup(() => created(1), undefined, []);

    await user.click(await screen.findByLabelText(t.formFields.workOrder));
    await user.click(await screen.findByRole('option', { name: WORK_ORDER_LABEL }));

    expect((await screen.findAllByText(t.sourceWarehouse.none)).length).toBeGreaterThan(0);
    expect(screen.queryByLabelText(t.formFields.warehouse)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: t.actions.publish })).toBeDisabled();
    expect(posts).toHaveLength(0);
  });
});
