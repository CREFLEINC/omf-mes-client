import { describe, expect, it } from 'vitest';

import { defaultPeriod, isDate, isUsablePeriod, toDateString } from './period';

describe('isDate', () => {
  it('달력에 있는 날만 받는다', () => {
    expect(isDate('2026-09-01')).toBe(true);
    /* ⚠ 모양은 맞지만 없는 날이다 — 정규식만으로는 통과한다. */
    expect(isDate('2026-02-31')).toBe(false);
    expect(isDate('2026-13-01')).toBe(false);
  });

  it('모양이 어긋나면 받지 않는다', () => {
    expect(isDate('')).toBe(false);
    expect(isDate('2026-9-1')).toBe(false);
    expect(isDate('어제')).toBe(false);
  });
});

describe('defaultPeriod', () => {
  it('최근 한 달을 낸다', () => {
    expect(defaultPeriod(new Date(2026, 8, 1))).toEqual({ from: '2026-08-01', to: '2026-09-01' });
  });

  it('기준 날을 밖에서 받는다 — 실행하는 날에 결과가 좌우되지 않는다', () => {
    expect(defaultPeriod(new Date(2026, 0, 15))).toEqual({ from: '2025-12-15', to: '2026-01-15' });
  });
});

describe('toDateString', () => {
  it('한 자리 달·날에 0을 채운다', () => {
    expect(toDateString(new Date(2026, 0, 5))).toBe('2026-01-05');
  });
});

describe('isUsablePeriod', () => {
  it('시작이 끝보다 뒤면 쓸 수 없다 — 그 상태로는 조회하지 않는다', () => {
    expect(isUsablePeriod({ from: '2026-09-02', to: '2026-09-01' })).toBe(false);
  });

  it('같은 날은 쓸 수 있다', () => {
    expect(isUsablePeriod({ from: '2026-09-01', to: '2026-09-01' })).toBe(true);
  });

  it('한쪽이 비면 쓸 수 없다', () => {
    expect(isUsablePeriod({ from: '', to: '2026-09-01' })).toBe(false);
    expect(isUsablePeriod({ from: '2026-09-01', to: '' })).toBe(false);
  });
});
