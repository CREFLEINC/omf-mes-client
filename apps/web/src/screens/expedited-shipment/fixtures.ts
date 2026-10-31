import { createStubFetch, jsonResponse, type StubFetch } from '../../test/api-harness';

/**
 * 이 화면의 감지기가 쓰는 목 응답.
 *
 * ⚠ 값은 전부 **지어낸 합성값**이다 — 실 사번·품목코드·LOT 번호를 쓰지 않는다(공개 저장소 경계).
 * 상태 코드 문자열도 값 목록이 미확정이라 계약이 표기한 값이나 자리표시로 둔다.
 */

export interface ExpeditedStubOptions {
  /** LOT의 품질 판정 축 값. 차단 갈래를 몰 때 쓴다. */
  lotStatusCode?: string;
  /** LOT의 보류 여부. `undefined`면 서버가 필드를 안 내리는 상태다. */
  lotHeld?: boolean | undefined;
  /** 서버가 `held`를 아예 안 내린다. */
  omitHeld?: boolean;
  /** 활성 창고를 여럿 둔다 — 자동 확정이 안 되는 갈래. */
  manyWarehouses?: boolean;
  /**
   * 「창고 안을 나눈 창고」(`dividedOnly=true`가 내는 창고)를 하나 섞는다 — 위치 입력 칸이 없는
   * 이 화면에서는 후보에서 빠져야 한다(장부 P-153 · 대응표 「긴급 직행 위치」).
   */
  dividedWarehouse?: boolean;
  /** 나눈 창고 목록 조회만 실패시킨다. */
  dividedWarehousesFail?: boolean;
  /** 출하 라인의 품목을 바꾼다 — 맞는 라인이 없는 갈래. */
  lineItemId?: number;
  /** 배정·출하 수량을 바꾼다. */
  allocatedQty?: number;
  shippedQty?: number;
  /** 쓰기 응답을 갈아 끼운다. */
  createResponse?: () => Response;
}

let sent: Request[] = [];

/** 감지기가 「무엇이 나갔나」를 볼 수 있게 모아 둔다. */
export const requestsSent = (): Request[] => sent;
export const requestedPaths = (): string[] =>
  sent.map((request) => {
    const url = new URL(request.url);
    return `${url.pathname}${url.search}`;
  });

const page = (total: number) => ({ page: 1, size: 100, total });

