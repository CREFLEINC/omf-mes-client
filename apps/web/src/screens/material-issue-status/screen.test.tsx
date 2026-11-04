import type {
  MaterialIssueRequestDetailForward,
  MaterialIssueRequestForward,
  PlannedStockResponse,
} from '@omf-mes/api-client';
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
import { MaterialIssueStatusScreen } from './screen';
import { replenishLink } from './shortage-view';

const t = messages.materialIssueStatus;

/** 공장 · 창고 · 요청 · 품목은 모두 합성 값이다. */
const PLANT = {
  plantId: 8401,
  businessUnitId: 8301,
  legalEntityId: 8201,
  plantCode: 'G1',
  plantName: '합성 1공장',
  timezoneCode: 'Asia/Ho_Chi_Minh',
  isActive: true,
};

const request = (
  id: number,
  overrides: Partial<MaterialIssueRequestForward> = {},
): MaterialIssueRequestForward => ({
  materialIssueRequestId: id,
  issueRequestNo: `SYN-MIR-${String(id).padStart(2, '0')}`,
  workOrderId: 100 + id,
  workOrderNo: `SYN-WO-${String(id)}`,
  destinationLocationId: 501,
  destinationLocationName: '합성 조립 현장',
  statusCode: 'WAITING',
  displayStatus: 'WAITING',
  sourceWarehouseId: 7001,
  sourceWarehouseName: '합성 생산창고 A',
  issueWorkDate: '2026-11-20',
  productionDate: '2026-11-23',
  productionPlanId: 9001,
  productionPlanNo: 'SYN-PP-01',
  lineCount: 1,
  shortageQtyTotal: 0,
  dynamicShortageQtyTotal: 0,
  versionNo: 3,
  ...overrides,
});

const REQUESTS = [
  request(1),
  request(2, {
    displayStatus: 'IN_PROGRESS',
    statusCode: 'IN_PROGRESS',
    productionPlanId: 9002,
    productionPlanNo: 'SYN-PP-02',
  }),
  /* 「부족 N」 = 저장 부족 15 + 동적 부족 5(서버 S8e). */
  request(3, { shortageQtyTotal: 15, dynamicShortageQtyTotal: 5 }),
  request(4, { displayStatus: 'DONE', closeReasonCode: 'WO_CANCELLED' }),
  request(5, { releaseErrorText: '출발 생산 창고가 비활성입니다.' }),
];

const detailOf = (id: number): MaterialIssueRequestDetailForward => ({
  materialIssueRequest: REQUESTS.find((row) => row.materialIssueRequestId === id) ?? request(id),
  lines: [
    {
      materialIssueRequestLineId: id * 10,
      materialIssueRequestId: id,
      lineNo: 1,
      itemId: 601,
      itemCode: 'SYN-IT-1',
      itemName: '합성 커넥터',
      uomId: 1,
      uomCode: 'EA',
      requestedQty: 100,
      issuedQty: id === 2 ? 40 : 0,
      pickedQty: id === 2 ? 60 : 0,
    },
  ],
});

const SHORTAGE: PlannedStockResponse = {
  items: [
    {
      sourceWarehouseId: 7001,
      sourceWarehouseName: '합성 생산창고 A',
      itemId: 601,
      itemCode: 'SYN-IT-1',
      itemName: '합성 커넥터',
      availableQty: 80,
      plannedQty: 100,
      freeQty: 0,
      shortageQty: 20,
      requests: [
        {
          materialIssueRequestId: 3,
          issueRequestNo: 'SYN-MIR-03',
          workOrderId: 103,
          workOrderNo: 'SYN-WO-3',
          issueWorkDate: '2026-11-20',
          plannedQty: 100,
          shortageQty: 20,
        },
      ],
    },
  ],
  unsourced: [
    {
      unsourcedShortageId: 71,
      workOrderId: 201,
      workOrderNo: 'SYN-WO-21',
      itemId: 602,
      itemCode: 'SYN-IT-2',
      itemName: '합성 도료',
      shortageQty: 20,
      uomCode: 'KG',
    },
    {
      unsourcedShortageId: 72,
      workOrderId: 202,
      workOrderNo: 'SYN-WO-22',
      itemId: 603,
      itemCode: 'SYN-IT-3',
      itemName: '합성 패드',
      shortageQty: 50,
      uomCode: 'EA',
      resolvedRequestNo: 'SYN-MIR-15',
    },
  ],
};

