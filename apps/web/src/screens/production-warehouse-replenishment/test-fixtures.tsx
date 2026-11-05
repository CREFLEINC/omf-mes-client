import type {
  MaterialIssueRequestDetailForward,
  MaterialIssueRequestForward,
  ReplenishmentItem,
  ReplenishmentSettings,
} from '@omf-mes/api-client';
import userEvent from '@testing-library/user-event';

import {
  createStubFetch,
  jsonResponse,
  renderWithProviders,
  type StubRoute,
} from '../../test/api-harness';
import { ProductionWarehouseReplenishmentScreen } from './screen';

/**
 * W-02-12 화면 시험 받침 — 공장 · 창고 · 품목 · 요청은 모두 합성 값이다(시험 전용, 화면이 쓰지 않는다).
 * 생산창고 A(7001) · B(7002), 자재창고 1(7101) · 2(7102), 불량창고(7199).
 */
export const PLANT = {
  plantId: 8401,
  businessUnitId: 8301,
  legalEntityId: 8201,
  plantCode: 'G1',
  plantName: '합성 1공장',
  timezoneCode: 'Asia/Ho_Chi_Minh',
  isActive: true,
};

const warehouse = (id: number, code: string, name: string, isDefect = false) => ({
  warehouseId: id,
  plantId: 8401,
  businessUnitId: 8301,
  warehouseCode: code,
  warehouseName: name,
  warehouseTypeCode: 'MATERIAL',
  isExternal: false,
  isDefect,
  isActive: true,
});

export const WAREHOUSES = [
  warehouse(7001, 'SYN-PW-A', '합성 생산창고 A'),
  warehouse(7002, 'SYN-PW-B', '합성 생산창고 B'),
  warehouse(7101, 'SYN-MW-1', '합성 자재창고 1'),
  warehouse(7102, 'SYN-MW-2', '합성 자재창고 2'),
  warehouse(7199, 'SYN-NG', '합성 불량창고', true),
];

export const SETTINGS: ReplenishmentSettings = {
  plantDefaultRunTime: '01:00',
  plantDefaultSource: 'POLICY',
  warehouses: [
    {
      warehouseId: 7001,
      warehouseCode: 'SYN-PW-A',
      warehouseName: '합성 생산창고 A',
      runTime: '07:00',
      effectiveRunTime: '07:00',
      versionNo: 2,
      lastRun: null,
    },
    {
      warehouseId: 7002,
      warehouseCode: 'SYN-PW-B',
      warehouseName: '합성 생산창고 B',
      runTime: null,
      effectiveRunTime: '01:00',
      versionNo: 1,
      lastRun: null,
    },
  ],
};

const item = (id: number, code: string, name: string, uomId: number) => ({
  itemId: id,
  itemCode: code,
  itemName: name,
  itemTypeCode: 'RAW_MATERIAL',
  baseUomId: uomId,
  lotControlled: true,
  serialControlTypeCode: 'NONE',
  inspectionRequired: false,
  fifoPolicyCode: 'FIFO',
  negativeStockAllowed: false,
  isActive: true,
});

/** 품목 마스터 — 동선(관리 품목) · 라벨지(관리 품목, 기준 아래) · 테이프(관리 품목 아님). */
export const ITEMS = [
  item(601, 'SYN-IT-1', '합성 동선', 1),
  item(602, 'SYN-IT-2', '합성 라벨지', 2),
  item(603, 'SYN-IT-3', '합성 테이프', 2),
];

export const managedItem = (
  id: number,
  overrides: Partial<ReplenishmentItem> = {},
): ReplenishmentItem => ({
  replenishmentItemId: id,
  productionWarehouseId: 7001,
  productionWarehouseCode: 'SYN-PW-A',
  productionWarehouseName: '합성 생산창고 A',
  itemId: 601,
  itemCode: 'SYN-IT-1',
  itemName: '합성 동선',
  sourceWarehouseId: 7101,
  sourceWarehouseCode: 'SYN-MW-1',
  sourceWarehouseName: '합성 자재창고 1',
  reorderPointQty: 50,
  targetQty: 200,
  uomCode: 'KG',
  availableQty: 80,
  plannedQty: 40,
  usableQty: 40,
  inProgressQty: 0,
  belowPoint: true,
  versionNo: 3,
  ...overrides,
});

