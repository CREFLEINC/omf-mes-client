import type { components } from '@omf-mes/api-client';
import { describe, expect, it } from 'vitest';

import {
  EMPTY_CODE_DRAFT,
  EMPTY_RECEIPT_DRAFT,
  formatDateTime,
  hasAnyDraftValue,
  toGoodsReceiptResultView,
  toIrLineView,
  toIrView,
  toLocationView,
  toWarehouseView,
} from './types';

type InboundReceiptResponse = components['schemas']['InboundReceipt'];
type InboundReceiptLineResponse = components['schemas']['InboundReceiptLine'];

/**
 * 응답 한 건. **계약이 필수로 두는 필드를 전부 채운다** — 선택 필드만 갈아 끼워
 * 「없을 때」를 만든다.
 */
const receiptResponse = (
  overrides: Partial<InboundReceiptResponse> = {},
): InboundReceiptResponse => ({
  inboundReceiptId: 9001,
  inboundReceiptNo: 'IR-2026-900001',
  supplierId: 9101,
  plantId: 9201,
  receiptDatetime: '2026-08-06T09:12:00+09:00',
  statusCode: 'SAMPLE_IR_STATUS_A',
  ...overrides,
});

const lineResponse = (
  overrides: Partial<InboundReceiptLineResponse> = {},
): InboundReceiptLineResponse => ({
  inboundReceiptLineId: 9401,
  inboundReceiptId: 9001,
  lineNo: 1,
  itemId: 9301,
  receivedQty: 100,
  uomId: 9501,
  supplierLotMissing: false,
  inspectionRequired: true,
  statusCode: 'SAMPLE_IR_LINE_STATUS_A',
  ...overrides,
});

describe('toIrView', () => {
  it('화면이 쓰는 값을 그대로 옮긴다', () => {
    const view = toIrView(receiptResponse());

    expect(view).toEqual({
      inboundReceiptId: 9001,
      inboundReceiptNo: 'IR-2026-900001',
      supplierId: 9101,
      plantId: 9201,
      receiptDatetime: '2026-08-06T09:12:00+09:00',
      deliveryNoteNo: null,
      statusCode: 'SAMPLE_IR_STATUS_A',
    });
  });

  it('거래명세서번호가 있으면 그대로 담는다', () => {
    expect(toIrView(receiptResponse({ deliveryNoteNo: 'DN-2026-900001' })).deliveryNoteNo).toBe(
      'DN-2026-900001',
    );
  });

  /* 키 없음과 `null`이 갈리면 대시 표기가 자리마다 달라진다. */
  it('거래명세서번호의 키 없음과 null을 같은 값으로 모은다', () => {
    expect(toIrView(receiptResponse()).deliveryNoteNo).toBeNull();
    expect(toIrView(receiptResponse({ deliveryNoteNo: null })).deliveryNoteNo).toBeNull();
  });

  /*
   * **화면이 그리지도 보내지도 않는 값에는 타입에 자리를 두지 않는다**(#44).
   * 자리가 없으면 그 번호가 화면으로 샐 경로도 없다.
   */
  it('차량 번호·도크·승인 요청 같은 값은 화면 타입에 담기지 않는다', () => {
    const view = toIrView(
      receiptResponse({ vehicleNo: 'V-9001', dockLocationId: 9701, approvalRequestId: 9801 }),
    );

    expect(Object.keys(view).sort()).toEqual([
      'deliveryNoteNo',
      'inboundReceiptId',
      'inboundReceiptNo',
      'plantId',
      'receiptDatetime',
      'statusCode',
      'supplierId',
    ]);
  });
});

describe('toIrLineView', () => {
  it('화면이 쓰는 값을 그대로 옮긴다', () => {
    const view = toIrLineView(lineResponse({ expiryDate: '2027-08-06', lotId: 9601 }));

    expect(view).toEqual({
      inboundReceiptLineId: 9401,
      inboundReceiptId: 9001,
      lineNo: 1,
      itemId: 9301,
      receivedQty: 100,
      uomId: 9501,
      expiryDate: '2027-08-06',
      lotId: 9601,
      inspectionRequired: true,
      statusCode: 'SAMPLE_IR_LINE_STATUS_A',
    });
  });

  /*
   * **`lotId`의 없음이 이 화면의 갈림길이다**(계획 결정 5). 계약이 입고 라인의 `lotId`를
   * 필수로 두는데 입하 라인의 `lotId`는 nullable이다 — 없으면 보낼 것이 없다.
   */
  it('자재 LOT의 키 없음과 null을 같은 값으로 모은다', () => {
    expect(toIrLineView(lineResponse()).lotId).toBeNull();
    expect(toIrLineView(lineResponse({ lotId: null })).lotId).toBeNull();
  });

  it('유효기한의 키 없음과 null을 같은 값으로 모은다', () => {
    expect(toIrLineView(lineResponse()).expiryDate).toBeNull();
    expect(toIrLineView(lineResponse({ expiryDate: null })).expiryDate).toBeNull();
  });

  /* 공급사 LOT·포장 수량·제조일은 이 화면이 그리지도 보내지도 않는다. */
  it('화면이 쓰지 않는 값은 화면 타입에 담기지 않는다', () => {
    const view = toIrLineView(
      lineResponse({
        supplierLotNo: 'SL-2026-9001',
        packageCount: 12,
        manufacturedDate: '2026-08-01',
        purchaseOrderLineId: 9901,
      }),
    );

    expect(Object.keys(view).sort()).toEqual([
      'expiryDate',
      'inboundReceiptId',
      'inboundReceiptLineId',
      'inspectionRequired',
      'itemId',
      'lineNo',
      'lotId',
      'receivedQty',
      'statusCode',
      'uomId',
    ]);
  });
});

