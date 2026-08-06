import { messages } from '@omf-mes/i18n';
import { describe, expect, it } from 'vitest';

import { DEFAULT_PERIOD_DAYS, defaultPeriod, toPeriodQuery, validatePeriod } from './period';

const t = messages.integrationSync;

describe('validatePeriod', () => {
  it('두 칸이 다 차 있고 순서가 맞으면 조회할 수 있다', () => {
    expect(validatePeriod({ from: '2026-08-01', to: '2026-08-06' })).toBeNull();
  });

  it('같은 날 하루만 고르는 것도 조회할 수 있다', () => {
    expect(validatePeriod({ from: '2026-08-06', to: '2026-08-06' })).toBeNull();
  });

  it('두 칸이 다 비면 사유를 돌려준다', () => {
    expect(validatePeriod({ from: '', to: '' })).toBe(t.reasons.searchNeedsPeriod);
  });

  it('시작만 비어도 사유를 돌려준다', () => {
    expect(validatePeriod({ from: '', to: '2026-08-06' })).toBe(t.reasons.searchNeedsPeriod);
  });

  it('종료만 비어도 사유를 돌려준다', () => {
    expect(validatePeriod({ from: '2026-08-01', to: '' })).toBe(t.reasons.searchNeedsPeriod);
  });

  it('날짜 형식이 아니면 비어 있는 것과 같이 다룬다 — 형식이 깨진 값을 서버로 보내지 않는다', () => {
    expect(validatePeriod({ from: '2026-8-1', to: '2026-08-06' })).toBe(
      t.reasons.searchNeedsPeriod,
    );
    expect(validatePeriod({ from: '20260801', to: '2026-08-06' })).toBe(
      t.reasons.searchNeedsPeriod,
    );
    expect(validatePeriod({ from: '2026-08-01', to: '오늘' })).toBe(t.reasons.searchNeedsPeriod);
  });

  it('종료가 시작보다 앞서면 역전 사유를 돌려준다', () => {
    expect(validatePeriod({ from: '2026-08-06', to: '2026-08-01' })).toBe(t.reasons.periodReversed);
  });

  it('역전은 해가 바뀌어도 판정된다 — 문자열 앞자리로만 보면 놓친다', () => {
    expect(validatePeriod({ from: '2026-01-02', to: '2025-12-31' })).toBe(t.reasons.periodReversed);
  });
});

describe('toPeriodQuery', () => {
  it('시작은 그날 00:00:00, 종료는 그날 23:59:59로 만든다', () => {
    // 종료를 00:00:00으로 만들면 마지막 날의 건이 통째로 빠진다.
    expect(toPeriodQuery({ from: '2026-08-01', to: '2026-08-06' }, 540)).toEqual({
      createdFrom: '2026-08-01T00:00:00+09:00',
      createdTo: '2026-08-06T23:59:59+09:00',
    });
  });

  it('오프셋 0은 +00:00으로 적는다 — 초와 시간대가 없으면 서버가 거부한다', () => {
    expect(toPeriodQuery({ from: '2026-08-01', to: '2026-08-01' }, 0)).toEqual({
      createdFrom: '2026-08-01T00:00:00+00:00',
      createdTo: '2026-08-01T23:59:59+00:00',
    });
  });

  it('음수 오프셋은 부호를 그대로 낸다', () => {
    expect(toPeriodQuery({ from: '2026-08-01', to: '2026-08-02' }, -300).createdFrom).toBe(
      '2026-08-01T00:00:00-05:00',
    );
  });

  it('30분 단위 오프셋도 분까지 적는다', () => {
    expect(toPeriodQuery({ from: '2026-08-01', to: '2026-08-02' }, 330).createdFrom).toBe(
      '2026-08-01T00:00:00+05:30',
    );
  });
});

describe('defaultPeriod', () => {
  it('오늘을 마지막 날로 두고 오늘 포함 7일을 고른다', () => {
    expect(defaultPeriod(new Date(2026, 7, 6))).toEqual({ from: '2026-07-31', to: '2026-08-06' });
  });

  it('달과 해의 경계를 넘어도 날짜가 맞다', () => {
    expect(defaultPeriod(new Date(2026, 0, 3))).toEqual({ from: '2025-12-28', to: '2026-01-03' });
  });

  it('돌려준 값은 그대로 조회할 수 있다', () => {
    expect(validatePeriod(defaultPeriod(new Date(2026, 7, 6)))).toBeNull();
  });

  it('기본 일수는 상수 한 곳에 있다 — 다른 값이 맞으면 이 상수만 고친다', () => {
    expect(DEFAULT_PERIOD_DAYS).toBe(7);
  });
});
