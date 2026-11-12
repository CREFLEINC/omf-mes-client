import { describe, expect, it } from 'vitest';

import { isVoided, isWaiting, pairKeyOf, toLabelLots } from './types';

/** 합성값이다 — 실 운영 값을 쓰지 않는다(공개 저장소 경계). */
describe('toLabelLots — 공급사·품목 묶음의 LOT 을 화면 줄로', () => {
  it('묶음의 공급사·품목·기본 단위·IQC 대상을 LOT 마다 싣는다', () => {
    const [lot] = toLabelLots({
      supplierId: 8201,
      supplierCode: 'SYN-P-01',
      supplierName: '합성 공급사 가',
      itemId: 8601,
      itemCode: 'SYN-ITEM-01',
      itemName: '합성 품목 가',
      uomId: 8401,
      uomCode: 'EA',
      inspectionRequired: true,
      waitingCount: 1,
      waitingQty: 1000,
      unprintedCount: 1,
      lastIssuedAt: null,
      batches: [],
      lots: [
        {
          lotId: 9001,
          lotNo: 'SYN-ITEM-01|1000|261111|SYN-P-01|0001',
          lotQty: 1000,
          package: { uomId: 8402, uomCode: '봉지', count: 10, qtyPerPackage: 100 },
          supplierLotNo: 'SYN-SL-1',
          lifecycleStatusCode: 'WAITING',
          statusCode: 'INSPECTION_PENDING',
          inboundLotId: null,
          inboundLotNo: null,
          lastLabelIssue: null,
          createdChannelCode: 'POP',
          createdAt: '2026-11-11T01:00:00Z',
        },
      ],
    });

    expect(lot).toMatchObject({
      lotId: 9001,
      supplierCode: 'SYN-P-01',
      itemCode: 'SYN-ITEM-01',
      uomCode: 'EA',
      inspectionRequired: true,
      supplierLotNo: 'SYN-SL-1',
      lastIssue: null,
    });
    expect(lot !== undefined && isWaiting(lot)).toBe(true);
    expect(lot !== undefined && isVoided(lot)).toBe(false);
  });

  it('공급사·품목 열쇠는 둘을 함께 쓴다', () => {
    expect(pairKeyOf(8201, 8601)).toBe('8201:8601');
    expect(pairKeyOf(8201, 8601)).not.toBe(pairKeyOf(8601, 8201));
  });
});
