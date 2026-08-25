import { describe, expect, it } from 'vitest';

import {
  EMPTY_INSPECTION_INSIGHT_FILTERS,
  readInspectionInsightFilters,
  readInspectionResultPage,
  readInspectionResultSort,
} from './filters';

describe('검사 실적 조회 조건', () => {
  it('주소의 기간·검사유형·공통 축을 읽고 최종 회차만 고정한다', () => {
    const params = new URLSearchParams(
      'from=2026-08-01&to=2026-08-31&type=IQC&item=101&process=202&judgment=REJECTED&calibration=only',
    );

    expect(readInspectionInsightFilters(params)).toEqual({
      from: '2026-08-01',
      to: '2026-08-31',
      inspectionTypeCode: 'IQC',
      itemId: '101',
      processId: '202',
      overallJudgmentCode: 'REJECTED',
      finalRoundOnly: true,
      calibrationExpired: 'only',
    });
  });

  it('주소의 미확정 ID·교정 값은 API 조건으로 보존하지 않는다', () => {
    const params = new URLSearchParams('item=0&process=abc&calibration=unknown');

    expect(readInspectionInsightFilters(params)).toEqual(EMPTY_INSPECTION_INSIGHT_FILTERS);
  });

  it.each([
    ['inspectionRequestNo,asc', 'inspectionRequestNo,asc'],
    ['inspectedAt,desc', 'inspectedAt,desc'],
    ['rejectedQty,asc', 'rejectedQty,asc'],
    ['inspectionRound,asc', 'inspectedAt,desc'],
  ] as const)('server sort %s를 %s로 제한한다', (raw, expected) => {
    expect(readInspectionResultSort(new URLSearchParams({ sort: raw }))).toBe(expected);
  });

  it.each([
    ['2', 2],
    ['0', 1],
    ['1.5', 1],
    ['9007199254740992', 1],
  ])('page=%s를 %i로 읽는다', (raw, expected) => {
    expect(readInspectionResultPage(new URLSearchParams({ page: raw }))).toBe(expected);
  });
});
