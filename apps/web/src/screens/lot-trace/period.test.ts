import { describe, expect, it } from 'vitest';

import { defaultPeriod, validatePeriod } from './period';

describe('입출고 현황 기간(계약: 시작 필수, 최대 366일)', () => {
  it('시작이 없으면 시작일을 고르라고 한다', () => {
    expect(validatePeriod({ from: '', to: '2026-10-26' })).toBe('기간 시작일을 고르세요');
  });

  it('종료가 비면 서버가 정한다 — 시작만으로 조회할 수 있다', () => {
    expect(validatePeriod({ from: '2026-10-01', to: '' })).toBeNull();
  });

  it('종료일 형식이 틀리면 시작일이 아니라 형식을 말한다', () => {
    expect(validatePeriod({ from: '2026-10-01', to: '2026-1-5' })).toBe(
      '기간 날짜 형식이 맞지 않습니다. 달력에서 다시 고르세요',
    );
  });

  it('종료가 시작보다 앞서면 막는다', () => {
    expect(validatePeriod({ from: '2026-10-26', to: '2026-10-01' })).toBe(
      '기간 종료일이 시작일보다 앞섭니다',
    );
  });

  it('양 끝을 포함해 366일까지 받고 367일은 막는다', () => {
    expect(validatePeriod({ from: '2025-10-26', to: '2026-10-26' })).toBeNull();
    expect(validatePeriod({ from: '2025-10-25', to: '2026-10-26' })).toBe(
      '기간은 366일까지 조회할 수 있습니다',
    );
  });

  it('기본은 공장 날짜 오늘을 끝으로 7일이다(월 넘김 포함)', () => {
    expect(defaultPeriod('2026-11-03')).toEqual({ from: '2026-10-28', to: '2026-11-03' });
  });
});
