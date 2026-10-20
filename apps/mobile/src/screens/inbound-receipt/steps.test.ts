import { describe, expect, it } from 'vitest';

import {
  autoLineOf,
  autoOrderOf,
  stepOf,
  typedOverPlanned,
  type PurchaseOrder,
  type PurchaseOrderLine,
  type ReceiptDraft,
} from './receipt';

const draft = (overrides: Partial<ReceiptDraft> = {}): ReceiptDraft => ({
  supplierLotNo: '',
  supplierLotMissing: false,
  supplierLotLabelAttached: true,
  substituteLotReasonCode: '',
  unordered: false,
  supplierId: null,
  itemId: null,
  uomId: null,
  exceptionTypeCode: '',
  exceptionReason: '',
  purchaseOrder: null,
  purchaseOrderLine: null,
  deliveryNoteNo: '',
  vehicleNo: '',
  receivedQty: '',
  packageCount: '',
  manufacturedDate: '',
  expiryDate: '',
  ...overrides,
});

const line = (overrides: Partial<PurchaseOrderLine> = {}): PurchaseOrderLine =>
  ({
    purchaseOrderLineId: 41,
    purchaseOrderId: 7,
    lineNo: 1,
    itemId: 31,
    orderedQty: 500,
    uomId: 9,
    receivedQty: 0,
    toleranceOverQty: 10,
    toleranceUnderQty: 5,
    ...overrides,
  }) as PurchaseOrderLine;

const order = (purchaseOrderId: number): PurchaseOrder =>
  ({ purchaseOrderId, purchaseOrderNo: `PO-${String(purchaseOrderId)}` }) as PurchaseOrder;

const none = () => 0;

describe('입하 등록 단계', () => {
  it('라벨을 받기 전에는 스캔 단계다', () => {
    expect(stepOf(draft(), false)).toBe('scan');
  });

  it('라벨을 받았거나 LOT 번호 없음을 고르면 라인 단계다', () => {
    expect(stepOf(draft({ supplierLotNo: 'L-1' }), false)).toBe('line');
    expect(stepOf(draft({ supplierLotMissing: true }), false)).toBe('line');
  });

  it('라인을 고르면 수량 단계다', () => {
    expect(stepOf(draft({ supplierLotNo: 'L-1', purchaseOrderLine: line() }), false)).toBe('qty');
  });

  /* 라인을 바꾸러 돌아와도 적은 수량은 그대로 둔다. 같은 라인을 다시 고르면 이어서 적는다. */
  it('라인을 바꾸러 돌아오면 고른 라인이 있어도 라인 단계다', () => {
    expect(stepOf(draft({ supplierLotNo: 'L-1', purchaseOrderLine: line() }), true)).toBe('line');
  });

  it('발주 없이 받으면 그 단계다', () => {
    expect(stepOf(draft({ supplierLotNo: 'L-1', unordered: true }), false)).toBe('unordered');
  });
});

describe('고를 것이 하나뿐일 때', () => {
  it('라벨 품목으로 좁힌 발주가 하나면 그것을 고른다', () => {
    expect(autoOrderOf([order(7)], true)?.purchaseOrderId).toBe(7);
  });

  it('둘 이상이면 고르지 않는다', () => {
    expect(autoOrderOf([order(7), order(8)], true)).toBeNull();
  });

  /* 좁히지 않은 목록의 하나는 라벨과 무관할 수 있다(omf-all-around#25). */
  it('좁히지 않은 목록에서는 하나여도 고르지 않는다', () => {
    expect(autoOrderOf([order(7)], false)).toBeNull();
  });

  it('라벨 품목의 받을 것이 남은 라인이 하나면 그 라인이다', () => {
    const lines = [line(), line({ purchaseOrderLineId: 42, itemId: 32 })];

    expect(autoLineOf(lines, 31, none)?.purchaseOrderLineId).toBe(41);
  });

  it('다 받은 라인은 세지 않는다', () => {
    const lines = [
      line({ receivedQty: 500 }),
      line({ purchaseOrderLineId: 42, lineNo: 2, receivedQty: 100 }),
    ];

    expect(autoLineOf(lines, 31, none)?.purchaseOrderLineId).toBe(42);
  });

  it('담아 둔 수량까지 빼고 센다', () => {
    expect(autoLineOf([line()], 31, () => 500)).toBeNull();
  });

  it('같은 품목의 받을 라인이 둘이면 고르지 않는다', () => {
    const lines = [line(), line({ purchaseOrderLineId: 42, lineNo: 2 })];

    expect(autoLineOf(lines, 31, none)).toBeNull();
  });

  it('품목을 모르면 고르지 않는다', () => {
    expect(autoLineOf([line()], null, none)).toBeNull();
  });
});

describe('미리 채운 수량 위에서 치기', () => {
  /* 500 위에 300 을 친 사람이 500300 을 받으면 안 된다. */
  it('첫 숫자는 새로 치기 시작한 것이다', () => {
    expect(typedOverPlanned('500', '5003')).toBe('3');
  });

  it('지운 것은 고친 것으로 받는다', () => {
    expect(typedOverPlanned('500', '50')).toBe('50');
  });

  it('미리 채운 값과 무관한 값은 그대로 받는다', () => {
    expect(typedOverPlanned('500', '42')).toBe('42');
  });
});
