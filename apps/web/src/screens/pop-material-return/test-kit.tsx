import { messages } from '@omf-mes/i18n';
import { screen } from '@testing-library/react';
import type userEvent from '@testing-library/user-event';

import { PopIdentityProvider, type PopIdentity } from '../../patterns/pop-identity';
import { PuToastHost } from '../../patterns/pop-uniform';
import { createStubFetch, jsonResponse, renderWithProviders } from '../../test/api-harness';
import type { SplitMaterialLot } from '../goods-issue-qr/split-lots';
import type { MaterialReturnLotLookup } from './lines';
import type { MaterialReturn } from './outbox';
import type { ReturnWorkOrder, ReturnWorkOrderLot } from './queries';
import { PopMaterialReturnScreen } from './screen';

/*
 * 시험 전용(합성값) — P-01-03 반납 입고 화면을 스텁 서버 위에 띄운다. 런타임 코드는 이 모듈을 참조하지 않는다.
 */

export const WORKER = '900028';
export const TERMINAL_WAREHOUSE = { warehouseId: 31, warehouseName: 'G 생산창고' };

export const lookupOf = (
  overrides: Partial<MaterialReturnLotLookup> = {},
): MaterialReturnLotLookup => ({
  lotId: 501,
  lotNo: 'SYN-M00000220261120000031',
  item: { itemId: 11, itemCode: 'SYN-A100', itemName: '합성 볼트 M4×10' },
  uom: { uomId: 1, uomCode: 'EA' },
  returnableQty: 100,
  workOrder: { workOrderId: 610, workOrderNo: 'WO-SYN-0010', finalized: false },
  issueWarehouse: { ...TERMINAL_WAREHOUSE },
  labelUnprinted: false,
  ...overrides,
});

export const workOrderOf = (overrides: Partial<ReturnWorkOrder> = {}): ReturnWorkOrder => ({
  workOrderId: 635,
  workOrderNo: 'WO-SYN-0011',
  /* W/O 생산 품목 — 목록 줄에는 보이지 않는다. 줄에는 나간 자재(`returnableMaterial`)를 보인다. */
  item: { itemId: 90, itemCode: 'SYN-P900', itemName: '합성 완제품' },
  processName: '공정 20 조립',
  lineName: 'L2',
  lastIssuedAt: '2026-11-27T02:40:00Z',
  finalized: false,
  returnableLotCount: 3,
  unprintedLotCount: 1,
  returnableMaterial: {
    item: { itemId: 21, itemCode: 'SYN-B220', itemName: '합성 하우징 커버' },
    otherItemCount: 2,
  },
  ...overrides,
});

export const woLotOf = (overrides: Partial<ReturnWorkOrderLot> = {}): ReturnWorkOrderLot => ({
  lotId: 541,
  lotNo: 'SYN-M00000220261127000041',
  item: { itemId: 21, itemCode: 'SYN-B220', itemName: '합성 하우징 커버' },
  uom: { uomId: 1, uomCode: 'EA' },
  goodsIssueLineId: 9001,
  issuedAt: '2026-11-27T02:40:00Z',
  issueQty: 300,
  returnableQty: 300,
  labelUnprinted: true,
  ...overrides,
});

export const splitLotOf = (lotId: number, lotNo: string): SplitMaterialLot => ({
  lotId,
  lotNo,
  statusCode: 'NORMAL',
  lifecycleStatusCode: 'ACTIVE',
  item: { itemId: 21, itemCode: 'SYN-B220', itemName: '합성 하우징 커버' },
  uomId: 1,
  uomCode: 'EA',
  qty: 300,
  supplier: null,
  parentLot: { lotId: 540, lotNo: 'SYN-M00000220261127000040' },
  splitAt: '2026-11-27T02:40:00Z',
  goodsIssue: { goodsIssueId: 81, goodsIssueNo: 'GI-SYN-0081', goodsIssueLineId: 9001, lineNo: 1 },
  destination: null,
  labelIssue: null,
});

