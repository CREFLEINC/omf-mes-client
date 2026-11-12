import { messages } from '@omf-mes/i18n';
import { describe, expect, it } from 'vitest';

import { cycleLabelOf } from './cycle-label';
import type { InspectionInsightFilters } from './filters';
import type { InspectionResult } from './queries';
import { toInspectionResultTreeRows } from './reinspection-chain';
import { toInspectionListQuery } from './request-queries';

/* 005 D-18 · T128 — 입하 LOT IQC 결과는 확정 주기(`confirmCycle`)로 「처음」·「재검 n차」, 옛 결과는 사슬 깊이 그대로. */

const t = messages.inspectionResultInsights.overview;

const result = (
  inspectionResultId: number,
  overrides: Partial<InspectionResult> = {},
): InspectionResult => ({
  inspectionResultId,
  inspectionResultNo: `SAMPLE-RESULT-${String(inspectionResultId)}`,
  inspectionRequestId: 900,
  inspectionRound: inspectionResultId,
  inspectedQty: 10,
  acceptedQty: 10,
  rejectedQty: 0,
  heldQty: 0,
  uomId: 1,
  overallJudgmentCode: 'ACCEPTED',
  inspectorId: 1,
  inspectedAt: '2026-11-11T09:00:00+07:00',
  statusCode: 'CONFIRMED',
  ...overrides,
});

describe('W-03-05 확정 주기 표시(D18-1)', () => {
  it('D18-1 confirmCycle 1 은 「처음」, 3 은 「재검 2차」다', () => {
    expect(cycleLabelOf({ confirmCycle: 1 })).toBe(t.firstCycle);
    expect(cycleLabelOf({ confirmCycle: 2 })).toBe(t.reinspectionCycle(1));
    expect(cycleLabelOf({ confirmCycle: 3 })).toBe(t.reinspectionCycle(2));
    expect(t.reinspectionCycle(2)).toBe('재검 2차');
    expect(t.firstCycle).toBe('처음');
  });

  it('D18-1 confirmCycle 이 없거나 null 인 행(옛 IQC · PQC · OQC)은 주기 표시가 없다', () => {
    expect(cycleLabelOf({})).toBeNull();
    expect(cycleLabelOf({ confirmCycle: null })).toBeNull();
    expect(cycleLabelOf({ confirmCycle: 0 })).toBeNull();
  });

  it('D18-1 주기가 있는 행은 주기 표시를 달고, 없는 행은 previousResultId 사슬 깊이를 그대로 쓴다', () => {
    const rows = toInspectionResultTreeRows([
      result(1, { inspectionRequestId: 910, confirmCycle: 1 }),
      result(2, { inspectionRequestId: 910, confirmCycle: 3 }),
      result(3, { inspectionRequestId: 920 }),
      result(4, { inspectionRequestId: 920, previousResultId: 3 }),
    ]);

    expect(rows.map(({ cycleLabel, depth }) => [cycleLabel, depth])).toEqual([
      [t.firstCycle, 0],
      [t.reinspectionCycle(2), 0],
      [null, 0],
      [null, 1],
    ]);
  });

  it('D18-1 「최종 회차만」은 목록 요청에 finalRoundOnly=true 를 싣고, 끄면 false 를 싣는다(서버가 마지막 주기로 거른다)', () => {
    const filters: InspectionInsightFilters = {
      from: '2026-11-01',
      to: '2026-11-30',
      inspectionTypeCode: 'IQC',
      itemId: '',
      processId: '',
      overallJudgmentCode: '',
      lotNo: '',
      finalRoundOnly: true,
      calibrationExpired: '',
    };

    expect(toInspectionListQuery(filters, 'inspectedAt,desc', 1)?.finalRoundOnly).toBe(true);
    expect(
      toInspectionListQuery({ ...filters, finalRoundOnly: false }, 'inspectedAt,desc', 1)
        ?.finalRoundOnly,
    ).toBe(false);
  });
});