interface Recorded {
  method: string;
  url: URL;
  body: unknown;
}

interface SetupOptions {
  route?: string;
  /** PUT 응답을 바꾼다 — 받은 본문을 보고 정한다. */
  respondPut?: (body: Record<string, unknown>) => Response | undefined;
  /** 이력 조회 응답 상태(기본 200). */
  historyStatus?: number;
}

const setup = (options: SetupOptions = {}) => {
  const writes: Recorded[] = [];
  const lists: URL[] = [];
  const pathOf = (request: Request) => new URL(request.url).pathname;
  const isGet = (request: Request, path: string | RegExp) =>
    request.method === 'GET' &&
    (typeof path === 'string' ? pathOf(request) === path : path.test(pathOf(request)));

  const routes: StubRoute[] = [
    {
      match: (request) => isGet(request, '/mdm/plants'),
      respond: () => jsonResponse({ items: [PLANT], page: { page: 1, size: 200, total: 1 } }),
    },
    {
      match: (request) => isGet(request, '/mdm/warehouses'),
      respond: () =>
        jsonResponse({
          items: [
            {
              warehouseId: 7001,
              plantId: 8401,
              businessUnitId: 8301,
              warehouseCode: 'SYN-PW-A',
              warehouseName: '합성 생산창고 A',
              warehouseTypeCode: 'MATERIAL',
              isExternal: false,
              isDefect: false,
              isActive: true,
            },
            {
              warehouseId: 7002,
              plantId: 8401,
              businessUnitId: 8301,
              warehouseCode: 'SYN-PW-B',
              warehouseName: '합성 생산창고 B',
              warehouseTypeCode: 'MATERIAL',
              isExternal: false,
              isDefect: false,
              isActive: true,
            },
          ],
          page: { page: 1, size: 200, total: 2 },
        }),
    },
    {
      match: (request) => isGet(request, /^\/mdm\/locations\/\d+$/),
      respond: () =>
        jsonResponse({ location: { locationId: 501, warehouseId: 7101 }, editability: {} }),
    },
    {
      match: (request) => isGet(request, '/mdm/locations'),
      respond: () =>
        jsonResponse({
          items: [
            {
              locationId: 501,
              locationCode: 'SYN-L1',
              locationName: '합성 조립 현장',
              isActive: true,
            },
          ],
          page: { page: 1, size: 50, total: 1 },
        }),
    },
    {
      match: (request) => isGet(request, '/mdm/code-values'),
      respond: () =>
        jsonResponse({
          items: [
            { codeValueId: 1, code: 'SYN_URGENT', codeName: '합성 긴급 대응', displayOrder: 1 },
          ],
          page: { page: 1, size: 100, total: 1 },
        }),
    },
    {
      match: (request) => isGet(request, '/logistics/material-issue-requests/planned-stock'),
      respond: () => jsonResponse(SHORTAGE),
    },
    {
      match: (request) => isGet(request, '/logistics/material-issue-requests'),
      respond: (request) => {
        lists.push(new URL(request.url));
        return jsonResponse({
          items: REQUESTS,
          page: { page: 1, size: 50, total: REQUESTS.length },
        });
      },
    },
    {
      match: (request) => isGet(request, /^\/logistics\/material-issue-requests\/\d+\/history$/),
      respond: () =>
        options.historyStatus !== undefined
          ? jsonResponse({ message: '' }, { status: options.historyStatus })
          : jsonResponse({
              items: [
                {
                  occurredAt: '2026-11-03T09:15:00+07:00',
                  actorName: '합성 관리자',
                  eventCode: 'PLANNED_OVERRIDE',
                  detail: { reason: 'SYN_URGENT', after: [{ itemId: 601, requestedQty: 30 }] },
                },
                {
                  /* UTC 로 와도 공장 현지 시각(UTC+7)으로 보인다 — 11-03 00:00(G2 3). */
                  occurredAt: '2026-11-02T17:00:00Z',
                  actorName: null,
                  eventCode: 'ISSUE_DATE_CHANGED',
                  detail: { before: '2026-11-19', after: '2026-11-20' },
                },
                {
                  occurredAt: '2026-11-02T14:10:00+07:00',
                  actorName: '합성 관리자',
                  eventCode: 'CREATED',
                  detail: {},
                },
              ],
            }),
    },
    {
      match: (request) => isGet(request, /^\/logistics\/material-issue-requests\/\d+$/),
      respond: (request) => {
        const id = Number(pathOf(request).split('/').at(-1));
        return id === 404
          ? jsonResponse({ message: '없음' }, { status: 404 })
          : jsonResponse(detailOf(id));
      },
    },
    /* 새 규칙 요청의 출발 창고 후보 — W/O 라인 부서의 생산 창고(창고 A 만, G2 13). */
    {
      match: (request) => isGet(request, /^\/production\/work-orders\/\d+$/),
      respond: () =>
        jsonResponse({
          workOrderId: 101,
          productionWarehouseMode: true,
          productionWarehouses: [
            { warehouseId: 7001, warehouseCode: 'SYN-PW-A', warehouseName: '합성 생산창고 A' },
          ],
        }),
    },
    {
      match: (request) => request.method !== 'GET',
      respond: async (request) => {
        const body = JSON.parse(await request.clone().text()) as Record<string, unknown>;
        writes.push({ method: request.method, url: new URL(request.url), body });
        const custom = request.method === 'PUT' ? options.respondPut?.(body) : undefined;
        if (custom !== undefined) return custom;
        const id = Number(pathOf(request).split('/').at(-1)?.split(':')[0]);
        return jsonResponse(detailOf(id));
      },
    },
  ];

  renderWithProviders(<MaterialIssueStatusScreen />, {
    fetch: createStubFetch(routes),
    route: options.route ?? '/production/material-issue-status',
  });
  return { user: userEvent.setup(), writes, lists };
};

