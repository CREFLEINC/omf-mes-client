import { describe, expect, it } from 'vitest';

import {
  readHistoryFilters,
  toHistoryAppliedSearchParams,
  toHistoryListQuery,
  type HistoryFilters,
} from './history-filters';

const TODAY = new Date(2026, 7, 12);
const KST = 540;
/** ⚠ 지어낸 자리표시다 — 처분 유형의 실제 값 목록은 아직 확정되지 않았다. */
const CODES = ['CODE-A'];

const params = (search: string): URLSearchParams => new URLSearchParams(search);

const filters = (overrides: Partial<HistoryFilters> = {}): HistoryFilters => ({
  from: '2026-07-14',
  to: '2026-08-12',
  dispositionTypeCode: '',
  ...overrides,
});

describe('readHistoryFilters', () => {
  it('기간이 없으면 최근 한 달로 되돌린다', () => {
    expect(readHistoryFilters(params(''), TODAY)).toEqual(filters());
  });

  it('판정 대기 탭과 같은 주소 이름을 읽는다 — 탭을 옮겨도 기간이 유지된다', () => {
    const read = readHistoryFilters(params('from=2026-08-01&to=2026-08-05'), TODAY);

    expect(read.from).toBe('2026-08-01');
    expect(read.to).toBe('2026-08-05');
  });

  it('처분 유형은 아는 값일 때만 읽는다', () => {
    expect(readHistoryFilters(params('disp=CODE-A'), TODAY, CODES).dispositionTypeCode).toBe(
      'CODE-A',
    );
    expect(readHistoryFilters(params('disp=CODE-Z'), TODAY, CODES).dispositionTypeCode).toBe('');
  });

  it('값 목록이 비면 어떤 처분 유형도 읽지 않는다', () => {
    expect(readHistoryFilters(params('disp=CODE-A'), TODAY).dispositionTypeCode).toBe('');
  });

  it('시작이 끝보다 뒤면 기본 기간으로 되돌린다', () => {
    expect(readHistoryFilters(params('from=2026-08-05&to=2026-08-01'), TODAY)).toEqual(filters());
  });
});

describe('toHistoryAppliedSearchParams', () => {
  it('조건을 주소에 싣고 첫 쪽은 생략한다', () => {
    const next = toHistoryAppliedSearchParams(
      params(''),
      filters({ dispositionTypeCode: 'CODE-A' }),
      1,
    );

    expect(next.get('from')).toBe('2026-07-14');
    expect(next.get('disp')).toBe('CODE-A');
    expect(next.get('page')).toBeNull();
  });

  it('빈 처분 유형은 주소에서 지운다', () => {
    expect(
      toHistoryAppliedSearchParams(params('disp=CODE-A'), filters(), 1).get('disp'),
    ).toBeNull();
  });

  it('탭 표시는 건드리지 않는다 — 조회 조건만 바꾼다', () => {
    expect(toHistoryAppliedSearchParams(params('tab=history'), filters(), 1).get('tab')).toBe(
      'history',
    );
  });
});

const queryOf = (
  value: ReturnType<typeof toHistoryListQuery>,
): NonNullable<ReturnType<typeof toHistoryListQuery>> => {
  if (value === null) throw new Error('기간이 막혀 조회 조건을 만들지 못했다');
  return value;
};

describe('toHistoryListQuery', () => {
  it('판정일 기간을 반열림으로 싣는다', () => {
    expect(toHistoryListQuery(filters(), 1, KST)).toEqual({
      decidedFrom: '2026-07-14T00:00:00+09:00',
      decidedTo: '2026-08-13T00:00:00+09:00',
    });
  });

  it('고른 처분 유형과 쪽만 더 싣는다', () => {
    const query = queryOf(toHistoryListQuery(filters({ dispositionTypeCode: 'CODE-A' }), 3, KST));

    expect(query.dispositionTypeCode).toBe('CODE-A');
    expect(query.page).toBe(3);
  });

  it('첫 쪽이면 쪽 번호를 싣지 않는다', () => {
    expect(queryOf(toHistoryListQuery(filters(), 1, KST)).page).toBeUndefined();
  });

  it('⛔ 기간이 막히면 조회 조건을 만들지 않는다', () => {
    expect(toHistoryListQuery(filters({ from: '2026-02-31' }), 1, KST)).toBeNull();
  });
});
