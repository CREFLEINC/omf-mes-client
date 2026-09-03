import { createStubFetch, jsonResponse, type StubFetch } from '../../test/api-harness';
import type { GoodsReceiptDetailResponse, Lot, Shipment } from './types';

/**
 * 이 화면의 감지기가 쓰는 목 응답.
 *
 * ⚠ 값은 전부 **지어낸 합성값**이다 — 실 출하번호·LOT 번호·거래처를 쓰지 않는다(공개 저장소 경계).
 */
export interface ReturnStubOptions {
  /** 출하 목록 조회를 실패시킨다. */
  listStatus?: number;
  /** 출하 상세 조회를 실패시킨다. */
  detailStatus?: number;
  /** 등록 응답을 갈아 끼운다. */
  postResponse?: () => Response;
  /** 등록이 «응답 없이» 실패한다. */
  postThrows?: boolean;
  /** 반품 사유 코드값을 비운다 — G-2 갈래. */
  emptyReasons?: boolean;
  /** 목록 응답에 라인을 싣지 않는다 — 「모른다」 갈래. */
  listWithoutLines?: boolean;
}

let sent: Request[] = [];

export const requestsSent = (): Request[] => sent;
export const requestedPaths = (): string[] =>
  sent.map((request) => {
    const url = new URL(request.url);
    return `${url.pathname}${url.search}`;
  });

const pathOf = (request: Request): string => new URL(request.url).pathname;

const listBody = (items: unknown[], total = items.length): Record<string, unknown> => ({
  items,
  page: { page: 1, size: 50, total },
});

export const shipmentFixture = (overrides: Partial<Shipment> = {}): Shipment => ({
  shipmentId: 9901,
  shipmentNo: 'SH-TEST-0455',
  shipmentRequestId: 9601,
  warehouseId: 1002,
  statusCode: 'SHIPPED',
  shippedAt: '2026-08-28T10:00:00+09:00',
  expedited: false,
  lines: [
    {
      shipmentLineId: 9911,
      lineNo: 1,
      shipmentRequestLineId: 9801,
      itemId: 2003,
      shippedQty: 300,
      uomId: 7001,
      allocations: [
        {
          shipmentLotAllocationId: 9921,
          shipmentId: 9901,
          shipmentLineId: 9911,
          itemId: 2003,
          itemCode: 'SYN-FG-1',
          lotId: 8301,
          lotNo: 'LOT-TEST-0311',
          warehouseId: 1002,
          allocatedQty: 180,
          uomId: 7001,
          oqcPassed: true,
          packedQty: 180,
        },
        {
          shipmentLotAllocationId: 9922,
          shipmentId: 9901,
          shipmentLineId: 9911,
          itemId: 2003,
          itemCode: 'SYN-FG-1',
          lotId: 8302,
          lotNo: 'LOT-TEST-0305',
          warehouseId: 1002,
          allocatedQty: 120,
          uomId: 7001,
          oqcPassed: true,
          packedQty: 120,
        },
      ],
    },
  ],
  versionNo: 1,
  ...overrides,
});

export const secondShipmentFixture = (): Shipment =>
  shipmentFixture({
    shipmentId: 9902,
    shipmentNo: 'SH-TEST-0448',
    shippedAt: '2026-08-25T10:00:00+09:00',
    lines: [
      {
        shipmentLineId: 9912,
        lineNo: 1,
        shipmentRequestLineId: 9802,
        itemId: 2004,
        shippedQty: 200,
        uomId: 7001,
        allocations: [
          {
            shipmentLotAllocationId: 9923,
            shipmentId: 9902,
            shipmentLineId: 9912,
            itemId: 2004,
            itemCode: 'SYN-FG-2',
            lotId: 8303,
            lotNo: 'LOT-TEST-0290',
            warehouseId: 1002,
            allocatedQty: 200,
            uomId: 7001,
            oqcPassed: true,
            packedQty: 200,
          },
        ],
      },
    ],
  });

