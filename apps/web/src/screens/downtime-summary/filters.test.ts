import { describe, expect, it } from 'vitest';

import {
  EMPTY_FILTERS,
  readBucket,
  readFilters,
  readGroupBy,
  readPeriodParams,
  toFilterQuery,
  toSearchParams,
} from './filters';

const params = (search: string): URLSearchParams => new URLSearchParams(search);

describe('readGroupBy', () => {
  it('계약의 값을 그대로 읽는다', () => {
    expect(readGroupBy('EQUIPMENT')).toBe('EQUIPMENT');
  });

  /**
   * 주소는 손으로 고쳐지는 자리다. 모르는 값을 그대로 서버에 넘기면 400이 나고,
   * 사용자는 자기가 무엇을 잘못했는지 알 수 없다.
   */
  it('모르는 값은 기본 탭이다', () => {
    expect(readGroupBy('SYN-UNKNOWN')).toBe('REASON');
    expect(readGroupBy(null)).toBe('REASON');
  });
});

describe('readBucket', () => {
  it('모르는 값은 기본 칸 크기다', () => {
    expect(readBucket('WEEK')).toBe('WEEK');
    expect(readBucket('SYN-UNKNOWN')).toBe('DAY');
  });
});

describe('readFilters', () => {
  it('주소의 값을 그대로 읽는다', () => {
    expect(readFilters(params('plant=1001&group=1002&equipment=1003'))).toEqual({
      plant: '1001',
      equipmentGroup: '1002',
      equipment: '1003',
    });
  });

  it('양의 정수가 아니면 조건이 아니다 — 서버에 쓰레기를 넘기지 않는다', () => {
    expect(readFilters(params('plant=0&group=-1&equipment=abc'))).toEqual(EMPTY_FILTERS);
  });
});

describe('toSearchParams', () => {
  const period = { from: '2026-08-01', to: '2026-08-18' };

  it('기본 탭·기본 칸 크기는 싣지 않는다 — 주소가 길어지기만 한다', () => {
    expect(toSearchParams(period, EMPTY_FILTERS, 'REASON', 'DAY').toString()).toBe(
      'from=2026-08-01&to=2026-08-18',
    );
  });

  it('기본이 아닌 탭은 싣는다 — 탭이 곧 서버에 보내는 묶음 축이다', () => {
    expect(toSearchParams(period, EMPTY_FILTERS, 'EQUIPMENT', 'DAY').get('tab')).toBe('EQUIPMENT');
  });

  /** 칸 크기는 추이 탭에서만 뜻이 있다 — 다른 탭에 남기면 조건이 걸린 것처럼 보인다. */
  it('추이 탭이 아니면 칸 크기를 싣지 않는다', () => {
    expect(toSearchParams(period, EMPTY_FILTERS, 'REASON', 'MONTH').get('bucket')).toBeNull();
    expect(toSearchParams(period, EMPTY_FILTERS, 'PERIOD', 'MONTH').get('bucket')).toBe('MONTH');
  });

  it('읽기와 쓰기가 서로를 되돌린다', () => {
    const filters = { plant: '1001', equipmentGroup: '1002', equipment: '1003' };
    const written = toSearchParams(period, filters, 'PERIOD', 'WEEK');

    expect(readFilters(written)).toEqual(filters);
    expect(readPeriodParams(written)).toEqual(period);
    expect(readGroupBy(written.get('tab'))).toBe('PERIOD');
    expect(readBucket(written.get('bucket'))).toBe('WEEK');
  });
});

describe('toFilterQuery', () => {
  it('빈 조건은 키 자체를 싣지 않는다', () => {
    expect(toFilterQuery(EMPTY_FILTERS)).toEqual({});
  });

  it('내부 번호를 수로 옮긴다 — 계약이 정수를 요구한다', () => {
    expect(toFilterQuery({ plant: '1001', equipmentGroup: '', equipment: '1003' })).toEqual({
      plantId: 1001,
      equipmentId: 1003,
    });
  });
});