const listTable = async () => within(await screen.findByRole('table', { name: t.views.list }));
const rowOf = async (requestNo: string) => {
  const found = (await listTable()).getByRole('button', { name: requestNo }).closest('tr');
  if (found === null) throw new Error(`${requestNo} 줄이 없다`);
  return within(found);
};
const panel = async () => within(await screen.findByRole('dialog', { name: t.detail.label }));

describe('W-02-11 출고 요청 현황 — 목록', () => {
  it('US1-5 요청마다 W/O · 생산일 · 출고 작업일 · 출발 생산 창고 · 입고지 · 상태를 보인다', async () => {
    setup();

    const row = await rowOf('SYN-MIR-01');
    expect(row.getByText('SYN-WO-1')).toBeInTheDocument();
    expect(row.getByText('11-23(월)')).toBeInTheDocument();
    expect(row.getByText('11-20(금)')).toBeInTheDocument();
    expect(row.getByText('합성 생산창고 A')).toBeInTheDocument();
    expect(row.getByText('합성 조립 현장')).toBeInTheDocument();
    expect(row.getByText('대기')).toBeInTheDocument();
    expect((await rowOf('SYN-MIR-02')).getByText('진행 중')).toBeInTheDocument();
    expect((await rowOf('SYN-MIR-04')).getByText('완료, W/O 취소')).toBeInTheDocument();
    expect((await rowOf('SYN-MIR-05')).getByText(t.releaseFailed)).toBeInTheDocument();
  });

  it('US6-2 부족이 있는 요청에 「부족 N」을 보이고, 조건이 계약 조건으로 나간다', async () => {
    const { user, lists } = setup();

    expect((await rowOf('SYN-MIR-03')).getByText(t.shortageChip('20'))).toBeInTheDocument();

    await user.click(screen.getByRole('checkbox', { name: t.filters.hasShortage }));
    await waitFor(() => expect(lists.at(-1)?.searchParams.get('hasShortage')).toBe('true'));
    expect(lists.at(-1)?.searchParams.get('plantId')).toBe('8401');

    await user.click(screen.getByRole('button', { name: t.status.WAITING }));
    await waitFor(() =>
      expect(lists.at(-1)?.searchParams.getAll('displayStatus')).toEqual(['WAITING']),
    );
  });

  it('US6-1 계획별 묶음 보기는 생산계획마다 머리줄과 요청 수를 보인다', async () => {
    const { user } = setup();
    await listTable();

    await user.click(screen.getByRole('switch', { name: t.filters.groupByPlan }));

    const table = await listTable();
    expect(await table.findByText(t.planGroup.title('SYN-PP-01'))).toBeInTheDocument();
    expect(table.getByText(t.planGroup.meta(4, 1))).toBeInTheDocument();
    expect(table.getByText(t.planGroup.title('SYN-PP-02'))).toBeInTheDocument();
  });
});