export const lotFixture = (overrides: Partial<Lot> = {}): Lot => ({
  lotId: 8309,
  lotNo: 'LOT-TEST-0199',
  itemId: 2004,
  lotTypeCode: 'PRODUCTION',
  plantId: 11,
  initialQty: 400,
  uomId: 7001,
  sourceTypeCode: 'PRODUCTION_RESULT',
  sourceId: 1,
  statusCode: 'NORMAL',
  ...overrides,
});

const warehouses = [
  {
    warehouseId: 1003,
    plantId: 11,
    businessUnitId: 1,
    warehouseCode: 'SYN-WH-3',
    warehouseName: '합성 불량창고',
    warehouseTypeCode: 'DEFECT',
    managementLevelCode: 'ZONE',
    isExternal: false,
    isDefect: true,
    isActive: true,
  },
  {
    warehouseId: 1002,
    plantId: 12,
    businessUnitId: 1,
    warehouseCode: 'SYN-WH-2',
    warehouseName: '합성 완제품창고',
    warehouseTypeCode: 'FINISHED',
    managementLevelCode: 'ZONE',
    isExternal: false,
    isDefect: false,
    isActive: true,
  },
];

const locationsOf = (warehouseId: number): unknown[] =>
  warehouseId === 1003
    ? [
        {
          locationId: 3101,
          warehouseId: 1003,
          parentLocationId: null,
          locationCode: 'R-01',
          locationName: '반품 구역',
          locationTypeCode: 'ZONE',
          allowMixedItem: true,
          allowMixedLot: true,
          isActive: true,
        },
        {
          locationId: 3102,
          warehouseId: 1003,
          parentLocationId: 3101,
          locationCode: 'R-01-02',
          locationName: '반품 구역 02',
          locationTypeCode: 'RACK',
          allowMixedItem: true,
          allowMixedLot: true,
          isActive: true,
        },
      ]
    : [
        {
          locationId: 3201,
          warehouseId: 1002,
          parentLocationId: null,
          locationCode: 'FG-A-01',
          locationName: '완제품 A 01',
          locationTypeCode: 'RACK',
          allowMixedItem: true,
          allowMixedLot: true,
          isActive: true,
        },
      ];

const codeValues: Record<string, [string, string][]> = {
  GOODS_RECEIPT_REASON: [
    ['QUALITY_DEFECT', '품질 불량'],
    ['WRONG_DELIVERY', '오배송'],
  ],
  SHIPMENT_STATUS: [
    ['SHIPPED', '출하 완료'],
    ['CONFIRMED', '확정'],
  ],
  RECEIPT_TYPE: [['RETURN', '반품 입고']],
};

const toCodeValues = (group: string): unknown[] =>
  (codeValues[group] ?? []).map(([code, name], index) => ({
    codeValueId: index + 1,
    codeGroupId: 1,
    code,
    codeName: name,
    displayOrder: index + 1,
    isActive: true,
  }));

/** 등록 응답 — 화면은 입고번호만 쓴다. 라인은 화면이 보낸 것을 그대로 결과에 보이므로 여기 싣지 않는다. */
const receiptResponse = (): GoodsReceiptDetailResponse => ({
  goodsReceipt: {
    goodsReceiptId: 9801,
    goodsReceiptNo: 'RT-TEST-0099',
    receiptTypeCode: 'RETURN',
    plantId: 11,
    warehouseId: 1003,
    receiptDatetime: '2026-09-03T14:05:09+09:00',
    statusCode: 'POSTED',
  },
  lines: [],
});

