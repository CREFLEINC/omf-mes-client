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

  const warehouses =
    options.manyWarehouses === true
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
      match: (request: Request) => new URL(request.url).pathname === '/mdm/items',
      respond: () =>
        jsonResponse({
          items: [
            { itemId: 5001, itemCode: 'SYNTH-FG-0311', itemName: '합성 완제품', isActive: true },
          ],
          page: page(1),
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
      respond: () => jsonResponse({ items: warehouses, page: page(warehouses.length) }),
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
