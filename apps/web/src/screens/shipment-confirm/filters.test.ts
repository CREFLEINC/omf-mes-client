import { describe, expect, it } from 'vitest';

import { defaultFilters, isDate, isUsable, toListQuery, type ConfirmFilters } from './filters';

const TODAY = new Date(2026, 8, 1);

const filters = (overrides: Partial<ConfirmFilters> = {}): ConfirmFilters => ({
  from: '2026-08-01',
  to: '2026-09-01',
  sort: 'elapsed',
  ...overrides,
});

describe('isDate', () => {
  it('달력에 있는 날만 받는다', () => {
    expect(isDate('2026-09-01')).toBe(true);
    /* 모양은 맞지만 없는 날이다 — 정규식만으로는 통과한다. */
    expect(isDate('2026-02-31')).toBe(false);
    expect(isDate('2026-9-1')).toBe(false);
  });
});

describe('defaultFilters', () => {
  /*
   * ⚠ **기본값이 「오늘」이 아니다**(§5-9). 오늘로 시작하면 **적체가 화면에서 사라진다** —
   * 이 화면이 존재하는 이유가 그 적체를 보는 것이다.
   */
  it('⚠ 기본 기간이 오늘 하루가 아니다 — 적체를 보려고 만든 화면이다', () => {
    const applied = defaultFilters(TODAY);

    expect(applied.from).toBe('2026-08-01');
    expect(applied.to).toBe('2026-09-01');
    expect(applied.from).not.toBe(applied.to);
  });

  /*
   * ⚠ **기본 정렬이 최신순이 아니다**(§5-7). 목록의 관행을 따르면 **가장 위험한 건이 마지막
   * 쪽에 숨는다.**
   */
  it('⚠ 기본 정렬이 「경과일 긴 순」이다 — 최신순이 아니다', () => {
    expect(defaultFilters(TODAY).sort).toBe('elapsed');
  });
});

describe('isUsable', () => {
  it('시작이 끝보다 뒤면 쓸 수 없다', () => {
    expect(isUsable(filters({ from: '2026-09-02', to: '2026-09-01' }))).toBe(false);
  });

  it('같은 날은 쓸 수 있다', () => {
    expect(isUsable(filters({ from: '2026-09-01', to: '2026-09-01' }))).toBe(true);
  });

  it('한쪽이 비면 쓸 수 없다', () => {
    expect(isUsable(filters({ from: '' }))).toBe(false);
  });
});

describe('toListQuery', () => {
  /* ⭐ 이 화면은 미확정만 본다 — 확정된 건은 여기서 할 일이 없다(§5-9). */
  it('⭐ 미확정만 서버에 싣는다 — 받아서 거르지 않는다(L-11)', () => {
    expect(toListQuery(filters(), 1)?.unconfirmedOnly).toBe(true);
  });

  it('기간을 언제나 싣는다 — 계약이 필수로 둔다(L-3)', () => {
    const query = toListQuery(filters(), 1);

    expect(query?.shipDateFrom).toBe('2026-08-01');
    expect(query?.shipDateTo).toBe('2026-09-01');
  });

  it('⛔ 기간이 못 쓸 값이면 조회 조건을 만들지 않는다 — 막았는데 요청이 나가지 않게 한다', () => {
    expect(toListQuery(filters({ from: '2026-09-02', to: '2026-09-01' }), 1)).toBeNull();
    expect(toListQuery(filters({ from: '2026-02-31' }), 1)).toBeNull();
  });

  it('정렬 값을 계약이 받는 이름으로 바꾼다', () => {
    expect(toListQuery(filters({ sort: 'elapsed' }), 1)?.sort).toBe('shippedAt,asc');
    expect(toListQuery(filters({ sort: 'shipDate' }), 1)?.sort).toBe('shipDate,desc');
  });

  it('첫 쪽이면 쪽 번호를 싣지 않는다', () => {
    expect(toListQuery(filters(), 1)?.page).toBeUndefined();
    expect(toListQuery(filters(), 2)?.page).toBe(2);
  });
});