export interface Sent {
  method: string;
  path: string;
  search: URLSearchParams;
  headers: Headers;
  body: unknown;
}

export interface KitOptions {
  lookup?: (lotNo: string) => Response;
  receive?: (body: { lines: { lotId: number; returnQty: number }[] }) => Response;
  workOrders?: (query: string | null) => ReturnWorkOrder[];
  workOrderLots?: (workOrderId: number) => ReturnWorkOrderLot[];
  splitLots?: SplitMaterialLot[];
  terminalWarehouseId?: number | null;
  /** 단말 화면 정책(P-10)의 화면 코드. 주지 않으면 정책 조회가 실패해 「모른다」로 둔다(막지 않는다). */
  screenCodes?: string[];
  /** 「반납 가능」이 꺼진 단말 — 반납 API 가 403 이다. */
  forbidden?: boolean;
}

const FORBIDDEN = () =>
  jsonResponse(
    { errors: [{ scope: 'screen', code: 'FORBIDDEN', message: '권한이 없습니다.' }] },
    { status: 403 },
  );

/**
 * 등록 응답 — 보낸 줄 그대로, 받은 곳은 적치 대기(줄마다 적치 지시). `whole` 의 LOT 은 사람 위치 없는 생산창고의
 * 창고 전체로 받은 줄이라 적치 지시(`putawayTaskId`)가 없다.
 */
export const receivedOf = (
  body: { lines: { lotId: number; returnQty: number }[] },
  unprinted: readonly number[] = [],
  whole: readonly number[] = [],
): MaterialReturn => ({
  materialReturnId: 77,
  materialReturnNo: 'MR-SYN-0001',
  destinationWarehouseId: 31,
  statusCode: 'RECEIVED',
  requestedAt: '2026-11-28T02:10:00Z',
  lines: body.lines.map((line, index) => ({
    materialReturnLineId: 700 + index,
    itemId: 11,
    lotId: line.lotId,
    returnQty: line.returnQty,
    uomId: 1,
    labelUnprinted: unprinted.includes(line.lotId),
    ...(whole.includes(line.lotId) ? {} : { putawayTaskId: 900 + index }),
  })),
});

