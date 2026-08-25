import { describe, expect, it } from 'vitest';

import {
  EMPTY_INSPECTION_INSIGHT_FILTERS,
  readInspectionInsightFilters,
  readInspectionResultPage,
  readInspectionResultSort,
} from './filters';

const ALLOWED = {
  inspectionTypeCodes: new Set(['IQC', 'PQC']),
  judgmentCodes: new Set(['ACCEPTED', 'REJECTED']),
};

describe('검사 실적 조회 조건', () => {
  it('주소의 기간·검사유형·공통 축을 읽고 기본은 최종 회차만 본다', () => {
    const params = new URLSearchParams(
      'from=2026-08-01&to=2026-08-31&type=IQC&item=101&process=202&judgment=REJECTED&calibration=only',
    );

    expect(readInspectionInsightFilters(params, ALLOWED)).toEqual({
      kind: 'VALID',
      filters: {
        from: '2026-08-01',
        to: '2026-08-31',
        inspectionTypeCode: 'IQC',
        itemId: '101',
        processId: '202',
        overallJudgmentCode: 'REJECTED',
        finalRoundOnly: true,
        calibrationExpired: 'only',
      },
    });
  });

  it('rounds=all은 재검 사슬 전체를 열고 다른 값은 fail-closed한다', () => {
    expect(readInspectionInsightFilters(new URLSearchParams('rounds=all'), ALLOWED)).toMatchObject({
      kind: 'VALID',
      filters: { finalRoundOnly: false },
    });
    expect(readInspectionInsightFilters(new URLSearchParams('rounds=latest'), ALLOWED)).toEqual({
      kind: 'INVALID',
      filters: EMPTY_INSPECTION_INSIGHT_FILTERS,
    });
  });

  it('주소의 미확정 ID·교정 값은 API 조건으로 보존하지 않는다', () => {
    const params = new URLSearchParams('item=0&process=abc&calibration=unknown');

    expect(readInspectionInsightFilters(params, ALLOWED)).toEqual({
      kind: 'VALID',
      filters: EMPTY_INSPECTION_INSIGHT_FILTERS,
    });
  });

  it('실재하지 않는 날짜와 준비된 option에 없는 code를 보존하지 않는다', () => {
    const params = new URLSearchParams(
      'from=2026-02-30&to=2026-13-01&type=UNKNOWN&judgment=UNKNOWN',
    );

    expect(readInspectionInsightFilters(params, ALLOWED)).toEqual({
      kind: 'INVALID',
      filters: EMPTY_INSPECTION_INSIGHT_FILTERS,
    });
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
