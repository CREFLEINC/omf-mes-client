import { describe, expect, it } from 'vitest';

import { excessTabHref, readExcessEntry, readLegacyExcessEntry } from './excess-entry';

describe('readExcessEntry — 탭 주소가 시작 상태를 정한다', () => {
  it('키가 없으면 고른 것 없이 선다', () => {
    expect(readExcessEntry(new URLSearchParams(''))).toEqual({
      receiptNo: null,
      inboundReceiptLineId: null,
      purchaseOrderLineId: null,
      purchaseOrderId: null,
    });
  });

  it('입하번호 · 입하 줄 · 라인 · 보던 발주를 읽는다', () => {
    expect(
      readExcessEntry(new URLSearchParams('receipt=IR-1&receiptLine=9411&line=7301&po=7101')),
    ).toEqual({
      receiptNo: 'IR-1',
      inboundReceiptLineId: 9411,
      purchaseOrderLineId: 7301,
      purchaseOrderId: 7101,
    });
  });

  it('번호가 양의 정수가 아니면 버린다', () => {
    expect(readExcessEntry(new URLSearchParams('receiptLine=abc&line=-3&po=0'))).toMatchObject({
      inboundReceiptLineId: null,
      purchaseOrderLineId: null,
      purchaseOrderId: null,
    });
  });
});

describe('excessTabHref', () => {
  it('빈 값은 키를 싣지 않는다', () => {
    expect(excessTabHref()).toBe('/logistics/inbound-excess');
    expect(excessTabHref({ inboundReceiptLineId: null, purchaseOrderLineId: 7301 })).toBe(
      '/logistics/inbound-excess?line=7301',
    );
  });

  it('읽은 값을 그대로 되돌린다', () => {
    const entry = {
      receiptNo: 'IR-1',
      inboundReceiptLineId: 9411,
      purchaseOrderLineId: 7301,
      purchaseOrderId: 7101,
    };
    const href = excessTabHref(entry);

    expect(readExcessEntry(new URLSearchParams(href.split('?')[1]))).toEqual(entry);
  });
});

describe('readLegacyExcessEntry — 옛 창 주소', () => {
  it('excess=1 이 없으면 옮기지 않는다', () => {
    expect(readLegacyExcessEntry(new URLSearchParams('po=7101'))).toBeNull();
    expect(readLegacyExcessEntry(new URLSearchParams('excess=0'))).toBeNull();
  });

  it('옛 키를 새 시작 상태로 옮긴다', () => {
    expect(
      readLegacyExcessEntry(
        new URLSearchParams(
          'po=7101&excess=1&excessReceipt=IR-1&excessReceiptLine=9411&excessLine=7301',
        ),
      ),
    ).toEqual({
      receiptNo: 'IR-1',
      inboundReceiptLineId: 9411,
      purchaseOrderLineId: 7301,
      purchaseOrderId: 7101,
    });
  });
});
