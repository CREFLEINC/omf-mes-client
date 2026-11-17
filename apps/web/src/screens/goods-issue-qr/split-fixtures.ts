import type { SplitMaterialLot } from './split-lots';

/**
 * 시험 전용 분할 LOT(합성값) — 원래 LOT 1,000 EA 에서 300 을 부분 출고한 것. 런타임 코드는 이 모듈을 참조하지 않는다.
 */
export const splitLot = (overrides: Partial<SplitMaterialLot> = {}): SplitMaterialLot => ({
  lotId: 7101,
  lotNo: 'SYN-ITEM-A|300|261117|100330|0001-S1',
  statusCode: 'NORMAL',
  lifecycleStatusCode: 'ACTIVE',
  item: { itemId: 7201, itemCode: 'SYN-ITEM-A', itemName: '합성 커넥터 하우징' },
  uomId: 7301,
  uomCode: 'EA',
  qty: 300,
  supplier: { supplierId: 7401, supplierCode: '100330', supplierName: '합성 공급사' },
  parentLot: { lotId: 7100, lotNo: 'SYN-ITEM-A|1000|261117|100330|0001' },
  splitAt: '2026-11-17T01:40:00Z',
  goodsIssue: {
    goodsIssueId: 7501,
    goodsIssueNo: 'GI-SYN-0003',
    goodsIssueLineId: 7601,
    lineNo: 1,
  },
  destination: { warehouseCode: 'WH-P1', locationCode: 'S220-WIP' },
  labelIssue: null,
  ...overrides,
});

export const FAILED_ISSUE: NonNullable<SplitMaterialLot['labelIssue']> = {
  issueCount: 1,
  lastIssueSeq: 1,
  lastPrintOutcomeCode: 'FAILED',
  lastIssuedAt: '2026-11-17T02:21:00Z',
};

export const PRINTED_ISSUE: NonNullable<SplitMaterialLot['labelIssue']> = {
  issueCount: 1,
  lastIssueSeq: 1,
  lastPrintOutcomeCode: 'SUCCEEDED',
  lastIssuedAt: '2026-11-17T03:31:00Z',
};
