import { describe, expect, it } from 'vitest';

import { FAILED_ISSUE, PRINTED_ISSUE, splitLot } from './split-fixtures';
import {
  isUnprinted,
  issuedRangeOf,
  matchesSplitLot,
  needsReissueReason,
  nextIssueSeq,
  toLabelLot,
} from './split-lots';

describe('분할 LOT 판정 (008 P-01-02)', () => {
  it('US2-1 · US2-3 발행 기록이 없거나 마지막 인쇄가 실패면 미발행이다 — PENDING 은 찍은 것으로 본다', () => {
    expect(isUnprinted(splitLot())).toBe(true);
    expect(isUnprinted(splitLot({ labelIssue: FAILED_ISSUE }))).toBe(true);
    expect(isUnprinted(splitLot({ labelIssue: PRINTED_ISSUE }))).toBe(false);
    expect(
      isUnprinted(splitLot({ labelIssue: { ...PRINTED_ISSUE, lastPrintOutcomeCode: 'PENDING' } })),
    ).toBe(false);
  });

  it('US2-4 발행 기록이 한 번이라도 있으면 재발행 사유가 필요하다(인쇄 실패 포함)', () => {
    expect(needsReissueReason(splitLot())).toBe(false);
    expect(needsReissueReason(splitLot({ labelIssue: FAILED_ISSUE }))).toBe(true);
    expect(needsReissueReason(splitLot({ labelIssue: PRINTED_ISSUE }))).toBe(true);
    expect(nextIssueSeq(splitLot())).toBe(1);
    expect(nextIssueSeq(splitLot({ labelIssue: { ...PRINTED_ISSUE, lastIssueSeq: 2 } }))).toBe(3);
  });

  it('찾기는 분할 LOT·원래 LOT 번호, 출고번호, 품목코드·품명을 본다', () => {
    const lot = splitLot();

    expect(matchesSplitLot(lot, '')).toBe(true);
    expect(matchesSplitLot(lot, lot.lotNo)).toBe(true);
    expect(matchesSplitLot(lot, lot.parentLot.lotNo)).toBe(true);
    expect(matchesSplitLot(lot, 'gi-syn-0003')).toBe(true);
    expect(matchesSplitLot(lot, 'syn-item-a')).toBe(true);
    expect(matchesSplitLot(lot, '하우징')).toBe(true);
    expect(matchesSplitLot(lot, 'OTHER')).toBe(false);
  });

  it('US2-2 라벨 면 값 — 수량은 분할 수량, 공급사는 원조 입하의 것, 패키징 줄은 없다', () => {
    expect(toLabelLot(splitLot())).toEqual({
      itemCode: 'SYN-ITEM-A',
      itemName: '합성 커넥터 하우징',
      lotNo: 'SYN-ITEM-A|300|261117|100330|0001-S1',
      lotQty: 300,
      uomCode: 'EA',
      supplierCode: '100330',
      supplierName: '합성 공급사',
      package: null,
    });
    expect(toLabelLot(splitLot({ supplier: null }))).toMatchObject({
      supplierCode: null,
      supplierName: null,
    });
  });

  it('찍음 보기의 출고일 범위는 공장 날짜 오늘까지다', () => {
    /* 2026-11-17 01:00 UTC = 공장(+07:00) 08:00 */
    const now = new Date('2026-11-17T01:00:00Z');

    expect(issuedRangeOf('today', now)).toEqual({
      issuedFrom: '2026-11-17',
      issuedTo: '2026-11-17',
    });
    expect(issuedRangeOf('week', now)).toEqual({
      issuedFrom: '2026-11-11',
      issuedTo: '2026-11-17',
    });
    expect(issuedRangeOf('month', now)).toEqual({
      issuedFrom: '2026-10-19',
      issuedTo: '2026-11-17',
    });
  });
});
