import { describe, expect, it } from 'vitest';

import { EMPTY_INSPECTION_INSIGHT_FILTERS, type InspectionInsightFilters } from './filters';
import {
  toDefectDistributionQuery,
  toDefectRateTrendQuery,
  toInspectionListQuery,
  toInspectionSummaryQuery,
} from './request-queries';

const FILTERS: InspectionInsightFilters = {
  from: '2026-08-01',
  to: '2026-08-31',
  inspectionTypeCode: 'PQC',
  itemId: '101',
  processId: '202',
  overallJudgmentCode: 'REJECTED',
  finalRoundOnly: true,
  calibrationExpired: 'exclude',
};

describe('검사 목록·요약·추이 모집단', () => {
  it('검사유형 또는 기간이 미확정이면 집계 요청을 만들지 않는다', () => {
    const withoutType = { ...FILTERS, inspectionTypeCode: '' };
    const withoutPeriod = { ...FILTERS, to: '' };

    for (const filters of [EMPTY_INSPECTION_INSIGHT_FILTERS, withoutType, withoutPeriod]) {
      expect(toInspectionListQuery(filters, 'inspectedAt,desc', 1)).toBeNull();
      expect(toInspectionSummaryQuery(filters)).toBeNull();
      expect(toDefectRateTrendQuery(filters)).toBeNull();
      expect(toDefectDistributionQuery(filters, 'defectCode', '')).toBeNull();
    }
  });

  it('목록·요약·추이는 같은 공통 축을 쓰고 목록만 server sort와 page를 더한다', () => {
    const common = {
      inspectionTypeCode: 'PQC',
      itemId: 101,
      processId: 202,
      overallJudgmentCode: 'REJECTED',
      inspectedFrom: '2026-08-01',
      inspectedTo: '2026-08-31',
      finalRoundOnly: true,
      calibrationExpired: 'exclude',
    };

    expect(toInspectionSummaryQuery(FILTERS)).toEqual(common);
    expect(toDefectRateTrendQuery(FILTERS)).toEqual(common);
    expect(toInspectionListQuery(FILTERS, 'rejectedQty,asc', 3)).toEqual({
      ...common,
      sort: 'rejectedQty,asc',
      page: 3,
    });
  });
});

describe('불량 분포 모집단', () => {
  it('검사 집계와 다른 기간·품목·분포 축만 보낸다', () => {
    expect(toDefectDistributionQuery(FILTERS, 'occurrenceProcess', 'PQC')).toEqual({
      detectedFrom: '2026-08-01',
      detectedTo: '2026-08-31',
      itemId: 101,
      groupBy: 'occurrenceProcess',
      sourceAxisCode: 'PQC',
    });
  });
});
