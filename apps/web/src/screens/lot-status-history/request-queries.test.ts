import { describe, expect, it } from 'vitest';

import { EMPTY_HISTORY_FILTERS, EMPTY_LOT_FILTERS, type LotFilters } from './filters';
import {
  toLotHoldEventQuery,
  toLotHoldListQuery,
  toLotStatusListQuery,
  toLotStatusSummaryQuery,
} from './request-queries';

const LOT_FILTERS: LotFilters = {
  lotType: 'SAMPLE_TYPE',
  q: 'SAMPLE-LOT-001',
  item: '101',
  status: 'SAMPLE_STATUS',
  warehouse: '202',
  location: '303',
  sort: 'lotNoAsc',
};

describe('LOT 상태 목록·요약 요청', () => {
  it('하나의 적용 필터를 같은 계약 query 이름으로 옮긴다', () => {
    expect(toLotStatusListQuery(LOT_FILTERS, 3)).toEqual({
      lotTypeCode: 'SAMPLE_TYPE',
      q: 'SAMPLE-LOT-001',
      itemId: 101,
      lotStatusCode: 'SAMPLE_STATUS',
      warehouseId: 202,
      locationId: 303,
      sort: 'lotNoAsc',
      page: 3,
    });
    expect(toLotStatusSummaryQuery(LOT_FILTERS)).toEqual({
      lotTypeCode: 'SAMPLE_TYPE',
      q: 'SAMPLE-LOT-001',
      itemId: 101,
      lotStatusCode: 'SAMPLE_STATUS',
      warehouseId: 202,
      locationId: 303,
    });
  });

  it('요약은 목록의 공통 필터만 쓰고 page·size·sort를 갖지 않는다', () => {
    const list = toLotStatusListQuery(LOT_FILTERS, 3);
    const summary = toLotStatusSummaryQuery(LOT_FILTERS);
    if (list === null || summary === null) throw new Error('LOT 유형이 있는 요청입니다.');
    const commonList = Object.fromEntries(
      Object.entries(list).filter(([key]) => !['page', 'size', 'sort'].includes(key)),
    );

    expect(summary).toEqual(commonList);
    expect(summary).not.toHaveProperty('page');
    expect(summary).not.toHaveProperty('size');
    expect(summary).not.toHaveProperty('sort');
  });

  it('LOT 유형이 없으면 서로 다른 유형을 합쳐 조회하지 않는다', () => {
    expect(toLotStatusListQuery(EMPTY_LOT_FILTERS, 1)).toBeNull();
    expect(toLotStatusSummaryQuery(EMPTY_LOT_FILTERS)).toBeNull();
  });

  it('유형만 고른 첫 페이지는 기본 서버 정렬만 더한다', () => {
    const filters: LotFilters = { ...EMPTY_LOT_FILTERS, lotType: 'SAMPLE_TYPE' };

    expect(toLotStatusListQuery(filters, 1)).toEqual({
      lotTypeCode: 'SAMPLE_TYPE',
      sort: 'latestTransitionDesc',
    });
    expect(toLotStatusSummaryQuery(filters)).toEqual({ lotTypeCode: 'SAMPLE_TYPE' });
  });
});

describe('보류 사건 이력 요청', () => {
  it('지역 날짜 경계와 행위자 ID·LOT 번호·페이지를 사건 query로 옮긴다', () => {
    expect(
      toLotHoldEventQuery(
        {
          from: '2026-08-01',
          to: '2026-08-07',
          actor: '505',
          lot: 'SAMPLE-LOT-001',
        },
        4,
        540,
      ),
    ).toEqual({
      occurredFrom: '2026-08-01T00:00:00+09:00',
      occurredTo: '2026-08-07T23:59:59+09:00',
      actorId: 505,
      lotNo: 'SAMPLE-LOT-001',
      sort: 'occurredDesc',
      page: 4,
    });
  });

  it('기간이 빠지거나 잘못되면 요청을 만들지 않는다', () => {
    expect(toLotHoldEventQuery(EMPTY_HISTORY_FILTERS, 1, 540)).toBeNull();
    expect(
      toLotHoldEventQuery(
        { ...EMPTY_HISTORY_FILTERS, from: '2026-08-08', to: '2026-08-01' },
        1,
        540,
      ),
    ).toBeNull();
  });

  it('선택하지 않은 조건과 첫 페이지는 query에서 생략한다', () => {
    expect(
      toLotHoldEventQuery(
        { ...EMPTY_HISTORY_FILTERS, from: '2026-08-01', to: '2026-08-07' },
        1,
        -300,
      ),
    ).toEqual({
      occurredFrom: '2026-08-01T00:00:00-05:00',
      occurredTo: '2026-08-07T23:59:59-05:00',
      sort: 'occurredDesc',
    });
  });
});

describe('LOT 상세 보류 문서 요청', () => {
  it('선택한 LOT의 열린 건과 해제 건을 모두 조회한다', () => {
    expect(toLotHoldListQuery(404)).toEqual({ lotId: 404, open: false });
  });

  it('LOT을 선택하지 않았으면 요청을 만들지 않는다', () => {
    expect(toLotHoldListQuery(null)).toBeNull();
  });

  it.each([0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1])(
    '양의 안전 정수가 아닌 LOT ID %p로는 요청을 만들지 않는다',
    (lotId) => {
      expect(toLotHoldListQuery(lotId)).toBeNull();
    },
  );
});