export const renderReturn = (options: KitOptions = {}) => {
  const sent: Sent[] = [];
  const record = async (request: Request): Promise<unknown> => {
    const url = new URL(request.url);
    const text = request.method === 'GET' ? '' : await request.clone().text();
    const body = text === '' ? null : (JSON.parse(text) as unknown);
    sent.push({
      method: request.method,
      path: url.pathname,
      search: url.searchParams,
      headers: request.headers,
      body,
    });
    return body;
  };
  const pathIs = (path: string) => (request: Request) => new URL(request.url).pathname === path;
  let issueSeq = 0;
  /* 기본 조회는 LOT 번호마다 다른 lotId 를 준다 — 같은 번호면 같은 LOT. */
  const lotIds = new Map<string, number>();
  const lotIdOf = (lotNo: string): number => {
    if (!lotIds.has(lotNo)) lotIds.set(lotNo, 501 + lotIds.size);
    return lotIds.get(lotNo) ?? 0;
  };

  const fetch = createStubFetch([
    ...(options.screenCodes === undefined
      ? []
      : [
          {
            match: pathIs('/mdm/terminals/7/accessible-screens'),
            respond: () => jsonResponse({ terminalId: 7, screenCodes: options.screenCodes }),
          },
        ]),
    ...(options.forbidden === true
      ? [
          {
            match: (request: Request) =>
              new URL(request.url).pathname.startsWith('/production/material-returns'),
            respond: FORBIDDEN,
          },
        ]
      : []),
    {
      match: pathIs('/production/material-returns/lot-lookup'),
      respond: async (request) => {
        await record(request);
        const lotNo = new URL(request.url).searchParams.get('lotNo') ?? '';
        return options.lookup?.(lotNo) ?? jsonResponse(lookupOf({ lotId: lotIdOf(lotNo), lotNo }));
      },
    },
    {
      match: (request) =>
        pathIs('/production/material-returns')(request) && request.method === 'POST',
      respond: async (request) => {
        const body = (await record(request)) as { lines: { lotId: number; returnQty: number }[] };
        return options.receive?.(body) ?? jsonResponse(receivedOf(body), { status: 201 });
      },
    },
    {
      match: pathIs('/production/material-returns/work-orders'),
      respond: async (request) => {
        await record(request);
        const query = new URL(request.url).searchParams.get('q');
        const items = options.workOrders?.(query) ?? [workOrderOf()];
        return jsonResponse({ items, page: { page: 1, size: 50, total: items.length } });
      },
    },
    {
      match: (request) =>
        /^\/production\/material-returns\/work-orders\/\d+\/lots$/u.test(
          new URL(request.url).pathname,
        ),
      respond: async (request) => {
        await record(request);
        const id = Number(new URL(request.url).pathname.split('/')[4]);
        return jsonResponse({ items: options.workOrderLots?.(id) ?? [woLotOf()] });
      },
    },
    {
      match: pathIs('/mdm/terminals/7'),
      respond: () =>
        jsonResponse({
          terminalId: 7,
          terminalCode: 'POP-SYN-G',
          plantId: 7701,
          warehouseId:
            options.terminalWarehouseId === undefined
              ? TERMINAL_WAREHOUSE.warehouseId
              : options.terminalWarehouseId,
          warehouseName:
            options.terminalWarehouseId === null ? null : TERMINAL_WAREHOUSE.warehouseName,
        }),
    },
    {
      match: pathIs('/logistics/split-material-lots'),
      respond: async (request) => {
        await record(request);
        const items = options.splitLots ?? [];
        return jsonResponse({
          items,
          page: { page: 1, size: 50, total: items.length },
          unprintedCount: items.length,
        });
      },
    },
    {
      match: (request) => pathIs('/app/document-issues')(request) && request.method === 'POST',
      respond: async (request) => {
        await record(request);
        issueSeq += 1;
        return jsonResponse(
          {
            items: [
              {
                documentIssueLogId: 8000 + issueSeq,
                issueSeq: 1,
                lotId: null,
                printOutcome: 'PENDING',
              },
            ],
          },
          { status: 201 },
        );
      },
    },
    {
      match: (request) => /:report-print$/u.test(new URL(request.url).pathname),
      respond: async (request) => {
        await record(request);
        return jsonResponse({});
      },
    },
    {
      match: pathIs('/app/printers'),
      respond: () =>
        jsonResponse({
          items: [
            {
              printerName: 'syn-label-printer',
              displayName: '합성 라벨 프린터',
              status: 'READY',
              statusMessage: '대기 중',
              isDefault: true,
            },
          ],
        }),
    },
  ]);
  const identity: PopIdentity = {
    terminalId: 7,
    processes: [],
    equipment: null,
    workerNo: WORKER,
    plantId: 7701,
  };

  renderWithProviders(
    <PopIdentityProvider value={identity}>
      <PopMaterialReturnScreen />
      <PuToastHost />
    </PopIdentityProvider>,
    { fetch },
  );

  return { sent };
};

const t = messages.materialReturn;

export const scanLot = async (user: ReturnType<typeof userEvent.setup>, lotNo: string) => {
  const field = screen.getByRole('textbox', { name: t.pop.scanLabel });
  await user.type(field, `${lotNo}{Enter}`);
  await screen.findByText(lotNo);
};

export const pressKeys = async (user: ReturnType<typeof userEvent.setup>, digits: string) => {
  for (const digit of digits) {
    const keys = screen.getAllByRole('button', { name: digit });
    /* 창이 떠 있으면 창 아래 판의 키패드(마지막에 그린 것)를 누른다. */
    const key = keys.at(-1);
    if (key === undefined) throw new Error(`키 ${digit} 가 없다`);
    await user.click(key);
  }
};
