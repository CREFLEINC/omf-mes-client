import { messages } from '@omf-mes/i18n';
import { describe, expect, it } from 'vitest';

import {
  DEFAULT_PERIOD_DAYS,
  defaultPeriod,
  isPeriodDate,
  periodLockReason,
  toPeriodBounds,
} from './period';

const KST = 540;
const periodRequired = messages.dispositionDecision.values.periodRequired;

describe('isPeriodDate', () => {
  it('달력에 있는 날만 통과시킨다', () => {
    expect(isPeriodDate('2026-02-28')).toBe(true);
    expect(isPeriodDate('2026-02-31')).toBe(false);
  });

  it('형태가 다르면 날이 아니다', () => {
    expect(isPeriodDate('2026-2-1')).toBe(false);
    expect(isPeriodDate('')).toBe(false);
  });

  it('윤년의 2월 29일을 받는다', () => {
    expect(isPeriodDate('2028-02-29')).toBe(true);
    expect(isPeriodDate('2026-02-29')).toBe(false);
  });
});

describe('periodLockReason', () => {
  it('한쪽이라도 비면 조회를 막는다 — 기간은 필수다(L-3)', () => {
    expect(periodLockReason({ from: '', to: '2026-08-12' })).toBe(periodRequired);
    expect(periodLockReason({ from: '2026-08-12', to: '' })).toBe(periodRequired);
  });

  it('날이 아닌 값은 막는다', () => {
    expect(periodLockReason({ from: '2026-02-31', to: '2026-08-12' })).toBe(periodRequired);
  });

  it('시작이 끝보다 뒤면 막는다', () => {
    expect(periodLockReason({ from: '2026-08-13', to: '2026-08-12' })).toBe(periodRequired);
  });

  it('같은 날 하루짜리 기간은 통과한다', () => {
    expect(periodLockReason({ from: '2026-08-12', to: '2026-08-12' })).toBeNull();
  });

  it('올바른 기간은 막지 않는다', () => {
    expect(periodLockReason({ from: '2026-07-14', to: '2026-08-12' })).toBeNull();
  });
});

describe('defaultPeriod', () => {
  it('오늘을 포함해 최근 한 달을 고른다', () => {
    expect(defaultPeriod(new Date(2026, 7, 12))).toEqual({ from: '2026-07-14', to: '2026-08-12' });
  });

  it('달 경계를 넘어간다', () => {
    expect(defaultPeriod(new Date(2026, 0, 5))).toEqual({ from: '2025-12-07', to: '2026-01-05' });
  });

  it('고른 기간의 길이가 규정한 날수와 같다', () => {
    const { from, to } = defaultPeriod(new Date(2026, 7, 12));
    const days = (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000;

    expect(days + 1).toBe(DEFAULT_PERIOD_DAYS);
  });
});

describe('toPeriodBounds', () => {
  it('끝을 익일 00:00으로 보낸다 — 반열림이다(L-3-1)', () => {
    expect(toPeriodBounds({ from: '2026-07-14', to: '2026-08-12' }, KST)).toEqual({
      from: '2026-07-14T00:00:00+09:00',
      to: '2026-08-13T00:00:00+09:00',
    });
  });

  it('⛔ 끝을 23:59:59로 닫지 않는다 — 그 초의 소수점 이하가 빠진다', () => {
    expect(toPeriodBounds({ from: '2026-08-12', to: '2026-08-12' }, KST).to).not.toContain(
      '23:59:59',
    );
  });

  it('달의 마지막 날은 다음 달 1일로 넘어간다', () => {
    expect(toPeriodBounds({ from: '2026-08-01', to: '2026-08-31' }, KST).to).toBe(
      '2026-09-01T00:00:00+09:00',
    );
  });

  it('해의 마지막 날은 다음 해 1월 1일로 넘어간다', () => {
    expect(toPeriodBounds({ from: '2026-12-31', to: '2026-12-31' }, KST).to).toBe(
      '2027-01-01T00:00:00+09:00',
    );
  });

  it('UTC 서쪽 시간대는 음수 오프셋으로 적는다', () => {
    expect(toPeriodBounds({ from: '2026-08-12', to: '2026-08-12' }, -300)).toEqual({
      from: '2026-08-12T00:00:00-05:00',
      to: '2026-08-13T00:00:00-05:00',
    });
  });

  it('UTC는 +00:00으로 적는다', () => {
    expect(toPeriodBounds({ from: '2026-08-12', to: '2026-08-12' }, 0).from).toBe(
      '2026-08-12T00:00:00+00:00',
    );
  });

  it('30분 단위 시간대도 분까지 적는다', () => {
    expect(toPeriodBounds({ from: '2026-08-12', to: '2026-08-12' }, 330).from).toBe(
      '2026-08-12T00:00:00+05:30',
    );
  });
});