describe('formatDateTime', () => {
  it('날짜와 분까지만 보인다', () => {
    expect(formatDateTime('2026-08-06T09:12:00+09:00')).toBe('2026-08-06 09:12');
  });

  /*
   * **실행 환경 시간대로 옮기지 않는다.** offset이 달라도 문자열에 적힌 벽시계 시각을 그대로 낸다 —
   * 옮기면 같은 전표가 보는 사람마다 다른 시각으로 보인다.
   */
  it.each(['+09:00', 'Z', '-05:00'])('offset(%s)이 달라도 적힌 시각을 그대로 낸다', (offset) => {
    expect(formatDateTime(`2026-08-06T09:12:00${offset}`)).toBe('2026-08-06 09:12');
  });

  /* 못 알아본 값을 「—」로 바꾸면 값이 없는 것과 구분되지 않는다. 서버가 보낸 값을 삼키지 않는다. */
  it('형식이 아니면 원문을 그대로 낸다', () => {
    expect(formatDateTime('2026-08-06')).toBe('2026-08-06');
    expect(formatDateTime('')).toBe('');
  });
});

type WarehouseResponse = components['schemas']['Warehouse'];
type LocationResponse = components['schemas']['Location'];
type GoodsReceiptResponse = components['schemas']['GoodsReceipt'];
type GoodsReceiptLineResponse = components['schemas']['GoodsReceiptLine'];

const warehouseResponse = (overrides: Partial<WarehouseResponse> = {}): WarehouseResponse => ({
  warehouseId: 9701,
  plantId: 9201,
  businessUnitId: 9251,
  warehouseCode: 'SAMPLE-WH-01',
  warehouseName: '합성 창고 가',
  warehouseTypeCode: 'SAMPLE_WH_TYPE_A',
  managementLevelCode: 'SAMPLE_WH_LEVEL_A',
  isExternal: false,
  isActive: true,
  ...overrides,
});

const locationResponse = (overrides: Partial<LocationResponse> = {}): LocationResponse => ({
  locationId: 9802,
  warehouseId: 9701,
  parentLocationId: 9801,
  locationCode: 'SAMPLE-LOC-A1',
  locationName: '합성 열 가1',
  locationTypeCode: 'SAMPLE_LOC_TYPE_A',
  allowMixedItem: true,
  allowMixedLot: true,
  isActive: true,
  ...overrides,
});

describe('toWarehouseView', () => {
  it('화면이 쓰는 값만 옮긴다', () => {
    expect(toWarehouseView(warehouseResponse())).toEqual({
      warehouseId: 9701,
      warehouseCode: 'SAMPLE-WH-01',
      warehouseName: '합성 창고 가',
      plantId: 9201,
    });
  });

  /*
   * 사용 여부를 담지 않는다 — 창고 목록은 `includeInactive`를 켜지 않으므로 표식을 붙일 값이
   * 없고, 담을 자리가 없으면 표식이 어긋날 경로도 생기지 않는다.
   */
  it('사용 여부를 담지 않는다', () => {
    expect(Object.keys(toWarehouseView(warehouseResponse()))).not.toContain('isActive');
  });
});

describe('toLocationView', () => {
  it('상위 위치 번호를 함께 옮긴다 — 1단 그룹을 접는 열쇠다', () => {
    expect(toLocationView(locationResponse()).parentLocationId).toBe(9801);
  });

  /* 키 없음과 `null`을 한 값으로 모은다 — 갈리면 「상위가 없다」 판정이 자리마다 달라진다. */
  it('상위가 없거나 키가 없으면 둘 다 null이다', () => {
    expect(toLocationView(locationResponse({ parentLocationId: null })).parentLocationId).toBeNull();
    expect(
      toLocationView(locationResponse({ parentLocationId: undefined })).parentLocationId,
    ).toBeNull();
  });
});

