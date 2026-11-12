import { messages } from '@omf-mes/i18n';
import { describe, expect, it } from 'vitest';

import { sourceTextOf, type Nonconformance } from './types';

/** W-03-10 목록 「원천」 칸(G2 L8 · screens/W-03-10.md 목록 행). 지어낸 값만 쓴다. */

const t = messages.dispositionDecision.inboundLot;

const nc = (over: Partial<Nonconformance>): Nonconformance =>
  ({
    nonconformanceId: 1,
    nonconformanceNo: 'SAMPLE-NC-0001',
    itemId: 1,
    sourceCode: 'PRODUCT',
    severityCode: 'MINOR',
    description: '',
    statusCode: 'OPEN',
    openedAt: '2099-11-11T01:00:00Z',
    affectedQtyTotal: 0,
    uomId: 1,
    dispositionProgressCode: 'NOT_STARTED',
    lots: [],
    ...over,
  }) as Nonconformance;

describe('W-03-10 목록 「원천」', () => {
  it('G2 L8 입하 LOT 이 있으면 「IQC · 자재 입하」, 반품 · 제품은 각각', () => {
    expect(sourceTextOf(nc({ inboundLotNo: 'IL-20991111-0001' }))).toBe(t.source.IQC);
    expect(sourceTextOf(nc({ sourceCode: 'RETURN' }))).toBe(t.source.RETURN);
    expect(sourceTextOf(nc({ sourceCode: 'PRODUCT' }))).toBe(t.source.PRODUCT);
  });

  it('G2 L8 선별로 생긴 부적합은 「· 선별 ← {원래 번호 끝 4자리}」', () => {
    expect(
      sourceTextOf(
        nc({ inboundLotNo: 'IL-20991111-0002', sortedFromNonconformanceNo: 'SAMPLE-NC-0004' }),
      ),
    ).toBe(`${t.source.IQC}${t.sortedFromTail('0004')}`);
  });
});
