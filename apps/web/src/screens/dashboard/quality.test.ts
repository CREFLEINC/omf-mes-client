import { describe, expect, it } from 'vitest';

import { shortDate, sumLots, toDailyPoints, toDailyRateRows, toRecentLotRows } from './quality';
import { quality, qualityBlock } from './quality.fixture';

describe('품질 계산', () => {
  it('단일 유형 그래프는 합격률이 없는 날을 뺀다 — 0%로 찍지 않는다', () => {
    expect(toDailyPoints(qualityBlock())).toEqual([
      { label: '10-14', value: 95 },
      { label: '10-16', value: 97.5 },
    ]);
  });

  it('품질 종합 표는 세 유형을 날짜 한 줄에 놓고, 없는 칸은 null 로 남긴다', () => {
    const rows = toDailyRateRows(quality());

    expect(rows.map((row) => row.date)).toEqual(['2026-10-14', '2026-10-15', '2026-10-16']);
    expect(rows[1]?.rates).toEqual({ IQC: null, PQC: null, OQC: null });
    expect(rows[2]?.rates.OQC).toBe(97.5);
  });

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