export const expeditedStub = (options: ExpeditedStubOptions = {}): StubFetch => {
  sent = [];

  const lot: Record<string, unknown> = {
    lotId: 9001,
    lotNo: 'SYNTH-LOT-0311',
    itemId: 5001,
    lotTypeCode: 'PRODUCTION',
    plantId: 1001,
    initialQty: 500,
    uomId: 7001,
    sourceTypeCode: 'PRODUCTION_ORDER',
    sourceId: 6001,
    statusCode: options.lotStatusCode ?? 'NORMAL',
    ...(options.omitHeld === true ? {} : { held: options.lotHeld ?? false }),
  };

  const shipmentRequest = {
    shipmentRequestId: 3001,
    shipmentRequestNo: 'SYNTH-SR-0470',
    customerId: 2101,
    shipToPartnerId: 2102,
    requestedShipDate: '2026-09-01',
    statusCode: 'CODE-A',
    shippingInspectionStatusCode: 'CODE-B',
    lines: [
      {
        shipmentRequestLineId: 4001,
        lineNo: 1,
        shipmentRequestId: 3001,
        itemId: options.lineItemId ?? 5001,
        requestedQty: 500,
        allocatedQty: options.allocatedQty ?? 500,
        pickedQty: 0,
        shippedQty: options.shippedQty ?? 200,
        uomId: 7001,
        shippingInspectionRequired: false,
      },
    ],
  };

  /*
   * ⭐ 위치 입력 칸이 없는 이 화면에서는 나눈 창고가 활성 창고에 섞여 있어도 후보에서 빠져야
   * 한다(P-153) — 활성 창고 «전체» 개수가 아니라 나누지 않은 창고 개수로 자동/선택이 갈리는지를
   * 이 값으로 확인한다. 이 창고는 활성 목록과 `dividedOnly=true` 목록 양쪽에 실린다.
   */
  const dividedWarehouses =
    options.dividedWarehouse === true
      ? [
          {
            warehouseId: 2099,
            plantId: 1001,
            businessUnitId: 1,
            warehouseCode: 'SYNTH-WH-DIV',
            warehouseName: '합성 위치 나눈 창고',
            isActive: true,
          },
        ]
      : [];

  const warehouses = [
    ...(options.manyWarehouses === true
      ? [
          {
            warehouseId: 2001,
            plantId: 1001,
            businessUnitId: 1,
            warehouseCode: 'SYNTH-WH-1',
            warehouseName: '합성 창고 1',
            isActive: true,
          },
          {
            warehouseId: 2002,
            plantId: 1001,
            businessUnitId: 1,
            warehouseCode: 'SYNTH-WH-2',
            warehouseName: '합성 창고 2',
            isActive: true,
          },
        ]
      : [
          {
            warehouseId: 2001,
            plantId: 1001,
            businessUnitId: 1,
            warehouseCode: 'SYNTH-WH-1',
            warehouseName: '합성 창고 1',
            isActive: true,
          },
        ]),
    ...dividedWarehouses,
  ];

  const routes = [
    {
      match: (request: Request) => new URL(request.url).pathname === '/trace/lots',
      respond: () => jsonResponse({ items: [lot], page: page(1) }),
    },
    {
      match: (request: Request) =>
        new URL(request.url).pathname === '/logistics/shipment-requests' &&
        request.method === 'GET',
      respond: () => jsonResponse({ items: [shipmentRequest], page: page(1) }),
    },
    {
      match: (request: Request) =>
        new URL(request.url).pathname === '/logistics/shipment-requests/3001',
      respond: () => jsonResponse(shipmentRequest),
    },
    {
      /*
       * 품목은 **번호마다 상세**를 부른다(`GET /mdm/items/{itemId}`) — 목록이 아니다.
       * 응답이 `{ item, editability }` 봉투라는 것까지 여기서 굳힌다.
       */
      match: (request: Request) => new URL(request.url).pathname === '/mdm/items/5001',
      respond: () =>
        jsonResponse({
          item: {
            itemId: 5001,
            itemCode: 'SYNTH-FG-0311',
            itemName: '합성 완제품',
            isActive: true,
          },
          editability: {},
        }),
    },
    {
      match: (request: Request) => new URL(request.url).pathname === '/mdm/uoms',
      respond: () =>
        jsonResponse({
          items: [{ uomId: 7001, uomCode: 'EA', isActive: true }],
          page: page(1),
        }),
    },
    {
      match: (request: Request) => new URL(request.url).pathname === '/mdm/warehouses',
      respond: (request: Request) => {
        if (new URL(request.url).searchParams.get('dividedOnly') !== 'true') {
          return jsonResponse({ items: warehouses, page: page(warehouses.length) });
        }
        if (options.dividedWarehousesFail === true) {
          return jsonResponse({ code: 'INTERNAL', message: '합성 오류' }, { status: 500 });
        }
        return jsonResponse({ items: dividedWarehouses, page: page(dividedWarehouses.length) });
      },
    },
    {
      match: (request: Request) =>
        new URL(request.url).pathname === '/logistics/shipments' && request.method === 'POST',
      respond: () =>
        options.createResponse?.() ??
        jsonResponse({ shipmentId: 8001, shipmentNo: 'SYNTH-SH-0001' }, { status: 201 }),
    },
  ];

  const stub = createStubFetch(routes);

  return async (request: Request) => {
    /* 본문을 읽어도 원본이 소비되지 않도록 복제해 둔다 — 감지기가 나중에 본문을 본다. */
    sent.push(request.clone());
    return stub(request);
  };
};
