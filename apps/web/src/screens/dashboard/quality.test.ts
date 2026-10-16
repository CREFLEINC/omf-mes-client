import { describe, expect, it } from 'vitest';

import { shortDate, sumLots, toRecentLotRows } from './quality';
import { quality } from './quality.fixture';

describe('품질 계산', () => {
  it('금일 검사 LOT 은 세 유형을 더한다', () => {
    const q = quality();

    expect(sumLots([q.iqc.todayLots, q.pqc.todayLots, q.oqc.todayLots])).toEqual({
      accepted: 6,
      rejected: 3,
      held: 3,
    });
  });

  it('최근 판정은 세 유형을 합쳐 최근 것부터', () => {
    expect(toRecentLotRows(quality()).map((row) => [row.kind, row.inspectionResultId])).toEqual([
      ['PQC', 2],
      ['IQC', 1],
    ]);
  });

  it('날짜 표기는 월-일만 — 모양이 다르면 그대로', () => {
    expect(shortDate('2026-10-16')).toBe('10-16');
    expect(shortDate('어제')).toBe('어제');
  });
});