export const MANAGED: ReplenishmentItem[] = [
  managedItem(1, { belowPoint: false, availableQty: 260, plannedQty: 0, usableQty: 260 }),
  managedItem(2, {
    itemId: 602,
    itemCode: 'SYN-IT-2',
    itemName: '합성 라벨지',
    sourceWarehouseId: 7102,
    sourceWarehouseCode: 'SYN-MW-2',
    sourceWarehouseName: '합성 자재창고 2',
    reorderPointQty: 400,
    targetQty: 1000,
    uomCode: 'EA',
    availableQty: 160,
    plannedQty: 40,
    usableQty: 120,
    inProgressQty: 100,
  }),
];

/** (창고, 품목) 가용 · 예정 · 남은 수량. 자재창고 2 의 테이프는 남은 수량 0. */
export const PLANNED_STOCK = {
  items: [
    { sourceWarehouseId: 7001, itemId: 601, availableQty: 80, plannedQty: 40, freeQty: 40 },
    { sourceWarehouseId: 7001, itemId: 603, availableQty: 10, plannedQty: 0, freeQty: 10 },
    { sourceWarehouseId: 7101, itemId: 601, availableQty: 300, plannedQty: 40, freeQty: 260 },
    { sourceWarehouseId: 7102, itemId: 602, availableQty: 300, plannedQty: 0, freeQty: 300 },
    { sourceWarehouseId: 7102, itemId: 603, availableQty: 50, plannedQty: 50, freeQty: 0 },
  ].map((row) => ({
    ...row,
    itemCode: `SYN-IT-${String(row.itemId - 600)}`,
    itemName: '합성',
    shortageQty: 0,
    requests: [],
  })),
};

export const request = (
  id: number,
  overrides: Partial<MaterialIssueRequestForward> = {},
): MaterialIssueRequestForward => ({
  materialIssueRequestId: id,
  issueRequestNo: `SYN-MIR-${String(id).padStart(2, '0')}`,
  workOrderId: 0,
  destinationLocationId: 501,
  destinationLocationName: '합성 적치 대기',
  statusCode: 'REGISTERED',
  displayStatus: 'RELEASED',
  requestTypeCode: 'REPLENISHMENT',
  replenishmentOriginCode: 'DIRECT',
  destinationWarehouseId: 7001,
  destinationWarehouseName: '합성 생산창고 A',
  sourceWarehouseId: 7101,
  sourceWarehouseName: '합성 자재창고 1',
  releasedAt: '2026-11-05T09:12:00+07:00',
  lineCount: 1,
  shortageQtyTotal: 0,
  dynamicShortageQtyTotal: 0,
  receiptSummary: { issuedCount: 0, receivedCount: 0 },
  replenishmentStatus: 'DISPATCHED',
  qtySummary: { requestedQty: 120, issuedQty: 0, closedQty: 0, uomCode: 'KG' },
  versionNo: 4,
  ...overrides,
});

