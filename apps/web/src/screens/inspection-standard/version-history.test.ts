import { describe, expect, it } from 'vitest';

import type { CompareLabels } from './version-compare';
import { toHistoryRow, type VersionAuditEvent } from './version-history';

const labels: CompareLabels = {
  samplingMethod: (code) => (code === 'FULL_INSPECTION' ? '전수검사' : code),
  inspectionFrequency: (code) => code,
  frequencyIntervalUom: (code) => code,
  dataType: (code) => (code === 'NUMERIC' ? '수치' : code),
  uom: (id) => `단위 ${id}`,
  inspectionMethod: (code) => code,
  equipment: (id) => id,
};

const event = (overrides: Partial<VersionAuditEvent>): VersionAuditEvent => ({
  auditEventId: 1,
  occurredAt: '2026-10-28T01:00:00Z',
  eventTypeCode: 'UPDATE',
  beforeValue: null,
  afterValue: null,
  performedBy: 7,
  ...overrides,
});

describe('toHistoryRow', () => {
  it('버전 설정 저장은 바뀐 칸마다 「이름: 전 → 후」로 낸다', () => {
    const row = toHistoryRow(
      event({
        beforeValue: { samplingMethodCode: 'FULL_INSPECTION', aqlValue: null },
        afterValue: { samplingMethodCode: 'SAMPLE_BY_LOT', aqlValue: 0.65 },
      }),
      labels,
    );

    expect(row.action).toBe('버전 설정');
    expect(row.changes).toEqual([
      { label: '검사 방식', before: '전수검사', after: 'SAMPLE_BY_LOT' },
      { label: 'AQL', before: '—', after: '0.65' },
    ]);
  });

  it('검사 항목 저장은 항목코드별 추가 · 삭제 · 바뀐 칸을 낸다', () => {
    const row = toHistoryRow(
      event({
        beforeValue: {
          items: [
            { inspectionItemCode: 'LEN', targetValue: 12.5 },
            { inspectionItemCode: 'WGT', targetValue: 250 },
          ],
        },
        afterValue: {
          items: [
            { inspectionItemCode: 'LEN', targetValue: 12.6 },
            { inspectionItemCode: 'HGT', targetValue: 8 },
          ],
        },
      }),
      labels,
    );

    expect(row.action).toBe('검사 항목');
    expect(row.changes).toEqual([
      { label: 'LEN · 기준값', before: '12.5', after: '12.6' },
      { label: 'HGT', note: 'added' },
      { label: 'WGT', note: 'removed' },
    ]);
  });

  it('상태 전이 · 발행 · 작성 취소를 가른다', () => {
    expect(
      toHistoryRow(
        event({ beforeValue: { statusCode: 'DRAFT' }, afterValue: { statusCode: 'CONFIRMED' } }),
        labels,
      ).action,
    ).toBe('확정');
    expect(
      toHistoryRow(
        event({ eventTypeCode: 'CREATE', afterValue: { planVersion: 3, statusCode: 'DRAFT' } }),
        labels,
      ).action,
    ).toBe('신규 버전 발행');
    expect(toHistoryRow(event({ eventTypeCode: 'DELETE' }), labels).action).toBe('작성 취소');
  });
});
