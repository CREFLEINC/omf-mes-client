import { describe, expect, it } from 'vitest';

import { toIssueStage, toReceiptView, type TargetRow } from './types';

describe('toReceiptView', () => {
  it('화면이 쓰는 값만 옮긴다 — 나머지는 타입에 자리가 없다', () => {
    const view = toReceiptView({
      inboundReceiptId: 8101,
      inboundReceiptNo: 'SYN-IB-0001',
      supplierId: 8201,
      plantId: 8301,
      receiptDatetime: '2026-08-27T09:12:30Z',
      vehicleNo: 'SYN-VEHICLE-01',
      statusCode: 'SYN_STATUS',
    } as Parameters<typeof toReceiptView>[0]);

    expect(view).toEqual({
      inboundReceiptId: 8101,
      inboundReceiptNo: 'SYN-IB-0001',
      supplierId: 8201,
      // LOT 등록 본문이 요구한다 — 이 값은 화면이 쓰는 값이다.
      plantId: 8301,
      receiptDatetime: '2026-08-27T09:12:30Z',
      // 취소된 입하를 발행 대기에서 빼는 데 쓴다.
      statusCode: 'SYN_STATUS',
    });
  });
});

const targetRow = (lotId: number | null): TargetRow => ({
  inboundReceiptLineId: 8501,
  lineNo: 1,
  inboundReceiptId: 8101,
  inboundReceiptNo: 'SYN-IB-0001',
  supplierId: 8201,
  plantId: 8301,
  receiptDatetime: '2026-08-27T09:12:30Z',
  itemId: 8601,
  receivedQty: 500,
  uomId: 8401,
  lotId,
  inspectionRequired: false,
  lotNo: null,
  lotStatusCode: null,
  lastIssue: null,
});

describe('toIssueStage', () => {
  it('LOT 이 없으면 아직 등록하지 않은 것이다', () => {
    expect(toIssueStage(targetRow(null))).toBe('unregistered');
  });

  /**
   * ⛔ LOT 이 이미 있으면 등록을 다시 부르지 않는다 — 부르면 같은 자재에 LOT 이 둘 생기고
   * 되돌릴 화면이 없다(변경 통지 #534 §3).
   */
  it('LOT 이 있으면 등록이 끝난 것이다 — 인쇄만 남는다', () => {
    expect(toIssueStage(targetRow(9001))).toBe('registered');
  });
});
