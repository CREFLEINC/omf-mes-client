import { describe, expect, it } from 'vitest';

import { receiptLine } from './fixtures';
import { toReceiptLineStatus, toReceiptLineView } from './types';

describe('toReceiptLineStatus', () => {
  it('출고량을 그대로 받았으면 수령 완료다', () => {
    expect(toReceiptLineStatus({ receivedQty: 100, varianceQty: 0 })).toBe('matched');
  });

  it('일부만 받았으면 부족이다', () => {
    expect(toReceiptLineStatus({ receivedQty: 180, varianceQty: 20 })).toBe('short');
  });

  it('한 개도 받지 못했으면 미수령이다', () => {
    expect(toReceiptLineStatus({ receivedQty: 0, varianceQty: 50 })).toBe('none');
  });

  /*
   * 차이 수량만 보면 이 줄이 「수령 완료」로 읽힌다 — 출고량이 0이라 차이도 0이기 때문이다.
   * 「받은 것이 없다」는 받은 양이 정하는 사실이다.
   */
  it('출고량이 0이라 차이도 0인 줄을 수령 완료로 읽지 않는다', () => {
    expect(toReceiptLineStatus({ receivedQty: 0, varianceQty: 0 })).toBe('none');
  });

  /*
   * 계약은 수령량을 출고량 이하로 두지만 그것은 서버의 약속이다. 어긋난 값이 와도 「부족」이라
   * 말하지 않는다 — 받은 것이 있고 모자라지 않다.
   */
  it('차이가 음수여도 부족이라 말하지 않는다', () => {
    expect(toReceiptLineStatus({ receivedQty: 120, varianceQty: -20 })).toBe('matched');
  });
});

describe('toReceiptLineView', () => {
  it('계약 응답을 화면 타입으로 옮기고 상태를 함께 담는다', () => {
    const view = toReceiptLineView(
      receiptLine({ issuedQty: 200, receivedQty: 180, varianceQty: 20 }),
    );

    expect(view).toMatchObject({
      shopfloorReceiptLineId: 7101,
      itemId: 7201,
      lotId: 7301,
      issuedQty: 200,
      receivedQty: 180,
      varianceQty: 20,
      status: 'short',
    });
  });
});
