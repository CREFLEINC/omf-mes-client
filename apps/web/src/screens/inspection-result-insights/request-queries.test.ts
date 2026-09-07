import { describe, expect, it } from 'vitest';

import { EMPTY_INSPECTION_INSIGHT_FILTERS, type InspectionInsightFilters } from './filters';
import {
  toDefectDistributionQuery,
  toDefectRateTrendQuery,
  toInspectionListQuery,
  toInspectionSummaryQuery,
} from './request-queries';

/* 계약이 기간의 두 끝을 `date-time` 으로 받는다 — 화면이 고른 날짜의 시작·끝 시각이 실린다. */
const zone = (): string => {
  const offsetMinutes = -new Date().getTimezoneOffset();
  const absolute = Math.abs(offsetMinutes);
  const pad = (value: number): string => String(value).padStart(2, '0');

  return `${offsetMinutes < 0 ? '-' : '+'}${pad(Math.floor(absolute / 60))}:${pad(absolute % 60)}`;
};
const FROM_AT = `2026-08-01T00:00:00${zone()}`;
const TO_AT = `2026-08-31T23:59:59${zone()}`;

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
  it('기간이 미확정이면 모든 요청을 만들지 않는다', () => {
    const withoutPeriod = { ...FILTERS, to: '' };

    for (const filters of [EMPTY_INSPECTION_INSIGHT_FILTERS, withoutPeriod]) {
      expect(toInspectionListQuery(filters, 'inspectedAt,desc', 1)).toBeNull();
      expect(toInspectionSummaryQuery(filters)).toBeNull();
      expect(toDefectRateTrendQuery(filters)).toBeNull();
      expect(toDefectDistributionQuery(filters, 'defectCode', '')).toBeNull();
    }
  });

  it('검사유형 전체는 목록·분포만 허용하고 요약·추이 합산 요청은 막는다', () => {
    const overall = { ...FILTERS, inspectionTypeCode: '' };

    expect(toInspectionListQuery(overall, 'inspectedAt,desc', 1)).toEqual({
      itemId: 101,
      processId: 202,
      overallJudgmentCode: 'REJECTED',
      inspectedFrom: FROM_AT,
      inspectedTo: TO_AT,
      finalRoundOnly: true,
      calibrationExpired: 'exclude',
      sort: 'inspectedAt,desc',
    });
    expect(toInspectionSummaryQuery(overall)).toBeNull();
    expect(toDefectRateTrendQuery(overall)).toBeNull();
    expect(toDefectDistributionQuery(overall, 'defectCode', '')).not.toBeNull();
  });

  it('형식만 맞는 비실재 달력 날짜도 모든 요청을 막는다', () => {
    const invalid = { ...FILTERS, from: '2026-02-30' };

    expect(toInspectionListQuery(invalid, 'inspectedAt,desc', 1)).toBeNull();
    expect(toInspectionSummaryQuery(invalid)).toBeNull();
    expect(toDefectRateTrendQuery(invalid)).toBeNull();
    expect(toDefectDistributionQuery(invalid, 'defectCode', '')).toBeNull();
  });

  it('목록·요약·추이는 같은 공통 축을 쓰고 목록만 server sort와 page를 더한다', () => {
    const common = {
      inspectionTypeCode: 'PQC',
      itemId: 101,
      processId: 202,
      overallJudgmentCode: 'REJECTED',
      inspectedFrom: FROM_AT,
      inspectedTo: TO_AT,
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

  it('기간은 날짜가 아니라 하루의 시작·끝 시각으로 실린다', () => {
    const query = toInspectionSummaryQuery(FILTERS);

    /* 날짜만 보내면 계약이 형식에서 막는다 — 목 서버가 400 을 돌려준 자리다. */
    expect(query?.inspectedFrom).toMatch(/^2026-08-01T00:00:00[+-]\d{2}:\d{2}$/);
    expect(query?.inspectedTo).toMatch(/^2026-08-31T23:59:59[+-]\d{2}:\d{2}$/);
  });

  it('재검 전체 보기는 세 요청에 finalRoundOnly=false를 그대로 보낸다', () => {
    const allRounds = { ...FILTERS, finalRoundOnly: false };

    expect(toInspectionSummaryQuery(allRounds)?.finalRoundOnly).toBe(false);
    expect(toDefectRateTrendQuery(allRounds)?.finalRoundOnly).toBe(false);
    expect(toInspectionListQuery(allRounds, 'inspectedAt,desc', 1)?.finalRoundOnly).toBe(false);
  });
});

describe('불량 분포 모집단', () => {
  it('검사 집계와 다른 기간·품목·분포 축만 보낸다', () => {
    expect(toDefectDistributionQuery(FILTERS, 'occurrenceProcess', 'PQC')).toEqual({
      detectedFrom: FROM_AT,
      detectedTo: TO_AT,
      itemId: 101,
      groupBy: 'occurrenceProcess',
      sourceCode: 'PQC',
    });
  });
});
