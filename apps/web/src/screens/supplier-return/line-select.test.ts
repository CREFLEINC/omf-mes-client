import { messages } from '@omf-mes/i18n';
import { describe, expect, it } from 'vitest';

import { goodsReceiptLine } from './fixtures';
import { describeLineSelect, isLineSelectable } from './line-select';

const t = messages.supplierReturn;

describe('describeLineSelect — 값이 있는가만 본다', () => {
  it('다섯 값이 갖춰지고 입고 수량이 양수면 고를 수 있다', () => {
    expect(describeLineSelect(goodsReceiptLine())).toEqual({ kind: 'selectable' });
  });

  it('소수 수량도 고를 수 있다', () => {
    expect(describeLineSelect(goodsReceiptLine({ receiptQty: 12.5 }))).toEqual({
      kind: 'selectable',
    });
  });

  /**
   * **M21의 단위 짝** — 계약이 `issueQty`에 `exclusiveMinimum: 0`을 두어 0도 보낼 수 없다.
   * 입고 수량이 0인 줄은 되돌려 보낼 것이 없다.
   */
  it('입고 수량이 0이면 사유와 함께 막힌다', () => {
    expect(describeLineSelect(goodsReceiptLine({ receiptQty: 0 }))).toEqual({
      kind: 'blocked',
      reason: t.reasons.lineQtyNotPositive,
    });
  });

  it('입고 수량이 음수여도 같은 사유로 막힌다', () => {
    expect(describeLineSelect(goodsReceiptLine({ receiptQty: -1 }))).toEqual({
      kind: 'blocked',
      reason: t.reasons.lineQtyNotPositive,
    });
  });

  /**
   * 반품 라인 한 줄은 품목·자재 LOT·수량·단위·출발 위치 **다섯이 전부 필수**다(계약 실측).
   * 식별자는 양의 정수이므로 0 이하는 **값이 없다**는 뜻이며, 그 줄로는 요청을 만들 수 없다.
   */
  const eachMissing: [string, Record<string, number>][] = [
    ['품목', { itemId: 0 }],
    ['자재 LOT', { lotId: 0 }],
    ['단위', { uomId: 0 }],
    ['위치', { destinationLocationId: 0 }],
  ];

  it.each(eachMissing)('%s 번호가 없으면 사유와 함께 막힌다', (_name, overrides) => {
    expect(describeLineSelect(goodsReceiptLine(overrides))).toEqual({
      kind: 'blocked',
      reason: t.reasons.lineMissingValues,
    });
  });

  /**
   * 판정 순서가 뜻을 정한다 — **값 없음이 수량보다 앞선다.** 둘 다 어긋난 줄에서 수량 사유를
   * 내면 「수량 문제다」로 읽히는데, 값이 없으면 수량이 얼마든 요청을 만들 수 없다.
   */
  it('값도 없고 수량도 0이면 값 없음을 먼저 낸다', () => {
    expect(describeLineSelect(goodsReceiptLine({ lotId: 0, receiptQty: 0 }))).toEqual({
      kind: 'blocked',
      reason: t.reasons.lineMissingValues,
    });
  });

  /** 두 사유의 글자가 서로 달라야 사용자가 무엇이 문제인지 가린다. */
  it('두 사유의 문구가 서로 다르다', () => {
    expect(t.reasons.lineMissingValues).not.toBe(t.reasons.lineQtyNotPositive);
  });

  /**
   * **상태 코드로 판정하지 않는다**(공유계약 G-2). 화면 타입에 상태 코드 자리가 없으므로
   * 이 판정이 볼 수 있는 것은 계약이 요구하는 값의 유무뿐이다 — 그 사실을 잣대로 굳힌다.
   */
  it('판정이 보는 것은 다섯 값뿐이다', () => {
    const line = goodsReceiptLine();

    expect(Object.keys(line).sort()).toEqual([
      'destinationLocationId',
      'goodsReceiptLineId',
      'itemId',
      'lotId',
      'receiptQty',
      'uomId',
    ]);
  });
});

describe('isLineSelectable', () => {
  it('고를 수 있는 줄에 참을 낸다', () => {
    expect(isLineSelectable(goodsReceiptLine())).toBe(true);
  });

  it('막힌 줄에 거짓을 낸다', () => {
    expect(isLineSelectable(goodsReceiptLine({ receiptQty: 0 }))).toBe(false);
  });
});