export const REQUESTS: MaterialIssueRequestForward[] = [
  request(1, { replenishmentOriginCode: 'AUTO' }),
  request(2, {
    displayStatus: 'IN_PROGRESS',
    replenishmentStatus: 'IN_PROGRESS',
    qtySummary: { requestedQty: 160, issuedQty: 100, closedQty: 0, uomCode: 'KG' },
    receiptSummary: { issuedCount: 2, receivedCount: 1 },
  }),
  request(3, {
    displayStatus: 'IN_PROGRESS',
    replenishmentStatus: 'IN_PROGRESS',
    lineCount: 2,
    qtySummary: null,
    destinationWarehouseName: '합성 생산창고 B',
    shortageQtyTotal: 200,
  }),
  request(4, {
    displayStatus: 'DONE',
    replenishmentStatus: 'REMAINDER_CLOSED',
    qtySummary: { requestedQty: 160, issuedQty: 100, closedQty: 60, uomCode: 'KG' },
    closeReasonCode: 'REMAINDER_CLOSED' as unknown as 'WO_CLOSED',
    closeReasonDetailCode: 'STOCK_OUT',
    closeRemark: '합성 납기 지연',
    closedAt: '2026-11-05T10:00:00+07:00',
    receiptSummary: { issuedCount: 1, receivedCount: 1 },
  }),
  request(5, { displayStatus: 'DONE', replenishmentStatus: 'COMPLETED' }),
  request(6, { displayStatus: 'CANCELLED', statusCode: 'CANCELLED', replenishmentStatus: 'CANCELLED' }),
];

const line = (requestId: number, requested: number, picked: number, issued: number) => ({
  materialIssueRequestLineId: requestId * 10,
  materialIssueRequestId: requestId,
  lineNo: 1,
  itemId: 601,
  itemCode: 'SYN-IT-1',
  itemName: '합성 동선',
  uomId: 1,
  uomCode: 'KG',
  requestedQty: requested,
  pickedQty: picked,
  issuedQty: issued,
});

/** 상세 — 1 진행 없음, 2 출고 100/160, 3 집고 출고 안 함 120, 4 마감(출고 100, 마감 60). */
export const detailOf = (id: number): MaterialIssueRequestDetailForward => {
  const base = REQUESTS.find((row) => row.materialIssueRequestId === id) ?? request(id);
  const lines =
    id === 2
      ? [line(2, 160, 100, 100)]
      : id === 3
        ? [line(3, 300, 120, 0)]
        : id === 4
          ? [line(4, 160, 100, 100)]
          : [line(id, 120, 0, 0)];
  const goodsIssues =
    id === 2
      ? [
          {
            goodsIssueId: 91,
            goodsIssueNo: 'SYN-GI-91',
            issuedAt: '2026-11-03T07:20:00Z',
            received: true,
            shopfloorReceiptId: 81,
          },
          {
            goodsIssueId: 92,
            goodsIssueNo: 'SYN-GI-92',
            issuedAt: '2026-11-04T10:05:00+07:00',
            received: false,
            shopfloorReceiptId: null,
          },
        ]
      : [];
  return { materialIssueRequest: { ...base, goodsIssues }, lines };
};

export interface Recorded {
  method: string;
  url: URL;
  body: unknown;
}

export interface SetupOptions {
  route?: string;
  settings?: ReplenishmentSettings;
  managed?: ReplenishmentItem[];
  /** 쓰기 응답을 바꾼다 — 없으면 경로별 기본 응답. */
  respondWrite?: (method: string, path: string, body: unknown) => Response | undefined;
  /** 이력에 넣을 사건. */
  history?: unknown[];
}

const pathOf = (req: Request) => new URL(req.url).pathname;
const isGet = (req: Request, path: string | RegExp) =>
  req.method === 'GET' &&
  (typeof path === 'string' ? pathOf(req) === path : path.test(pathOf(req)));
const page = (items: unknown[]) => ({ items, page: { page: 1, size: 50, total: items.length } });