export const returnStub = (options: ReturnStubOptions = {}): StubFetch => {
  sent = [];
  const shipments = [shipmentFixture(), secondShipmentFixture()];

  const inner = createStubFetch([
    {
      match: (request) => pathOf(request) === '/logistics/shipments' && request.method === 'GET',
      respond: (request) => {
        if (options.listStatus !== undefined) {
          return jsonResponse({ message: '' }, { status: options.listStatus });
        }
        const params = new URL(request.url).searchParams;
        const q = params.get('q');
        const rows = shipments
          .filter((shipment) => q === null || shipment.shipmentNo.includes(q))
          .map((shipment) =>
            options.listWithoutLines === true ? { ...shipment, lines: undefined } : shipment,
          );
        return jsonResponse(listBody(rows));
      },
    },
    {
      match: (request) => /^\/logistics\/shipments\/\d+$/.test(pathOf(request)),
      respond: (request) => {
        if (options.detailStatus !== undefined) {
          return jsonResponse({ message: '권한이 없습니다' }, { status: options.detailStatus });
        }
        const id = Number(pathOf(request).split('/').pop());
        const found = shipments.find((shipment) => shipment.shipmentId === id);
        return found === undefined
          ? jsonResponse({ message: '없는 출하' }, { status: 404 })
          : jsonResponse(found, { headers: { ETag: 'W/"1"' } });
      },
    },
    {
      match: (request) => pathOf(request) === '/trace/lots',
      respond: (request) => {
        const lotNo = new URL(request.url).searchParams.get('lotNo');
        return jsonResponse(listBody(lotNo === 'LOT-TEST-0199' ? [lotFixture()] : []));
      },
    },
    {
      match: (request) =>
        pathOf(request) === '/logistics/goods-receipts' && request.method === 'POST',
      respond: () => {
        if (options.postThrows === true) throw new Error('연결이 끊겼습니다');
        if (options.postResponse !== undefined) return options.postResponse();
        return jsonResponse(receiptResponse(), { status: 201 });
      },
    },
    {
      match: (request) => pathOf(request) === '/mdm/partners',
      respond: () =>
        jsonResponse(
          listBody([
            {
              partnerId: 4002,
              partnerCode: 'SYN-CUS-1',
              partnerName: '합성 고객사',
              isActive: true,
            },
          ]),
        ),
    },
    {
      match: (request) => pathOf(request) === '/mdm/warehouses',
      respond: () => jsonResponse(listBody(warehouses)),
    },
    {
      match: (request) => pathOf(request) === '/mdm/locations',
      respond: (request) =>
        jsonResponse(
          listBody(locationsOf(Number(new URL(request.url).searchParams.get('warehouseId')))),
        ),
    },
    {
      match: (request) => pathOf(request) === '/mdm/code-values',
      respond: (request) => {
        const group = new URL(request.url).searchParams.get('codeGroupCode') ?? '';
        if (group === 'GOODS_RECEIPT_REASON' && options.emptyReasons === true) {
          return jsonResponse(listBody([]));
        }
        return jsonResponse(listBody(toCodeValues(group)));
      },
    },
    {
      match: (request) => pathOf(request) === '/mdm/uoms',
      respond: () =>
        jsonResponse(
          listBody([
            { uomId: 7001, uomCode: 'EA', uomName: '개', decimalScale: 0, isActive: true },
          ]),
        ),
    },
    {
      match: (request) => pathOf(request) === '/mdm/items',
      respond: () =>
        jsonResponse(
          listBody([
            {
              itemId: 2003,
              itemCode: 'SYN-FG-1',
              itemName: '합성 제품 1',
              itemTypeCode: 'FG',
              baseUomId: 7001,
              lotControlled: true,
              serialControlTypeCode: 'NONE',
              inspectionRequired: true,
              fifoPolicyCode: 'FEFO',
              negativeStockAllowed: false,
              isActive: true,
            },
            {
              itemId: 2004,
              itemCode: 'SYN-FG-2',
              itemName: '합성 제품 2',
              itemTypeCode: 'FG',
              baseUomId: 7001,
              lotControlled: true,
              serialControlTypeCode: 'NONE',
              inspectionRequired: true,
              fifoPolicyCode: 'FEFO',
              negativeStockAllowed: false,
              isActive: true,
            },
          ]),
        ),
    },
  ]);

  return async (request: Request): Promise<Response> => {
    sent.push(request.clone());
    return inner(request);
  };
};