const goodsReceiptResult = (
  overrides: Partial<GoodsReceiptResponse> = {},
): GoodsReceiptResponse => ({
  goodsReceiptId: 9901,
  goodsReceiptNo: 'GR-2026-800001',
  receiptTypeCode: 'SAMPLE_RECEIPT_TYPE_A',
  plantId: 9201,
  warehouseId: 9701,
  receiptDatetime: '2026-08-06T09:12:00+09:00',
  statusCode: 'SAMPLE_GR_STATUS_A',
  sourceDocumentTypeCode: 'SAMPLE_SOURCE_TYPE_A',
  sourceDocumentId: 9001,
  ...overrides,
});

const goodsReceiptLine = (
  overrides: Partial<GoodsReceiptLineResponse> = {},
): GoodsReceiptLineResponse => ({
  goodsReceiptLineId: 9902,
  goodsReceiptId: 9901,
  lineNo: 1,
  itemId: 9301,
  lotId: 9601,
  receiptQty: 100,
  uomId: 9501,
  qualityStatusCode: 'SAMPLE_QUALITY_A',
  /* 재고 상태만 합성값이 아니다 — **계약이 값을 넷으로 못박아** 다른 값은 타입이 막는다. */
  inventoryStatusCode: 'AVAILABLE',
  destinationLocationId: 9802,
  inventoryTransactionLineId: 9903,
  ...overrides,
});

describe('toGoodsReceiptResultView', () => {
  it('업무 번호와 상태 코드를 옮긴다', () => {
    const view = toGoodsReceiptResultView(goodsReceiptResult(), [goodsReceiptLine()]);

    expect(view.goodsReceiptNo).toBe('GR-2026-800001');
    expect(view.statusCode).toBe('SAMPLE_GR_STATUS_A');
  });

  /* **#44** — 내부 번호를 담을 자리가 없으면 결과 구획으로 샐 경로도 없다. */
  it('내부 번호를 담을 자리가 없다', () => {
    const view = toGoodsReceiptResultView(goodsReceiptResult(), [goodsReceiptLine()]);

    for (const key of ['goodsReceiptId', 'goodsReceiptLineId', 'lotId', 'inventoryTransactionLineId']) {
      expect(Object.keys(view)).not.toContain(key);
    }
  });

  /*
   * 계약이 `erpMessageQueued`를 선택 필드로 두었다 — **키가 없는 것을 참으로 접지 않는다.**
   * 갈래를 가르는 것은 `erp-status.ts`이고 여기서는 값을 그대로 나른다.
   */
  it('ERP 적재 여부를 접지 않고 그대로 나른다', () => {
    expect(
      toGoodsReceiptResultView(goodsReceiptResult(), [goodsReceiptLine()]).erpMessageQueued,
    ).toBeUndefined();
    expect(
      toGoodsReceiptResultView(goodsReceiptResult({ erpMessageQueued: false }), []).erpMessageQueued,
    ).toBe(false);
  });

  it('원장 라인은 유무만 센다 — null과 키 없음을 함께 없는 것으로 본다', () => {
    const view = toGoodsReceiptResultView(goodsReceiptResult(), [
      goodsReceiptLine(),
      goodsReceiptLine({ goodsReceiptLineId: 9904, inventoryTransactionLineId: null }),
      goodsReceiptLine({ goodsReceiptLineId: 9905, inventoryTransactionLineId: undefined }),
    ]);

    expect(view.lineCount).toBe(3);
    expect(view.ledgerLineCount).toBe(1);
  });
});

describe('hasAnyDraftValue', () => {
  it('아무것도 넣지 않았으면 버릴 것이 없다', () => {
    expect(hasAnyDraftValue(EMPTY_RECEIPT_DRAFT)).toBe(false);
  });

  /* 한쪽만 보면 나머지가 확인 없이 사라진다 — 다섯 자리를 모두 본다. */
  it.each([
    ['warehouse', { warehouse: '9701' }],
    ['location', { location: '9802' }],
    ['receiptDatetime', { receiptDatetime: '2026-08-06T09:12' }],
    ['remarks', { remarks: '합성 비고' }],
  ] as const)('%s만 넣어도 버릴 것이 있다', (_name, patch) => {
    expect(hasAnyDraftValue({ ...EMPTY_RECEIPT_DRAFT, ...patch })).toBe(true);
  });

  it('코드만 골라도 버릴 것이 있다', () => {
    expect(
      hasAnyDraftValue({
        ...EMPTY_RECEIPT_DRAFT,
        codes: { ...EMPTY_CODE_DRAFT, qualityStatus: 'SAMPLE_QUALITY_A' },
      }),
    ).toBe(true);
  });

  /* 공백만 친 비고는 보낼 값이 없다 — 그것 때문에 파기 확인을 띄우면 확인 창이 값을 잃는다. */
  it('공백만 친 비고는 버릴 것으로 세지 않는다', () => {
    expect(hasAnyDraftValue({ ...EMPTY_RECEIPT_DRAFT, remarks: '   ' })).toBe(false);
  });
});