export const setupScreen = (options: SetupOptions = {}) => {
  const writes: Recorded[] = [];
  const gets: URL[] = [];
  const managed = options.managed ?? MANAGED;

  const routes: StubRoute[] = [
    {
      match: (req) => {
        if (req.method === 'GET') gets.push(new URL(req.url));
        return false;
      },
      respond: () => jsonResponse({}),
    },
    { match: (req) => isGet(req, '/mdm/plants'), respond: () => jsonResponse(page([PLANT])) },
    {
      match: (req) => isGet(req, '/logistics/replenishment-settings'),
      respond: () => jsonResponse(options.settings ?? SETTINGS),
    },
    { match: (req) => isGet(req, '/mdm/warehouses'), respond: () => jsonResponse(page(WAREHOUSES)) },
    {
      match: (req) => isGet(req, '/mdm/uoms'),
      respond: () =>
        jsonResponse(
          page([
            { uomId: 1, uomCode: 'KG', uomName: '킬로그램', isActive: true },
            { uomId: 2, uomCode: 'EA', uomName: '개', isActive: true },
          ]),
        ),
    },
    {
      match: (req) => isGet(req, /^\/mdm\/items\/\d+$/),
      respond: (req) => {
        const id = Number(pathOf(req).split('/').at(-1));
        return jsonResponse({ item: ITEMS.find((row) => row.itemId === id) ?? ITEMS[0] });
      },
    },
    { match: (req) => isGet(req, '/mdm/items'), respond: () => jsonResponse(page(ITEMS)) },
    {
      match: (req) => isGet(req, '/logistics/material-issue-requests/planned-stock'),
      respond: () => jsonResponse(PLANNED_STOCK),
    },
    {
      match: (req) => isGet(req, '/logistics/replenishment-items'),
      respond: (req) => {
        const query = new URL(req.url).searchParams;
        const warehouseId = query.get('productionWarehouseId');
        const rows = managed.filter(
          (row) =>
            (warehouseId === null || String(row.productionWarehouseId) === warehouseId) &&
            (query.get('belowPointOnly') !== 'true' || row.belowPoint),
        );
        return jsonResponse(page(rows));
      },
    },
    {
      match: (req) => isGet(req, /^\/logistics\/material-issue-requests\/\d+\/history$/),
      respond: () => jsonResponse({ items: options.history ?? [] }),
    },
    {
      match: (req) => isGet(req, /^\/logistics\/material-issue-requests\/\d+$/),
      respond: (req) => jsonResponse(detailOf(Number(pathOf(req).split('/').at(-1)))),
    },
    {
      match: (req) => isGet(req, '/logistics/material-issue-requests'),
      respond: (req) => {
        const query = new URL(req.url).searchParams;
        /* 머리 숫자(활성 요청 수)는 한 건만 받는다 — 전체 수만 맞춘다. */
        if (query.get('size') === '1') {
          return jsonResponse({ items: [], page: { page: 1, size: 1, total: 3 } });
        }
        return jsonResponse(page(REQUESTS));
      },
    },
    {
      match: (req) => isGet(req, '/app/operation-policies'),
      respond: () => jsonResponse(page([])),
    },
    {
      match: (req) => req.method !== 'GET',
      respond: async (req) => {
        const text = await req.clone().text();
        const body: unknown = text === '' ? null : JSON.parse(text);
        const path = pathOf(req);
        writes.push({ method: req.method, url: new URL(req.url), body });
        const custom = options.respondWrite?.(req.method, path, body);
        if (custom !== undefined) return custom;
        if (path === '/logistics/replenishment-requests') {
          return jsonResponse({ requests: [request(11)], skippedLines: [] }, { status: 201 });
        }
        if (path.endsWith(':close-remaining')) return jsonResponse(request(2));
        if (path.endsWith(':cancel')) return jsonResponse(detailOf(1));
        if (req.method === 'DELETE') return jsonResponse({ inProgressRequestCount: 0 });
        if (path.startsWith('/logistics/replenishment-settings')) {
          return jsonResponse(SETTINGS.warehouses[0]);
        }
        if (path.startsWith('/app/operation-policies')) {
          return jsonResponse({ operationPolicyId: 1 }, { status: 201 });
        }
        return jsonResponse(managedItem(9), { status: req.method === 'POST' ? 201 : 200 });
      },
    },
  ];

  renderWithProviders(<ProductionWarehouseReplenishmentScreen />, {
    fetch: createStubFetch(routes),
    route: options.route ?? '/production/warehouse-replenishment',
  });
  return { user: userEvent.setup(), writes, gets };
};

export const writesTo = (writes: readonly Recorded[], method: string, suffix: string) =>
  writes.filter((write) => write.method === method && write.url.pathname.endsWith(suffix));