describe('W-02-11 출고 요청 현황 — 상세', () => {
  it('US5-2 대기 요청의 수량을 고쳐 저장하면 바뀐 줄만 versionNo 와 함께 보낸다', async () => {
    const { user, writes } = setup({ route: '/production/material-issue-status?id=1' });
    const detail = await panel();

    const field = await detail.findByRole('textbox', { name: t.detail.lines.qtyLabel('SYN-IT-1') });
    await user.clear(field);
    await user.type(field, '120');
    await user.click(detail.getByRole('button', { name: t.detail.save }));

    await waitFor(() => expect(writes).toHaveLength(1));
    expect(writes[0]?.method).toBe('PUT');
    expect(writes[0]?.body).toEqual({
      versionNo: 3,
      lines: [{ materialIssueRequestLineId: 10, requestedQty: 120 }],
    });
    expect(await screen.findByText(t.toast.saved)).toBeInTheDocument();
  });

  it('US5-6 · US5-10 진행 중 요청은 잠김 안내를 보이고, 기출고 미만 수량은 칸 오류로 저장을 막는다', async () => {
    const { user, writes } = setup({ route: '/production/material-issue-status?id=2' });
    const detail = await panel();

    expect(await detail.findByText(t.detail.locked)).toBeInTheDocument();
    expect(detail.queryByRole('button', { name: t.detail.changeDate })).not.toBeInTheDocument();
    expect(detail.queryByRole('button', { name: t.detail.cancel })).not.toBeInTheDocument();
    expect(detail.getByText(t.detail.cancelLocked)).toBeInTheDocument();

    const field = detail.getByRole('textbox', { name: t.detail.lines.qtyLabel('SYN-IT-1') });
    await user.clear(field);
    await user.type(field, '30');

    expect(detail.getByText(t.detail.lines.belowIssued('SYN-IT-1', '40'))).toBeInTheDocument();
    expect(detail.getByRole('button', { name: t.detail.save })).toBeDisabled();
    expect(writes).toHaveLength(0);
  });

  it('US5-3 출고 작업일 변경 창은 고른 날의 배포 시점을 안내하고, 저장은 날짜와 versionNo 만 보낸다', async () => {
    const { user, writes } = setup({ route: '/production/material-issue-status?id=1' });
    const detail = await panel();

    await user.click(await detail.findByRole('button', { name: t.detail.changeDate }));
    const dateDialog = within(await screen.findByRole('dialog', { name: t.dateDialog.title }));
    expect(dateDialog.getByText(t.dateDialog.scheduled('11-20(금)'))).toBeInTheDocument();
    await user.click(dateDialog.getByRole('button', { name: t.dateDialog.submit }));

    await waitFor(() => expect(writes).toHaveLength(1));
    expect(writes[0]?.body).toEqual({ versionNo: 3, issueWorkDate: '2026-11-20' });
    expect(await screen.findByText(t.toast.dateChanged('11-20(금)'))).toBeInTheDocument();
  });

  it('US5-7 휴일(422 HOLIDAY_ACK_REQUIRED)이면 경고 창을 띄우고 「그래도 변경」은 acknowledgeHoliday 를 실어 다시 보낸다', async () => {
    const { user, writes } = setup({
      route: '/production/material-issue-status?id=1',
      respondPut: (body) =>
        body.acknowledgeHoliday === true
          ? undefined
          : jsonResponse(
              {
                errors: [{ scope: 'screen', code: 'HOLIDAY_ACK_REQUIRED', message: '휴일입니다' }],
              },
              { status: 422 },
            ),
    });
    const detail = await panel();

    await user.click(await detail.findByRole('button', { name: t.detail.changeDate }));
    const dateDialog = within(await screen.findByRole('dialog', { name: t.dateDialog.title }));
    await user.click(dateDialog.getByRole('button', { name: t.dateDialog.submit }));

    const holiday = within(await screen.findByRole('dialog', { name: t.holidayDialog.title }));
    await user.click(holiday.getByRole('button', { name: t.holidayDialog.submit }));

    await waitFor(() => expect(writes).toHaveLength(2));
    expect(writes[1]?.body).toMatchObject({
      acknowledgeHoliday: true,
      issueWorkDate: '2026-11-20',
    });
  });

  it('US5-1 대기 요청 취소는 확인 창에서 사유와 함께 :cancel 로 보낸다', async () => {
    const { user, writes } = setup({ route: '/production/material-issue-status?id=1' });
    const detail = await panel();

    await user.click(await detail.findByRole('button', { name: t.detail.cancel }));
    const dialog = within(
      await screen.findByRole('dialog', { name: t.cancelDialog.title('SYN-MIR-01') }),
    );
    expect(dialog.getByText(t.cancelDialog.waiting)).toBeInTheDocument();
    await user.type(dialog.getByRole('textbox', { name: t.cancelDialog.reason }), '계획 변경');
    await user.click(dialog.getByRole('button', { name: t.cancelDialog.submit }));

    await waitFor(() => expect(writes).toHaveLength(1));
    expect(writes[0]?.url.pathname).toBe('/logistics/material-issue-requests/1:cancel');
    expect(writes[0]?.body).toEqual({ versionNo: 3, reason: '계획 변경' });
    expect(await screen.findByText(t.toast.cancelled('SYN-MIR-01'))).toBeInTheDocument();
  });

  it('409 VERSION_CONFLICT 면 「다른 사람이 먼저 이 요청을 바꿨습니다」와 다시 불러오기', async () => {
    const { user } = setup({
      route: '/production/material-issue-status?id=1',
      respondPut: () =>
        jsonResponse(
          { conflictCause: 'user', code: 'VERSION_CONFLICT', message: '버전이 맞지 않습니다' },
          { status: 409 },
        ),
    });
    const detail = await panel();
    const field = await detail.findByRole('textbox', { name: t.detail.lines.qtyLabel('SYN-IT-1') });
    await user.clear(field);
    await user.type(field, '90');
    await user.click(detail.getByRole('button', { name: t.detail.save }));

    expect(await detail.findByText(t.errors.versionConflict)).toBeInTheDocument();
    expect(detail.getByRole('button', { name: t.errors.reload })).toBeInTheDocument();
  });

  it('이력은 사건 코드로 문장을 만들고, 사람이 없는 사건은 「자동 배포」로 보인다', async () => {
    setup({ route: '/production/material-issue-status?id=1' });
    const detail = await panel();

    expect(
      await detail.findByText(t.detail.events.ISSUE_DATE_CHANGED('11-19(목)', '11-20(금)')),
    ).toBeInTheDocument();
    expect(detail.getByText(/자동 배포/)).toBeInTheDocument();
    expect(detail.getByText(t.detail.events.CREATED())).toBeInTheDocument();
    /* FR-018 — 예정분을 가져간 사건은 요청 사유를 이름으로 보인다. */
    expect(
      await detail.findByText(t.detail.events.PLANNED_OVERRIDE('합성 긴급 대응')),
    ).toBeInTheDocument();
  });

  it('배포 실패 요청은 상세 위에 원인을 보인다', async () => {
    setup({ route: '/production/material-issue-status?id=5' });
    const detail = await panel();

    expect(
      await detail.findByText(t.detail.releaseFailed('출발 생산 창고가 비활성입니다.')),
    ).toBeInTheDocument();
  });
});

