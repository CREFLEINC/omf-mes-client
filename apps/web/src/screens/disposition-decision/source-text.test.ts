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

describe('G2 L13 시안 문구', () => {
  it('특채 팝업 대상은 「자재 관리 LOT n개 전부」가 앞에 선다(좁은 칸에서 잘리지 않게)', () => {
    expect(t.sortedFromTail('0004')).toContain('0004');
    expect(messages.dispositionDecision.concession.targetAll('IL-20991111-0001', 3)).toMatch(
      /^자재 관리 LOT 3개 전부/u,
    );
  });

  it('W-01-01 검사 조건은 「AQL 1.0」 — 정수도 소수 한 자리', () => {
    expect(messages.partsIqcInspection.target.conditionAql(1)).toMatch(/^AQL 1\.0 /u);
    expect(messages.partsIqcInspection.target.conditionAql(0.65)).toMatch(/^AQL 0\.65 /u);
  });
});

