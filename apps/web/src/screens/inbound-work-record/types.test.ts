import { messages } from '@omf-mes/i18n';
import { describe, expect, it } from 'vitest';

import { materialLot } from './fixtures';
import { materialLotStatus } from './types';

/** W-01-16 상세 자재 관리 LOT 상태 칩(G2 L5). 지어낸 값만 쓴다. */

const s = messages.inboundWorkRecord.detail.lotStatus;

describe('W-01-16 자재 관리 LOT 상태 칩', () => {
  it('G2 L5 입고 뒤 공급사 반품한 LOT 은 「입고됨」이 아니라 「반품 처분 끝」, 폐기는 「폐기 처분 끝」', () => {
    expect(
      materialLotStatus(
        materialLot(1, { goodsReceived: true, dispositionStatusCode: 'RETURNED' }),
        'RECEIVED',
      ).label,
    ).toBe(s.returned);
    expect(
      materialLotStatus(
        materialLot(2, { goodsReceived: true, dispositionStatusCode: 'DISPOSED' }),
        'RECEIVED',
      ).label,
    ).toBe(s.disposed);
  });

  it('G2 L5 입고 취소 요청 중인 LOT(막힘 RECEIPT_CANCEL_PENDING 의 LOT 번호)은 「입고 취소 요청 중」', () => {
    const lot = materialLot(3, { goodsReceived: true });

    expect(
      materialLotStatus(lot, 'RECEIVED', [{ code: 'RECEIPT_CANCEL_PENDING', lotNos: [lot.lotNo] }])
        .label,
    ).toBe(s.receiptCancelPending);
    expect(materialLotStatus(lot, 'RECEIVED', []).label).toBe(s.received);
  });
});
