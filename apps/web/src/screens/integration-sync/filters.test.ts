import { describe, expect, it } from 'vitest';

import {
  EMPTY_FILTERS,
  hasAnyFilter,
  readFilters,
  readPage,
  toFilterChips,
  toFilterQuery,
  toSearchParams,
} from './filters';

const PERIOD = { from: '2026-08-01', to: '2026-08-06' };

const params = (search: string): URLSearchParams => new URLSearchParams(search);

describe('readFilters · readPage', () => {
  it('주소에 있는 조건을 그대로 읽는다', () => {
    expect(
      readFilters(
        params('status=FAILED&iface=IF-SAMPLE-A&dir=OUTBOUND&target=SAMPLE_TARGET&retryMin=3'),
      ),
    ).toEqual({
      status: 'FAILED',
      iface: 'IF-SAMPLE-A',
      direction: 'OUTBOUND',
      targetType: 'SAMPLE_TARGET',
      retryMin: '3',
    });
  });

  it('없는 조건은 빈 문자열이다', () => {
    expect(readFilters(params(''))).toEqual(EMPTY_FILTERS);
  });

  it('시도 하한이 정수가 아니면 조건으로 받지 않는다 — 문자열을 보내면 서버가 거부한다', () => {
    expect(readFilters(params('retryMin=abc')).retryMin).toBe('');
    expect(readFilters(params('retryMin=-1')).retryMin).toBe('');
    expect(readFilters(params('retryMin=1.5')).retryMin).toBe('');
    expect(readFilters(params('retryMin=0')).retryMin).toBe('0');
  });

  it('쪽 번호가 없거나 이상하면 첫 쪽으로 본다', () => {
    expect(readPage(params(''))).toBe(1);
    expect(readPage(params('page=0'))).toBe(1);
    expect(readPage(params('page=-2'))).toBe(1);
    expect(readPage(params('page=두쪽'))).toBe(1);
    expect(readPage(params('page=3'))).toBe(3);
  });
});

describe('toSearchParams', () => {
  it('기간은 언제나 싣고 빈 조건은 키 자체를 두지 않는다', () => {
    const next = toSearchParams(PERIOD, EMPTY_FILTERS, 1);

    expect(next.get('from')).toBe('2026-08-01');
    expect(next.get('to')).toBe('2026-08-06');
    expect(next.has('status')).toBe(false);
    expect(next.has('retryMin')).toBe(false);
  });

  it('첫 쪽이면 page 키를 두지 않는다 — 기본값을 주소에 적지 않는다', () => {
    expect(toSearchParams(PERIOD, EMPTY_FILTERS, 1).has('page')).toBe(false);
    expect(toSearchParams(PERIOD, EMPTY_FILTERS, 3).get('page')).toBe('3');
  });

  it('걸린 조건을 주소 키 이름으로 적는다', () => {
    const next = toSearchParams(
      PERIOD,
      {
        status: 'FAILED',
        iface: 'IF-SAMPLE-A',
        direction: 'INBOUND',
        targetType: 'X',
        retryMin: '2',
      },
      1,
    );

    expect(next.get('status')).toBe('FAILED');
    expect(next.get('iface')).toBe('IF-SAMPLE-A');
    expect(next.get('dir')).toBe('INBOUND');
    expect(next.get('target')).toBe('X');
    expect(next.get('retryMin')).toBe('2');
  });

  it('정수가 아닌 시도 하한은 주소에도 남기지 않는다', () => {
    expect(toSearchParams(PERIOD, { ...EMPTY_FILTERS, retryMin: '1.5' }, 1).has('retryMin')).toBe(
      false,
    );
  });
});

describe('toFilterQuery', () => {
  it('빈 조건은 요청에 싣지 않는다 — 요청 URL이 조건을 그대로 드러내야 한다', () => {
    expect(toFilterQuery(EMPTY_FILTERS)).toEqual({});
  });

  it('계약이 쓰는 이름으로 옮기고 시도 하한만 숫자로 보낸다', () => {
    expect(
      toFilterQuery({
        status: 'FAILED',
        iface: 'IF-SAMPLE-A',
        direction: 'OUTBOUND',
        targetType: 'SAMPLE_TARGET',
        retryMin: '3',
      }),
    ).toEqual({
      statusCode: 'FAILED',
      interfaceCode: 'IF-SAMPLE-A',
      directionCode: 'OUTBOUND',
      targetTypeCode: 'SAMPLE_TARGET',
      retryCountMin: 3,
    });
  });

  it('0회 이상은 뜻이 있는 조건이라 그대로 싣는다', () => {
    expect(toFilterQuery({ ...EMPTY_FILTERS, retryMin: '0' })).toEqual({ retryCountMin: 0 });
  });
});

describe('toFilterChips · hasAnyFilter', () => {
  it('걸린 조건마다 칩이 하나씩 나오고 순서가 화면 순서와 같다', () => {
    const chips = toFilterChips({
      status: 'FAILED',
      iface: 'IF-SAMPLE-A',
      direction: 'OUTBOUND',
      targetType: 'SAMPLE_TARGET',
      retryMin: '3',
    });

    expect(chips.map((chip) => chip.key)).toEqual([
      'status',
      'iface',
      'direction',
      'targetType',
      'retryMin',
    ]);
    expect(chips[0]?.label).toBe('상태: FAILED');
    expect(chips[4]?.label).toBe('시도 횟수 하한: 3');
  });

  it('걸리지 않은 조건은 칩을 만들지 않는다', () => {
    expect(toFilterChips(EMPTY_FILTERS)).toEqual([]);
    expect(toFilterChips({ ...EMPTY_FILTERS, status: 'FAILED' })).toHaveLength(1);
  });

  it('칩마다 제거 버튼의 이름이 따로 있다 — 「제거」가 다섯 개면 어느 것인지 알 수 없다', () => {
    const chips = toFilterChips({
      status: 'FAILED',
      iface: 'IF-SAMPLE-A',
      direction: '',
      targetType: '',
      retryMin: '',
    });

    expect(new Set(chips.map((chip) => chip.removeLabel)).size).toBe(2);
  });

  it('조건이 하나라도 걸렸는지 판정한다', () => {
    expect(hasAnyFilter(EMPTY_FILTERS)).toBe(false);
    expect(hasAnyFilter({ ...EMPTY_FILTERS, retryMin: '0' })).toBe(true);
  });
});