describe('W-02-11 출고 요청 현황 — 부족', () => {
  it('US2-9 · US2-12 「재고 있는 생산 창고 없음」 묶음은 W/O 단위로 보이고, 보충한 행은 「보충 요청됨」', async () => {
    setup({ route: '/production/material-issue-status?view=shortage' });

    const table = within(await screen.findByRole('table', { name: t.shortage.tableLabel }));
    expect(table.getByText(t.shortage.unsourcedTitle)).toBeInTheDocument();
    expect(table.getByText(t.shortage.unsourcedNote(2))).toBeInTheDocument();
    expect(table.getByText(t.shortage.replenished('SYN-MIR-15'))).toBeInTheDocument();
    expect(
      table.getByRole('link', { name: t.shortage.replenishLabel('SYN-WO-21 SYN-IT-2') }),
    ).toHaveAttribute(
      'href',
      replenishLink({
        workOrderId: 201,
        workOrderNo: 'SYN-WO-21',
        itemId: 602,
        qty: 20,
        unsourcedShortageId: 71,
      }),
    );
  });

  it('US4-6 생산 창고별 부족의 요청 배분 줄마다 「보충 요청 →」이 W-02-10 을 채워 연다', async () => {
    setup({ route: '/production/material-issue-status?view=shortage' });

    const table = within(await screen.findByRole('table', { name: t.shortage.tableLabel }));
    const link = table.getByRole('link', {
      name: t.shortage.replenishLabel('SYN-MIR-03 SYN-IT-1'),
    });
    const href = new URL(link.getAttribute('href') ?? '', 'http://x');
    expect(href.pathname).toBe('/production/material-issue-requests');
    expect(Object.fromEntries(href.searchParams)).toEqual({
      wo: '103',
      woNo: 'SYN-WO-3',
      item: '601',
      qty: '20',
      reason: 'SHORTAGE_SUPPLEMENT',
      src: '7001',
    });
    expect(screen.getByRole('button', { name: t.views.shortageCount(3) })).toBeInTheDocument();
  });
});

