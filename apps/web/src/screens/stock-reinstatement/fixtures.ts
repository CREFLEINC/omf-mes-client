import { createStubFetch, jsonResponse, type StubFetch } from '../../test/api-harness';

let sent: Request[] = [];
export const requestsSent = (): Request[] => sent;

const page = (items: unknown[]): Record<string, unknown> => ({
  items,
  page: { page: 1, size: 50, total: items.length },
});

export const decisionFixture = {
  dispositionDecisionId: 3101,
  nonconformanceId: 4101,
  nonconformanceNo: 'NC-SYNTH-4101',
  dispositionTypeCode: 'NORMAL',
  decisionQty: 200,
  uomId: 7101,
  reason: '재검사 결과 정상 판정',
  decidedBy: 5101,
  decidedByName: '합성 판정자',
  decidedAt: '2026-09-04T14:10:00+09:00',
  lotId: 6101,
  lotNo: 'LOT-SYNTH-6101',
  itemId: 8101,
  itemCode: 'FG-SYNTH-01',
  itemName: '합성 완제품',
  followUpStatusCode: 'NOT_STARTED',
  followUpQty: 0,
};

const warehouses = [
  {
    warehouseId: 101,
    plantId: 1,
    businessUnitId: 1,
    warehouseCode: 'WH-DEFECT',
    warehouseName: '합성 불량창고',
    warehouseTypeCode: 'PRODUCT',
    managementLevelCode: 'WAREHOUSE',
    isExternal: false,
    isDefect: true,
    isActive: true,
  },
  {
    warehouseId: 202,
    plantId: 1,
    businessUnitId: 1,
    warehouseCode: 'WH-FG',
    warehouseName: '합성 완제품창고',
    warehouseTypeCode: 'PRODUCT',
    managementLevelCode: 'CELL',
    isExternal: false,
    isDefect: false,
    isActive: true,
  },
];

const pathOf = (request: Request): string => new URL(request.url).pathname;

export interface ReinstatementStubOptions {
  emptyOptionalReasons?: boolean;
  postResponse?: () => Response;
}

export const reinstatementStub = (options: ReinstatementStubOptions = {}): StubFetch => {
  sent = [];
  const inner = createStubFetch([
    {
      match: (request) =>
        request.method === 'GET' && pathOf(request) === '/quality/disposition-decisions',
      respond: () => jsonResponse(page([decisionFixture])),
    },
    {
      match: (request) =>
        request.method === 'GET' && /^\/quality\/disposition-decisions\/\d+$/.test(pathOf(request)),
      respond: () => jsonResponse(decisionFixture),
    },
    {
      match: (request) =>
        request.method === 'GET' && /^\/quality\/nonconformances\/\d+$/.test(pathOf(request)),
      respond: () =>
        jsonResponse({
          nonconformanceId: 4101,
          nonconformanceNo: 'NC-SYNTH-4101',
          itemId: 8101,
          sourceCode: 'RETURN',
          severityCode: 'MAJOR',
          description: '반품 외관 이상',
          statusCode: 'DECIDED',
          openedAt: '2026-09-02T09:00:00+09:00',
          affectedQtyTotal: 200,
          uomId: 7101,
          dispositionProgressCode: 'COMPLETED',
          lots: [],
        }),
    },
    {
      match: (request) => request.method === 'GET' && /^\/trace\/lots\/\d+$/.test(pathOf(request)),
      respond: () =>
        jsonResponse({
          lot: {
            lotId: 6101,
            lotNo: 'LOT-SYNTH-6101',
            itemId: 8101,
            lotTypeCode: 'PRODUCT',
            plantId: 1,
            initialQty: 200,
            uomId: 7101,
            expiryDate: '2027-02-01',
            sourceTypeCode: 'INBOUND_RECEIPT_LINE',
            sourceId: 9101,
            statusCode: 'DEFECTIVE',
          },
          externalIdentifiers: [],
          holds: [],
        }),
    },
    {
      match: (request) => request.method === 'GET' && pathOf(request) === '/quality/lot-statuses',
      respond: () =>
        jsonResponse(
          page([
            {
              lotId: 6101,
              lotNo: 'LOT-SYNTH-6101',
              itemId: 8101,
              lotTypeCode: 'PRODUCT',
              lotStatusCode: 'DEFECTIVE',
              versionNo: 7,
              warehouseId: 101,
              onHandQty: 200,
              heldQty: 200,
              availableQty: 0,
              uomId: 7101,
              openHoldCount: 1,
              fullyHeld: true,
            },
          ]),
        ),
    },
    {
      match: (request) => request.method === 'GET' && pathOf(request) === '/quality/lot-holds',
      respond: () =>
        jsonResponse(
          page([
            {
              lotHoldId: 71001,
              lotId: 6101,
              lotNo: 'LOT-SYNTH-6101',
              itemId: 8101,
              holdQty: 200,
              uomId: 7101,
              reasonCode: 'CUSTOMER_RETURN',
              statusCode: 'HELD',
              heldAt: '2026-09-02T08:30:00+09:00',
              lotStatusCode: 'DEFECTIVE',
            },
          ]),
        ),
    },
    {
      match: (request) => request.method === 'GET' && pathOf(request) === '/mdm/warehouses',
      respond: () => jsonResponse(page(warehouses)),
    },
    {
      match: (request) => request.method === 'GET' && pathOf(request) === '/mdm/locations',
      respond: () =>
        jsonResponse(
          page([
            {
              locationId: 303,
              warehouseId: 202,
              locationCode: 'FG-A-01',
              locationName: '합성 완제품 셀',
              locationTypeCode: 'RACK',
              allowMixedItem: false,
              allowMixedLot: false,
              isActive: true,
            },
          ]),
        ),
    },
    {
      match: (request) => request.method === 'GET' && pathOf(request) === '/mdm/code-values',
      respond: (request) => {
        const group = new URL(request.url).searchParams.get('codeGroupCode');
        if (group === 'LOT_HOLD_RELEASE_REASON') {
          return jsonResponse(
            page([
              {
                code: 'RETEST_PASS',
                codeName: '재검사 합격',
                nameKo: '재검사 합격',
                isActive: true,
              },
            ]),
          );
        }
        return jsonResponse(
          page(
            options.emptyOptionalReasons === true
              ? []
              : [
                  {
                    code: 'RETURN_ACCEPTED',
                    codeName: '반품 재수용',
                    nameKo: '반품 재수용',
                    isActive: true,
                  },
                ],
          ),
        );
      },
    },
    {
      match: (request) => request.method === 'GET' && pathOf(request) === '/mdm/uoms',
      respond: () =>
        jsonResponse(
          page([{ uomId: 7101, uomCode: 'EA', uomName: '개', decimalScale: 0, isActive: true }]),
        ),
    },
    {
      match: (request) =>
        request.method === 'POST' && pathOf(request) === '/logistics/stock-reinstatements',
      respond: () =>
        options.postResponse?.() ??
        jsonResponse(
          {
            stockTransferId: 8801,
            stockTransferNo: 'ST-SYNTH-8801',
            lotId: 6101,
            lotStatusCode: 'NORMAL',
            releasedLotHoldId: 71001,
            reinstatedQty: 200,
            uomId: 7101,
            toWarehouseId: 202,
            occurredAt: '2026-09-05T10:00:00+09:00',
            remainingHeldQty: 0,
          },
          { status: 201 },
        ),
    },
  ]);

  return async (request: Request): Promise<Response> => {
    sent.push(request.clone());
    return inner(request);
  };
};
