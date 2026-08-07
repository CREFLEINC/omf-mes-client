import { describe, expect, it } from 'vitest';

import { toAsnLineView, toAsnView } from './types';

/**
 * 응답 → 화면 타입 변환. **없는 값을 한 갈래로 모으는 것**이 이 변환의 전부다.
 * 키가 없는 경우와 `null`인 경우를 화면이 갈라 다루면 같은 「받지 못했다」가 두 갈래로 흩어진다.
 */

const ASN_RESPONSE = {
  asnId: 7001,
  asnNo: 'SAMPLE-ASN-0001',
  supplierId: 8101,
  plantId: 8201,
  expectedArrivalDate: '2026-08-10',
  deliveryNoteNo: 'SAMPLE-DN-0001',
  statusCode: 'SAMPLE_STATUS_A',
  remarks: '합성 비고',
};

const LINE_RESPONSE = {
  asnLineId: 7301,
  asnId: 7001,
  lineNo: 1,
  purchaseOrderLineId: 8401,
  itemId: 8301,
  expectedQty: 12,
  uomId: 8501,
  supplierLotNo: 'SAMPLE-LOT-0001',
};

describe('toAsnView', () => {
  it('필수 필드를 그대로 옮긴다', () => {
    expect(toAsnView(ASN_RESPONSE)).toEqual({
      asnId: 7001,
      asnNo: 'SAMPLE-ASN-0001',
      supplierId: 8101,
      plantId: 8201,
      expectedArrivalDate: '2026-08-10',
      deliveryNoteNo: 'SAMPLE-DN-0001',
      statusCode: 'SAMPLE_STATUS_A',
      remarks: '합성 비고',
    });
  });

  it('키가 아예 없는 선택 필드를 null로 모은다', () => {
    const { deliveryNoteNo: _note, remarks: _remarks, ...withoutOptional } = ASN_RESPONSE;

    expect(toAsnView(withoutOptional)).toMatchObject({ deliveryNoteNo: null, remarks: null });
  });

  it('null로 온 선택 필드를 그대로 null로 둔다', () => {
    expect(toAsnView({ ...ASN_RESPONSE, deliveryNoteNo: null, remarks: null })).toMatchObject({
      deliveryNoteNo: null,
      remarks: null,
    });
  });

  /* 빈 문자열은 「받지 못했다」가 아니다 — null로 바꾸면 서버가 보낸 값이 사라진다. */
  it('빈 문자열을 null로 바꾸지 않는다', () => {
    expect(toAsnView({ ...ASN_RESPONSE, deliveryNoteNo: '' })).toMatchObject({
      deliveryNoteNo: '',
    });
  });
});

describe('toAsnLineView', () => {
  it('필수 필드를 그대로 옮긴다', () => {
    expect(toAsnLineView(LINE_RESPONSE)).toEqual({
      asnLineId: 7301,
      asnId: 7001,
      lineNo: 1,
      purchaseOrderLineId: 8401,
      itemId: 8301,
      expectedQty: 12,
      uomId: 8501,
      supplierLotNo: 'SAMPLE-LOT-0001',
    });
  });

  /* 무발주 라인이다. 표에서 빠지지 않아야 하므로 변환에서 버리지도 않는다. */
  it('발주 라인이 없는 줄도 버리지 않고 null로 모은다', () => {
    const { purchaseOrderLineId: _po, supplierLotNo: _lot, ...withoutOptional } = LINE_RESPONSE;

    expect(toAsnLineView(withoutOptional)).toMatchObject({
      purchaseOrderLineId: null,
      supplierLotNo: null,
    });
  });

  it('null로 온 선택 필드를 그대로 null로 둔다', () => {
    expect(
      toAsnLineView({ ...LINE_RESPONSE, purchaseOrderLineId: null, supplierLotNo: null }),
    ).toMatchObject({ purchaseOrderLineId: null, supplierLotNo: null });
  });

  /* 수량 0은 값이 없는 것이 아니다 — 널 병합으로 뭉개면 0이 사라진다. */
  it('예정수량 0을 그대로 둔다', () => {
    expect(toAsnLineView({ ...LINE_RESPONSE, expectedQty: 0 })).toMatchObject({ expectedQty: 0 });
  });
});
