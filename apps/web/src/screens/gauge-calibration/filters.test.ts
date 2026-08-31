import { describe, expect, it } from 'vitest';

import {
  EMPTY_FILTERS,
  isCalendarDate,
  periodLockReason,
  readFilters,
  readPage,
  toListQuery,
  toSearchParams,
} from './filters';

const params = (search: string): URLSearchParams => new URLSearchParams(search);

describe('isCalendarDate', () => {
  it('달력에 없는 날을 거른다 — 형태만 맞는 값이 통과하면 서버가 400을 낸다', () => {
    expect(isCalendarDate('2026-02-31')).toBe(false);
    expect(isCalendarDate('2026-13-01')).toBe(false);
    expect(isCalendarDate('2024-02-29')).toBe(true);
    expect(isCalendarDate('2026-02-29')).toBe(false);
  });
});

describe('readFilters', () => {
  it('주소의 값을 그대로 읽는다', () => {
    expect(
      readFilters(params('equipment=8101&type=CALIBRATION&from=2026-08-01&to=2026-08-18')),
    ).toEqual({
      equipment: '8101',
      historyType: 'CALIBRATION',
      from: '2026-08-01',
      to: '2026-08-18',
    });
  });

  it('달력에 없는 날은 조건이 아니다', () => {
    expect(readFilters(params('from=2026-02-31')).from).toBe('');
  });

  it('양의 정수가 아닌 계측기 번호는 조건이 아니다', () => {
    expect(readFilters(params('equipment=0')).equipment).toBe('');
    expect(readFilters(params('equipment=abc')).equipment).toBe('');
  });

  /** 유형 코드는 값 목록이 확정되지 않아 형태를 검사할 수 없다 — 다듬기만 한다. */
  it('유형 코드는 공백만 다듬는다', () => {
    expect(readFilters(params('type=%20%20')).historyType).toBe('');
    expect(readFilters(params('type=SYN_UNKNOWN')).historyType).toBe('SYN_UNKNOWN');
  });
});

describe('readPage', () => {
  it('없거나 이상하면 첫 쪽이다', () => {
    expect(readPage(params(''))).toBe(1);
    expect(readPage(params('page=0'))).toBe(1);
    expect(readPage(params('page=-2'))).toBe(1);
  });

  it('있으면 그 쪽이다', () => {
    expect(readPage(params('page=3'))).toBe(3);
  });
});

describe('periodLockReason', () => {
  /** 기간이 선택이라 「비었다」는 막지 않는다 — 「이 계측기의 전부」가 정상 조회다. */
  it('비어 있으면 막지 않는다', () => {
    expect(periodLockReason(EMPTY_FILTERS)).toBeNull();
  });

  it('한쪽만 채워도 막지 않는다 — 계약이 두 칸을 각각 선택으로 두었다', () => {
    expect(periodLockReason({ ...EMPTY_FILTERS, from: '2026-08-01' })).toBeNull();
  });

  it('뒤집힌 기간을 막는다', () => {
    expect(periodLockReason({ ...EMPTY_FILTERS, from: '2026-08-18', to: '2026-08-01' })).toContain(
      '앞섭니다',
    );
  });
});

describe('toSearchParams · toListQuery', () => {
  it('첫 쪽은 주소에 싣지 않는다', () => {
    expect(toSearchParams(EMPTY_FILTERS, 1).toString()).toBe('');
    expect(toSearchParams(EMPTY_FILTERS, 3).get('page')).toBe('3');
  });

  it('읽기와 쓰기가 서로를 되돌린다', () => {
    const filters = {
      equipment: '8101',
      historyType: 'CALIBRATION',
      from: '2026-08-01',
      to: '2026-08-18',
    };
    const written = toSearchParams(filters, 2);

    expect(readFilters(written)).toEqual(filters);
    expect(readPage(written)).toBe(2);
  });

  it('빈 조건은 요청 질의에 키 자체를 싣지 않는다', () => {
    expect(toListQuery(EMPTY_FILTERS, 1)).toEqual({});
  });

  it('계측기 번호를 수로 옮긴다 — 계약이 정수를 요구한다', () => {
    expect(toListQuery({ ...EMPTY_FILTERS, equipment: '8101' }, 1)).toEqual({ equipmentId: 8101 });
  });
});
