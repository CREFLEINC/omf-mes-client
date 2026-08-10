import { messages } from '@omf-mes/i18n';
import { describe, expect, it } from 'vitest';

import { inboundReceiptLine, inboundReceiptLineFixtures } from './fixtures';
import {
  describeLineSelect,
  findSelectedLine,
  isLineSelectable,
  nextSelectedLineId,
} from './line-select';

const t = messages.goodsReceipt;

describe('describeLineSelect', () => {
  it('자재 LOT이 있고 수량이 0보다 크면 고를 수 있다', () => {
    expect(describeLineSelect(inboundReceiptLine({ lotId: 9601, receivedQty: 100 }))).toEqual({
      kind: 'selectable',
    });
  });

  /*
   * **M12** — 계약이 입고 라인의 `lotId`를 필수로 두는데 입하 라인의 `lotId`는 nullable이다.
   * 값이 없으면 보낼 것이 없다. 판정을 없애면 보낼 수 없는 줄을 고를 수 있게 된다.
   */
  it('자재 LOT이 없으면 고를 수 없고 사유가 붙는다', () => {
    expect(describeLineSelect(inboundReceiptLine({ lotId: null }))).toEqual({
      kind: 'blocked',
      reason: t.reasons.lineNoLot,
    });
  });

  /*
   * **M13** — 계약이 `receiptQty`에 `exclusiveMinimum: 0`을 두어 0도 보낼 수 없다.
   * 경계를 `>=`로 뒤집으면 0인 줄이 고를 수 있게 되고 서버가 400을 준다.
   */
  it.each([0, -1])('입하 수량이 %s이면 고를 수 없고 사유가 붙는다', (receivedQty) => {
    expect(describeLineSelect(inboundReceiptLine({ lotId: 9601, receivedQty }))).toEqual({
      kind: 'blocked',
      reason: t.reasons.lineQtyNotPositive,
    });
  });

  it('소수 수량도 0보다 크면 고를 수 있다', () => {
    expect(describeLineSelect(inboundReceiptLine({ lotId: 9601, receivedQty: 0.5 })).kind).toBe(
      'selectable',
    );
  });

  /*
   * 둘 다 어긋난 줄에서는 **자재 LOT 사유를 먼저 낸다.** 수량을 고쳐도 LOT이 없으면
   * 여전히 고를 수 없는데 「수량을 고치면 된다」로 읽히면 사용자가 헛돈다.
   */
  it('둘 다 어긋나면 자재 LOT 사유를 낸다', () => {
    expect(describeLineSelect(inboundReceiptLine({ lotId: null, receivedQty: 0 })).kind).toBe(
      'blocked',
    );
    expect(describeLineSelect(inboundReceiptLine({ lotId: null, receivedQty: 0 }))).toEqual({
      kind: 'blocked',
      reason: t.reasons.lineNoLot,
    });
  });

  /*
   * **상태 코드로 판정하지 않는다**(공유계약 G-2). 값 목록이 확정되지 않아 값으로 분기하면
   * 값이 정해질 때 조용히 틀린다.
   */
  it('상태 코드가 무엇이든 판정이 달라지지 않는다', () => {
    const base = { lotId: 9601, receivedQty: 100 };

    expect(describeLineSelect(inboundReceiptLine({ ...base, statusCode: 'ANY_A' })).kind).toBe(
      'selectable',
    );
    expect(describeLineSelect(inboundReceiptLine({ ...base, statusCode: 'ANY_B' })).kind).toBe(
      'selectable',
    );
  });
});

describe('isLineSelectable', () => {
  it('고를 수 있는 줄만 참이다', () => {
    expect(isLineSelectable(inboundReceiptLine({ lotId: 9601, receivedQty: 1 }))).toBe(true);
    expect(isLineSelectable(inboundReceiptLine({ lotId: null }))).toBe(false);
  });
});

describe('nextSelectedLineId', () => {
  /* **M16** — 한 줄만 고른다. 둘째를 고르면 앞 선택이 풀린다(계획 결정 3). */
  it('다른 줄을 고르면 그 줄로 옮긴다', () => {
    expect(nextSelectedLineId(9401, 9402)).toBe(9402);
  });

  it('고른 줄을 다시 누르면 푼다', () => {
    expect(nextSelectedLineId(9401, 9401)).toBeNull();
  });

  it('아무것도 고르지 않았으면 누른 줄을 고른다', () => {
    expect(nextSelectedLineId(null, 9401)).toBe(9401);
  });
});

describe('findSelectedLine', () => {
  it('고른 줄을 라인 목록에서 찾는다', () => {
    expect(findSelectedLine(inboundReceiptLineFixtures, 9401)?.inboundReceiptLineId).toBe(9401);
  });

  it('고르지 않았으면 없다', () => {
    expect(findSelectedLine(inboundReceiptLineFixtures, null)).toBeNull();
  });

  /* **M17의 뿌리** — 갱신된 라인에 그 줄이 없으면 주소에서 정리해야 한다. */
  it('라인 목록에 없는 줄이면 없다', () => {
    expect(findSelectedLine(inboundReceiptLineFixtures, 9499)).toBeNull();
  });

  /*
   * **고를 수 없게 된 줄도 없는 것으로 본다.** 주소를 손으로 고쳐 LOT 없는 줄을 가리키면,
   * 그대로 두었을 때 「고를 수 없다고 표시된 줄이 골라져 있는」 상태가 된다.
   */
  it('고를 수 없는 줄이면 없다', () => {
    const lines = [inboundReceiptLine({ inboundReceiptLineId: 9410, lotId: null })];

    expect(findSelectedLine(lines, 9410)).toBeNull();
  });
});
