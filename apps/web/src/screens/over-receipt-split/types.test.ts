import { describe, expect, it } from 'vitest';

import {
  EMPTY_HEADER_DRAFT,
  hasAnyHeaderValue,
  toCreatedReceiptView,
  toPoLineView,
  toPoView,
} from './types';

/**
 * 응답 → 화면 타입 변환. **선택 필드를 `null`로 모으는 것**과
 * **화면이 쓰지 않는 필드를 들이지 않는 것** 둘을 고정한다.
 */

const RESPONSE = {
  purchaseOrderId: 9001,
  purchaseOrderNo: 'PO-2026-900001',
  supplierId: 9101,
  businessUnitId: 9701,
  plantId: 9201,
  orderDate: '2026-08-03',
  expectedReceiptDate: '2026-08-10',
  statusCode: 'SAMPLE_PO_STATUS_A',
};

const LINE_RESPONSE = {
  purchaseOrderLineId: 9401,
  purchaseOrderId: 9001,
  lineNo: 1,
  itemId: 9301,
  orderedQty: 100,
  uomId: 9501,
  receivedQty: 40,
  toleranceOverQty: 5,
  toleranceUnderQty: 5,
};

describe('toPoView — 발주 한 건', () => {
  it('화면이 쓰는 값을 그대로 옮긴다', () => {
    expect(toPoView(RESPONSE)).toEqual({
      purchaseOrderId: 9001,
      purchaseOrderNo: 'PO-2026-900001',
      supplierId: 9101,
      plantId: 9201,
      orderDate: '2026-08-03',
      expectedReceiptDate: '2026-08-10',
      statusCode: 'SAMPLE_PO_STATUS_A',
    });
  });

  /*
   * 키가 없는 경우와 `null`인 경우를 화면이 갈라 다루면 같은 「받지 못했다」가 두 갈래로 흩어져
   * 대시 표기 판정이 자리마다 달라진다.
   */
  it('입고 예정일은 키가 없어도 null로 모인다', () => {
    const { expectedReceiptDate: _omitted, ...withoutDate } = RESPONSE;

    expect(toPoView(withoutDate).expectedReceiptDate).toBeNull();
    expect(toPoView({ ...RESPONSE, expectedReceiptDate: null }).expectedReceiptDate).toBeNull();
  });

  /*
   * **화면이 쓰지 않는 내부 번호를 들이지 않는다**(#44). 타입에 자리가 없으면
   * 그 값이 화면으로 샐 경로도 없다. 사업부·ERP 발주번호·승인 요청 번호가 그 셋이다.
   */
  it('사업부·승인 요청 번호를 화면 타입으로 들이지 않는다', () => {
    const view = toPoView({ ...RESPONSE, approvalRequestId: 9801, erpPurchaseOrderNo: 'EPO-1' });

    expect(Object.keys(view).sort()).toEqual([
      'expectedReceiptDate',
      'orderDate',
      'plantId',
      'purchaseOrderId',
      'purchaseOrderNo',
      'statusCode',
      'supplierId',
    ]);
  });
});

describe('toPoLineView — 발주 라인 한 줄', () => {
  /* 정량/초과를 가르는 값 셋(발주·기입하·초과 허용치)이 전부 여기서 온다. */
  it('초과 판정에 쓰는 값 셋을 그대로 옮긴다', () => {
    const view = toPoLineView(LINE_RESPONSE);

    expect(view.orderedQty).toBe(100);
    expect(view.receivedQty).toBe(40);
    expect(view.toleranceOverQty).toBe(5);
  });

  it('줄번호·품목·단위와 라인 번호를 함께 옮긴다', () => {
    const view = toPoLineView(LINE_RESPONSE);

    expect(view.purchaseOrderLineId).toBe(9401);
    expect(view.lineNo).toBe(1);
    expect(view.itemId).toBe(9301);
    expect(view.uomId).toBe(9501);
  });

  /* 부족 허용치는 이 화면의 판정 축이 아니다 — 들이면 쓰지 않는 값이 남는다. */
  it('부족 허용치를 화면 타입으로 들이지 않는다', () => {
    expect(Object.keys(toPoLineView(LINE_RESPONSE))).not.toContain('toleranceUnderQty');
  });
});

describe('머리 초안', () => {
  it('처음에는 전 칸이 비어 있다', () => {
    expect(EMPTY_HEADER_DRAFT).toEqual({
      receiptDatetime: '',
      deliveryNoteNo: '',
      remarks: '',
      exceptionTypeCode: '',
      exceptionReason: '',
    });
  });

  it('아무것도 넣지 않았으면 버릴 값이 없다', () => {
    expect(hasAnyHeaderValue(EMPTY_HEADER_DRAFT)).toBe(false);
  });

  /* 다섯 칸 중 **어느 하나라도** 채웠으면 버릴 값이 있다 — 한 칸만 보면 나머지가 조용히 사라진다. */
  it.each([
    ['receiptDatetime', '2026-08-06T09:12'],
    ['deliveryNoteNo', 'SAMPLE-DN-01'],
    ['remarks', '합성 비고'],
    ['exceptionTypeCode', 'SAMPLE_EXCEPTION'],
    ['exceptionReason', '합성 사유'],
  ] as const)('%s만 채워도 버릴 값이 있다고 본다', (field, value) => {
    expect(hasAnyHeaderValue({ ...EMPTY_HEADER_DRAFT, [field]: value })).toBe(true);
  });

  /* 공백만 친 칸은 버릴 값이 아니다 — 라인 수량과 같은 기준이다. */
  it('공백만 친 칸은 버릴 값으로 세지 않는다', () => {
    expect(hasAnyHeaderValue({ ...EMPTY_HEADER_DRAFT, remarks: '   ' })).toBe(false);
  });
});

describe('toCreatedReceiptView — 만들어진 전표', () => {
  const CREATED = {
    inboundReceiptId: 9601,
    inboundReceiptNo: 'IR-2026-900010',
    supplierId: 9101,
    plantId: 9201,
    receiptDatetime: '2026-08-06T09:12:00+09:00',
    statusCode: 'SAMPLE_IR_STATUS_A',
  };

  /*
   * **내부 번호를 아예 들이지 않는다**(#44). `toEqual`이라 키가 하나라도 늘면 실패한다 —
   * 「렌더하지 않는다」만 단언하면 타입에 자리를 남긴 변경이 그대로 통과한다.
   */
  it('전표번호와 상태만 옮기고 내부 번호를 들이지 않는다', () => {
    expect(toCreatedReceiptView(CREATED)).toEqual({
      inboundReceiptNo: 'IR-2026-900010',
      statusCode: 'SAMPLE_IR_STATUS_A',
    });
  });
});
