import { describe, expect, it } from 'vitest';

import {
  EMPTY_FILTERS,
  readFilters,
  toDrilldownParams,
  toFilterQuery,
  toSearchParams,
} from './filters';

const params = (search: string): URLSearchParams => new URLSearchParams(search);

describe('readFilters', () => {
  it('주소의 값을 그대로 읽는다', () => {
    expect(readFilters(params('baseDate=2026-08-24&plant=1001'))).toEqual({
      baseDate: '2026-08-24',
      plant: '1001',
    });
  });

  it('키가 없으면 빈 조건이다 — 기준 날짜가 비면 서버가 오늘로 정한다', () => {
    expect(readFilters(params(''))).toEqual(EMPTY_FILTERS);
  });

  /** 주소는 사람이 손으로 고치는 자리다. 쓰레기를 그대로 서버에 넘기지 않는다. */
  it('모양이 틀린 날짜는 조건이 아니다', () => {
    expect(readFilters(params('baseDate=2026-8-24')).baseDate).toBe('');
    expect(readFilters(params('baseDate=오늘')).baseDate).toBe('');
  });

  it('양의 정수가 아닌 공장 번호는 조건이 아니다', () => {
    expect(readFilters(params('plant=0')).plant).toBe('');
    expect(readFilters(params('plant=-3')).plant).toBe('');
    expect(readFilters(params('plant=1001x')).plant).toBe('');
  });
});

describe('toSearchParams', () => {
  it('채운 조건만 싣는다', () => {
    expect(toSearchParams({ baseDate: '2026-08-24', plant: '' }).toString()).toBe(
      'baseDate=2026-08-24',
    );
  });

  it('빈 조건이면 주소도 비운다', () => {
    expect(toSearchParams(EMPTY_FILTERS).toString()).toBe('');
  });

  it('읽기와 쓰기가 서로를 되돌린다', () => {
    const filters = { baseDate: '2026-08-24', plant: '1001' };

    expect(readFilters(toSearchParams(filters))).toEqual(filters);
  });
});

describe('toFilterQuery', () => {
  it('빈 조건은 키 자체를 싣지 않는다', () => {
    expect(toFilterQuery(EMPTY_FILTERS)).toEqual({});
  });

  it('공장 번호를 수로 옮긴다 — 계약이 정수를 요구한다', () => {
    expect(toFilterQuery({ baseDate: '', plant: '1001' })).toEqual({ plantId: 1001 });
  });
});

describe('toDrilldownParams', () => {
  it('기준 축을 함께 넘긴다 — 넘기지 않으면 어제 숫자를 눌렀는데 오늘 자료가 열린다', () => {
    expect(toDrilldownParams({ baseDate: '2026-08-24', plant: '1001' }, null).toString()).toBe(
      'baseDate=2026-08-24&plantId=1001',
    );
  });

  /**
   * ⭐ 기준 날짜를 비워 둔 상태(서버가 오늘로 정한 상태)에서도 축이 이어져야 한다.
   * 화면이 「오늘」을 스스로 계산하지 않으므로 **응답이 알려 준 날짜**를 쓴다.
   */
  it('날짜를 비워 두었으면 응답이 알려 준 기준일을 넘긴다', () => {
    expect(toDrilldownParams(EMPTY_FILTERS, '2026-08-24').toString()).toBe('baseDate=2026-08-24');
  });

  it('고른 날짜가 응답 기준일을 이긴다 — 사용자가 고른 것이 정본이다', () => {
    expect(
      toDrilldownParams({ baseDate: '2026-08-20', plant: '' }, '2026-08-24').get('baseDate'),
    ).toBe('2026-08-20');
  });

  it('아직 응답이 없으면 날짜를 지어내지 않는다', () => {
    expect(toDrilldownParams(EMPTY_FILTERS, null).toString()).toBe('');
  });
});
