import type { components } from '@omf-mes/api-client';
import { describe, expect, it } from 'vitest';

import { formatDateTime, toIrLineView, toIrView } from './types';

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