describe('W-02-11 출고 요청 현황 — G2 확인', () => {
  it('US6-1 처음 열 때도 조회 중인 공장을 공장 칸에 보인다', async () => {
    setup();
    await listTable();

    expect(screen.getByLabelText(t.filters.plant)).toHaveTextContent('합성 1공장');
  });

  it('US2-6 이력 시각은 공장 현지 시각이다(UTC 로 와도)', async () => {
    setup({ route: '/production/material-issue-status?id=1' });
    const detail = await panel();

    expect(await detail.findByText(`11-03 00:00 ${t.detail.systemActor}`)).toBeInTheDocument();
  });

  it('이력 조회가 403 이면 「이력이 없습니다」가 아니라 권한 안내를 보인다', async () => {
    setup({ route: '/production/material-issue-status?id=1', historyStatus: 403 });
    const detail = await panel();

    expect(await detail.findByText(messages.httpError.forbidden)).toBeInTheDocument();
    expect(detail.queryByText(t.detail.noHistory)).not.toBeInTheDocument();
  });

  it('없는 요청(404)을 열면 상세에 맞는 안내를 보인다', async () => {
    setup({ route: '/production/material-issue-status?id=404' });
    const detail = await panel();

    expect(await detail.findByText(t.detail.notFound)).toBeInTheDocument();
  });

  it('US2-6 새 규칙 요청의 출발 생산 창고 후보는 W/O 라인 부서의 생산 창고뿐이다', async () => {
    const { user } = setup({ route: '/production/material-issue-status?id=1' });
    const detail = await panel();

    await user.click(await detail.findByLabelText(t.detail.sourceWarehouse));
    expect(
      await screen.findByRole('option', { name: 'SYN-PW-A 합성 생산창고 A' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('option', { name: 'SYN-PW-B 합성 생산창고 B' }),
    ).not.toBeInTheDocument();
  });

  it('US4-7 부족 보기에 예정분을 가져간 이력 한 줄을 보인다', async () => {
    setup({ route: '/production/material-issue-status?view=shortage' });

    const table = within(await screen.findByRole('table', { name: t.shortage.tableLabel }));
    expect(
      await table.findByText(
        t.shortage.overrideNote(
          '11-03 09:15',
          '합성 관리자',
          'SYN-MIR-03',
          t.detail.events.PLANNED_OVERRIDE('합성 긴급 대응'),
        ),
      ),
    ).toBeInTheDocument();
  });
});
