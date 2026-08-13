import { messages } from '@omf-mes/i18n';
import { describe, expect, it } from 'vitest';

import { describeLineSelect, isLineSelectable } from './line-select';
import type { ReceiptLineView } from './types';

const t = messages.disposalIssue;

const line = (overrides: Partial<ReceiptLineView> = {}): ReceiptLineView => ({
  goodsReceiptLineId: 9401,
  itemId: 9301,
  lotId: 9601,
  receiptQty: 100,
  uomId: 9801,
  destinationLocationId: 9901,
  ...overrides,
});

describe('describeLineSelect', () => {
  it('다섯이 다 있고 수량이 양수면 고를 수 있다', () => {
    expect(describeLineSelect(line())).toEqual({ kind: 'selectable' });
  });

  /**
   * 계약이 `itemId`·`lotId`·`uomId`·`sourceLocationId`를 **양의 int64**로 두었으므로
   * 0 이하는 「그 값이 없다」는 뜻이다. 그런 번호를 요청에 실으면 서버가 400으로 되돌리는데
   * 사용자는 자기가 고른 줄이 왜 거절됐는지 알 길이 없다 — 고르기 전에 막는다.
   */
  it.each([
    ['품목', { itemId: 0 }],
    ['자재 LOT', { lotId: 0 }],
    ['단위', { uomId: -1 }],
    ['위치', { destinationLocationId: Number.NaN }],
  ])('%s 번호가 쓸 수 없는 값이면 막고 사유를 낸다', (_name, overrides) => {
    expect(describeLineSelect(line(overrides))).toEqual({
      kind: 'blocked',
      reason: t.reasons.lineMissingValues,
    });
  });

  /**
   * 계약이 `issueQty`에 `exclusiveMinimum: 0`을 두어 **0도 보낼 수 없다** — 「0개를 폐기한다」에
   * 뜻이 없다. 입고 수량이 0 이하인 줄은 폐기할 것이 아예 없다.
   */
  it.each([0, -5])('입고 수량이 %s이면 막고 사유를 낸다', (receiptQty) => {
    expect(describeLineSelect(line({ receiptQty }))).toEqual({
      kind: 'blocked',
      reason: t.reasons.lineQtyNotPositive,
    });
  });

  /**
   * **판정 순서가 뜻을 정한다 — 값 없음이 수량보다 앞선다.** 둘 다 어긋난 줄에서 수량 사유를
   * 내면 「수량이 문제다」로 읽히는데, 값이 없으면 수량이 얼마든 폐기 라인을 만들 수 없다.
   */
  it('값도 없고 수량도 0이면 값 없음을 먼저 말한다', () => {
    expect(describeLineSelect(line({ lotId: 0, receiptQty: 0 }))).toEqual({
      kind: 'blocked',
      reason: t.reasons.lineMissingValues,
    });
  });

  /**
   * **상태 코드로 판정하지 않는다**(공유계약 G-2). 화면 타입에 품질·재고 상태 자리를 두지
   * 않았으므로 이 판정이 볼 수 있는 것은 **계약이 요구하는 값이 실제로 있는가**뿐이다 —
   * 그 사실을 짝 방향으로 굳힌다.
   */
  it('상태 코드를 실어 보내도 판정이 달라지지 않는다', () => {
    const withCodes = {
      ...line(),
      qualityStatusCode: 'SAMPLE_QUALITY_BLOCKED',
      inventoryStatusCode: 'SAMPLE_INVENTORY_BLOCKED',
    } as ReceiptLineView;

    expect(describeLineSelect(withCodes)).toEqual({ kind: 'selectable' });
  });
});

describe('isLineSelectable', () => {
  /** 판정이 **한 곳에서** 나온다 — 표·화면·요청 조립이 각자 판정하면 규칙이 갈린다. */
  it('describeLineSelect의 갈래를 그대로 따른다', () => {
    expect(isLineSelectable(line())).toBe(true);
    expect(isLineSelectable(line({ itemId: 0 }))).toBe(false);
  });
});
