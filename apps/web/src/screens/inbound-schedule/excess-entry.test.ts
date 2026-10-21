import { describe, expect, it } from 'vitest';

import { readExcessEntry, withExcessEntry, withoutExcessEntry } from './excess-entry';

describe('readExcessEntry — 잇기 창은 주소가 연다', () => {
  it('excess=1 이 없으면 닫혀 있다', () => {
    expect(readExcessEntry(new URLSearchParams('po=7101'))).toBeNull();
    expect(readExcessEntry(new URLSearchParams('excess=0'))).toBeNull();
  });

  it('키가 없으면 안 이은 탭으로, 고른 것 없이 연다', () => {
    expect(readExcessEntry(new URLSearchParams('excess=1'))).toEqual({
      tab: 'unlinked',
      receiptNo: null,
      excessId: null,
      purchaseOrderLineId: null,
    });
  });

  it('탭 · 입하번호 · 초과분 · 라인을 읽는다', () => {
    expect(
      readExcessEntry(
        new URLSearchParams(
          'excess=1&excessTab=linked&excessReceipt=IR-1&excessId=9501&excessLine=7301',
        ),
      ),
    ).toEqual({ tab: 'linked', receiptNo: 'IR-1', excessId: 9501, purchaseOrderLineId: 7301 });
  });

  it('번호가 양의 정수가 아니면 버린다', () => {
    expect(
      readExcessEntry(new URLSearchParams('excess=1&excessId=abc&excessLine=-3')),
    ).toMatchObject({ excessId: null, purchaseOrderLineId: null });
  });
});

describe('withExcessEntry · withoutExcessEntry', () => {
  it('조회 조건과 고른 발주는 그대로 두고 창 키만 얹는다', () => {
    const next = withExcessEntry(new URLSearchParams('po=7101&q=PO'), {
      excessId: 9501,
      purchaseOrderLineId: 7301,
    });

    expect(next.toString()).toBe('po=7101&q=PO&excess=1&excessId=9501&excessLine=7301');
  });

  it('앞서 얹은 창 키는 새 값으로 갈린다', () => {
    const next = withExcessEntry(new URLSearchParams('excess=1&excessTab=linked&excessId=1'));

    expect(next.toString()).toBe('excess=1');
  });

  it('닫으면 창 키만 떼고 나머지는 남는다', () => {
    const next = withoutExcessEntry(
      new URLSearchParams('po=7101&excess=1&excessTab=linked&excessReceipt=IR-1&excessId=9'),
    );

    expect(next.toString()).toBe('po=7101');
  });
});
