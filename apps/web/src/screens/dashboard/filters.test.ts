import { describe, expect, it } from 'vitest';

import {
  EMPTY_FILTERS,
  MAX_PERIOD_DAYS,
  isLivePeriod,
  isSingleDay,
  periodProblemOf,
  plantToday,
  quickPeriodOf,
  readFilters,
  toDrilldownParams,
  toFilterQuery,
  toSearchParams,
} from './filters';

const params = (search: string): URLSearchParams => new URLSearchParams(search);

describe('readFilters', () => {
  it('주소의 기간 · 공장을 그대로 읽는다', () => {
    expect(readFilters(params('from=2026-08-18&to=2026-08-24&plant=1001'))).toEqual({
      dateFrom: '2026-08-18',
      dateTo: '2026-08-24',
      plant: '1001',
    });
  });

  it('예전 하루 조회 주소(baseDate)는 시작 = 끝으로 읽는다 — 공유된 주소가 깨지지 않게', () => {
    expect(readFilters(params('baseDate=2026-08-24'))).toEqual({
      dateFrom: '2026-08-24',
      dateTo: '2026-08-24',
      plant: '',
    });
  });

  it('키가 없으면 빈 조건이다 — 기간이 비면 서버가 오늘로 정한다', () => {
    expect(readFilters(params(''))).toEqual(EMPTY_FILTERS);
  });

  /** 주소는 사람이 손으로 고치는 자리다. 쓰레기를 그대로 서버에 넘기지 않는다. */
  it('모양이 틀린 날짜 · 한쪽만 있는 기간은 조건이 아니다', () => {
    expect(readFilters(params('from=2026-8-24&to=2026-08-24')).dateFrom).toBe('');
    expect(readFilters(params('from=2026-08-24')).dateFrom).toBe('');
    expect(readFilters(params('baseDate=오늘')).dateTo).toBe('');
  });

  it('양의 정수가 아닌 공장 번호는 조건이 아니다', () => {
    expect(readFilters(params('plant=0')).plant).toBe('');
    expect(readFilters(params('plant=-3')).plant).toBe('');
    expect(readFilters(params('plant=1001x')).plant).toBe('');
  });
});

describe('toSearchParams', () => {
  it('채운 조건만 싣는다 — 기간은 from · to', () => {
    expect(
      toSearchParams({ dateFrom: '2026-08-18', dateTo: '2026-08-24', plant: '' }).toString(),
    ).toBe('from=2026-08-18&to=2026-08-24');
  });

  it('빈 조건이면 주소도 비운다', () => {
    expect(toSearchParams(EMPTY_FILTERS).toString()).toBe('');
  });

  it('읽기와 쓰기가 서로를 되돌린다', () => {
    const filters = { dateFrom: '2026-08-18', dateTo: '2026-08-24', plant: '1001' };

    expect(readFilters(toSearchParams(filters))).toEqual(filters);
  });
});

describe('toFilterQuery', () => {
  it('빈 조건은 키 자체를 싣지 않는다', () => {
    expect(toFilterQuery(EMPTY_FILTERS)).toEqual({});
  });

  it('하루여도 dateFrom = dateTo 로 보낸다 — baseDate 는 쓰지 않는다(기간과 섞으면 400)', () => {
    expect(toFilterQuery({ dateFrom: '2026-08-24', dateTo: '2026-08-24', plant: '1001' })).toEqual({
      dateFrom: '2026-08-24',
      dateTo: '2026-08-24',
      plantId: 1001,
    });
  });
});

describe('toDrilldownParams', () => {
  it('기준 축을 함께 넘긴다 — 소유 화면은 하루 기준이라 기간의 끝 날', () => {
    expect(
      toDrilldownParams(
        { dateFrom: '2026-08-18', dateTo: '2026-08-24', plant: '1001' },
        null,
      ).toString(),
    ).toBe('baseDate=2026-08-24&plantId=1001');
  });

  it('기간을 비워 두었으면 응답이 알려 준 기준일을 넘긴다', () => {
    expect(toDrilldownParams(EMPTY_FILTERS, '2026-08-24').toString()).toBe('baseDate=2026-08-24');
  });

  it('아직 응답이 없으면 날짜를 지어내지 않는다', () => {
    expect(toDrilldownParams(EMPTY_FILTERS, null).toString()).toBe('');
  });
});

describe('기간 계산', () => {
  it('공장 시각(UTC+7)의 오늘 — 한국 자정 직후에도 공장은 전날', () => {
    expect(plantToday(new Date('2026-10-16T16:30:00Z'))).toBe('2026-10-16');
    expect(plantToday(new Date('2026-10-16T17:30:00Z'))).toBe('2026-10-17');
  });

  it('빠른 선택 — 오늘 · 어제 · 최근 7일 · 이번 달', () => {
    expect(quickPeriodOf('today', '2026-10-16')).toEqual(['2026-10-16', '2026-10-16']);
    expect(quickPeriodOf('yesterday', '2026-10-01')).toEqual(['2026-09-30', '2026-09-30']);
    expect(quickPeriodOf('last7', '2026-10-16')).toEqual(['2026-10-10', '2026-10-16']);
    expect(quickPeriodOf('thisMonth', '2026-10-16')).toEqual(['2026-10-01', '2026-10-16']);
  });

  it(`고를 수 없는 기간 — 순서 · 미래 · ${String(MAX_PERIOD_DAYS)}일 초과`, () => {
    expect(periodProblemOf('2026-10-16', '2026-10-10', '2026-10-16')).toBe('order');
    expect(periodProblemOf('2026-10-10', '2026-10-17', '2026-10-16')).toBe('future');
    expect(periodProblemOf('2026-07-16', '2026-10-16', '2026-10-16')).toBe('tooLong');
    expect(periodProblemOf('2026-07-17', '2026-10-16', '2026-10-16')).toBeNull();
  });

  it('하루인가 · 자동 갱신을 걸 것인가(끝이 오늘이거나 비었을 때만)', () => {
    expect(isSingleDay(EMPTY_FILTERS)).toBe(true);
    expect(isSingleDay({ dateFrom: '2026-10-16', dateTo: '2026-10-16', plant: '' })).toBe(true);
    expect(isSingleDay({ dateFrom: '2026-10-10', dateTo: '2026-10-16', plant: '' })).toBe(false);
    expect(isLivePeriod(EMPTY_FILTERS, '2026-10-16')).toBe(true);
    expect(
      isLivePeriod({ dateFrom: '2026-10-10', dateTo: '2026-10-16', plant: '' }, '2026-10-16'),
    ).toBe(true);
    expect(
      isLivePeriod({ dateFrom: '2026-10-10', dateTo: '2026-10-15', plant: '' }, '2026-10-16'),
    ).toBe(false);
  });
});
