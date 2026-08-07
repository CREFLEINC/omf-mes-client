import { describe, expect, it } from 'vitest';

import { DEFAULT_PERIOD_DAYS, defaultPeriod, toPeriodQuery, validatePeriod } from './period';

describe('validatePeriod', () => {
  it('두 날짜가 갖춰지면 조회할 수 있다', () => {
    expect(validatePeriod({ from: '2026-08-01', to: '2026-08-07' })).toBeNull();
  });

  it('같은 날도 조회할 수 있다 — 하루치 조회를 막지 않는다', () => {
    expect(validatePeriod({ from: '2026-08-07', to: '2026-08-07' })).toBeNull();
  });

  it('한쪽이라도 비면 사유를 낸다', () => {
    expect(validatePeriod({ from: '', to: '2026-08-07' })).toContain('기간');
    expect(validatePeriod({ from: '2026-08-01', to: '' })).toContain('기간');
    expect(validatePeriod({ from: '', to: '' })).toContain('기간');
  });

  it('형식이 깨진 값은 비어 있는 것과 같이 다룬다 — 보내면 서버가 400으로 거부한다', () => {
    expect(validatePeriod({ from: '2026-8-1', to: '2026-08-07' })).not.toBeNull();
    expect(validatePeriod({ from: '어제', to: '2026-08-07' })).not.toBeNull();
  });

  it('기간이 역전되면 비었을 때와 다른 사유를 낸다', () => {
    const reversed = validatePeriod({ from: '2026-08-07', to: '2026-08-01' });
    const empty = validatePeriod({ from: '', to: '' });

    expect(reversed).not.toBeNull();
    expect(reversed).not.toBe(empty);
  });
});

describe('toPeriodQuery', () => {
  /*
   * 오프셋을 고정값으로 넣는다 — 실행 환경의 시간대를 읽으면 이 테스트가
   * 변환 규칙이 아니라 실행 환경을 검사하게 된다.
   */
  it('시작은 그날 00:00:00이고 종료는 그날 23:59:59다', () => {
    expect(toPeriodQuery({ from: '2026-08-01', to: '2026-08-07' }, 540)).toEqual({
      occurredFrom: '2026-08-01T00:00:00+09:00',
      occurredTo: '2026-08-07T23:59:59+09:00',
    });
  });

  it('종료를 00:00:00으로 만들지 않는다 — 마지막 날에 생긴 이력이 통째로 빠진다', () => {
    expect(toPeriodQuery({ from: '2026-08-01', to: '2026-08-07' }, 540).occurredTo).toContain(
      'T23:59:59',
    );
  });

  it('음수 오프셋은 부호와 자릿수를 갖춰 적는다', () => {
    expect(toPeriodQuery({ from: '2026-08-01', to: '2026-08-07' }, -300)).toEqual({
      occurredFrom: '2026-08-01T00:00:00-05:00',
      occurredTo: '2026-08-07T23:59:59-05:00',
    });
  });

  it('30분 단위 오프셋도 분을 그대로 적는다', () => {
    expect(toPeriodQuery({ from: '2026-08-01', to: '2026-08-01' }, 330).occurredFrom).toBe(
      '2026-08-01T00:00:00+05:30',
    );
  });

  it('오프셋이 0이면 +00:00으로 적는다 — 시간대 표기를 빼면 서버가 400으로 거부한다', () => {
    expect(toPeriodQuery({ from: '2026-08-01', to: '2026-08-01' }, 0).occurredFrom).toBe(
      '2026-08-01T00:00:00+00:00',
    );
  });

  it('초를 빼지 않는다 — 초가 없으면 서버가 400으로 거부한다', () => {
    const query = toPeriodQuery({ from: '2026-08-01', to: '2026-08-07' }, 540);

    expect(query.occurredFrom).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2}$/);
    expect(query.occurredTo).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2}$/);
  });
});

describe('defaultPeriod', () => {
  it('오늘을 마지막 날로 두고 오늘을 포함해 센다', () => {
    expect(defaultPeriod(new Date(2026, 7, 7))).toEqual({ from: '2026-08-01', to: '2026-08-07' });
    expect(DEFAULT_PERIOD_DAYS).toBe(7);
  });

  it('달 경계를 넘어간다', () => {
    expect(defaultPeriod(new Date(2026, 7, 3))).toEqual({ from: '2026-07-28', to: '2026-08-03' });
  });

  it('해 경계를 넘어간다', () => {
    expect(defaultPeriod(new Date(2026, 0, 2))).toEqual({ from: '2025-12-27', to: '2026-01-02' });
  });

  it('한 자리 달·일에 0을 채운다 — 서버가 자릿수 고정 형식을 요구한다', () => {
    expect(defaultPeriod(new Date(2026, 2, 9)).to).toBe('2026-03-09');
  });
});
