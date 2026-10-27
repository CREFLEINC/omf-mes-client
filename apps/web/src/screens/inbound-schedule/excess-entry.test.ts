import { describe, expect, it } from 'vitest';

import { readExcessEntry, withExcessEntry, withoutExcessEntry } from './excess-entry';

describe('readExcessEntry — 연결 창은 주소가 연다', () => {
  it('excess=1 이 없으면 닫혀 있다', () => {
    expect(readExcessEntry(new URLSearchParams('po=7101'))).toBeNull();
    expect(readExcessEntry(new URLSearchParams('excess=0'))).toBeNull();
  });

  it('키가 없으면 고른 것 없이 연다', () => {
    expect(readExcessEntry(new URLSearchParams('excess=1'))).toEqual({
      receiptNo: null,
      inboundReceiptLineId: null,
      purchaseOrderLineId: null,
    });
  });

  it('입하번호 · 입하 줄 · 라인을 읽는다', () => {
    expect(
      readExcessEntry(
        new URLSearchParams('excess=1&excessReceipt=IR-1&excessReceiptLine=9411&excessLine=7301'),
      ),
    ).toEqual({ receiptNo: 'IR-1', inboundReceiptLineId: 9411, purchaseOrderLineId: 7301 });
  });

  it('번호가 양의 정수가 아니면 버린다', () => {
    expect(
      readExcessEntry(new URLSearchParams('excess=1&excessReceiptLine=abc&excessLine=-3')),
    ).toMatchObject({ inboundReceiptLineId: null, purchaseOrderLineId: null });
  });

  it('옛 키(연결됨 탭 · 옛 초과분 번호)는 읽지 않는다', () => {
    expect(readExcessEntry(new URLSearchParams('excess=1&excessTab=linked&excessId=9501'))).toEqual(
      { receiptNo: null, inboundReceiptLineId: null, purchaseOrderLineId: null },
    );
  });
});

describe('withExcessEntry · withoutExcessEntry', () => {
  it('조회 조건과 고른 발주는 그대로 두고 창 키만 얹는다', () => {
    const next = withExcessEntry(new URLSearchParams('po=7101&q=PO'), {
      inboundReceiptLineId: 9411,
      purchaseOrderLineId: 7301,
    });

    expect(next.toString()).toBe('po=7101&q=PO&excess=1&excessReceiptLine=9411&excessLine=7301');
  });

  it('앞서 얹은 창 키 — 옛 키까지 — 는 새 값으로 갈린다', () => {
    const next = withExcessEntry(
      new URLSearchParams('excess=1&excessTab=linked&excessId=1&excessReceiptLine=2'),
    );

    expect(next.toString()).toBe('excess=1');
  });

  it('닫으면 창 키만 떼고 나머지는 남는다', () => {
    const next = withoutExcessEntry(
      new URLSearchParams(
        'po=7101&excess=1&excessTab=linked&excessReceipt=IR-1&excessId=9&excessReceiptLine=9411',
      ),
    );

    expect(next.toString()).toBe('po=7101');
  });
});
