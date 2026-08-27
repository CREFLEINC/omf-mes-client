import { messages } from '@omf-mes/i18n';
import { describe, expect, it } from 'vitest';

import {
  DEFAULT_PERIOD_DAYS,
  defaultPeriod,
  isPeriodDate,
  periodLockReason,
  resolvePeriod,
  type PeriodState,
} from './period';

const KST = 540;
const t = messages.dispositionDecision.values;

const boundsOf = (state: PeriodState): { from: string; to: string } => {
  if (state.kind !== 'ready') throw new Error(`막힌 기간이다: ${state.reason}`);
  return state.bounds;
};

describe('isPeriodDate', () => {
  it('달력에 있는 날만 통과시킨다', () => {
    expect(isPeriodDate('2026-02-28')).toBe(true);
    expect(isPeriodDate('2026-02-31')).toBe(false);
  });

  it('형태가 다르면 날이 아니다', () => {
    expect(isPeriodDate('2026-2-1')).toBe(false);
    expect(isPeriodDate('')).toBe(false);
    expect(isPeriodDate('아무 글자')).toBe(false);
  });

  it('윤년의 2월 29일을 받는다', () => {
    expect(isPeriodDate('2028-02-29')).toBe(true);
    expect(isPeriodDate('2026-02-29')).toBe(false);
  });
});

describe('resolvePeriod — 막는 사유', () => {
  it('한쪽이라도 비면 「기간을 고르라」고 한다(L-3)', () => {
    expect(resolvePeriod({ from: '', to: '2026-08-12' }, KST)).toEqual({
      kind: 'blocked',
      reason: t.periodRequired,
    });
    expect(resolvePeriod({ from: '2026-08-12', to: '' }, KST)).toEqual({
      kind: 'blocked',
      reason: t.periodRequired,
    });
  });

  it('⭐ 달력에 없는 날은 「없는 날짜」라고 한다 — 「기간을 고르라」가 아니다(G-3)', () => {
    expect(resolvePeriod({ from: '2026-02-31', to: '2026-08-12' }, KST)).toEqual({
      kind: 'blocked',
      reason: t.periodInvalid,
    });
  });

  it('⭐ 시작이 끝보다 뒤면 「두 날짜를 바꾸라」고 한다 — 해법이 다르므로 문구도 다르다', () => {
    expect(resolvePeriod({ from: '2026-08-13', to: '2026-08-12' }, KST)).toEqual({
      kind: 'blocked',
      reason: t.periodReversed,
    });
  });

  it('세 사유가 서로 다른 문구다 — 하나로 뭉치면 무엇을 고쳐야 할지 알 수 없다', () => {
    expect(new Set([t.periodRequired, t.periodInvalid, t.periodReversed]).size).toBe(3);
  });

  it('⛔ 막힌 기간은 서버로 보낼 값을 만들지 않는다', () => {
    expect(resolvePeriod({ from: '2026-02-31', to: '2026-08-12' }, KST)).not.toHaveProperty(
      'bounds',
    );
  });

  it('형태가 틀린 값을 넣어도 접미사만 붙은 값이 새어 나가지 않는다', () => {
    expect(resolvePeriod({ from: '아무 글자', to: '2026-08-12' }, KST).kind).toBe('blocked');
    expect(resolvePeriod({ from: '2026-08-12', to: 'x' }, KST).kind).toBe('blocked');
  });
});

describe('resolvePeriod — 보낼 값', () => {
  it('끝을 익일 00:00으로 보낸다 — 반열림이다(L-3-1)', () => {
    expect(boundsOf(resolvePeriod({ from: '2026-07-14', to: '2026-08-12' }, KST))).toEqual({
      from: '2026-07-14T00:00:00+09:00',
      to: '2026-08-13T00:00:00+09:00',
    });
  });

  it('⛔ 끝을 23:59:59로 닫지 않는다 — 그 초의 소수점 이하가 빠진다', () => {
    expect(boundsOf(resolvePeriod({ from: '2026-08-12', to: '2026-08-12' }, KST)).to).not.toContain(
      '23:59:59',
    );
  });

  it('같은 날 하루짜리 기간은 통과한다', () => {
    expect(boundsOf(resolvePeriod({ from: '2026-08-12', to: '2026-08-12' }, KST)).to).toBe(
      '2026-08-13T00:00:00+09:00',
    );
  });

  it('달의 마지막 날은 다음 달 1일로 넘어간다', () => {
    expect(boundsOf(resolvePeriod({ from: '2026-08-01', to: '2026-08-31' }, KST)).to).toBe(
      '2026-09-01T00:00:00+09:00',
    );
  });

  it('해의 마지막 날은 다음 해 1월 1일로 넘어간다', () => {
    expect(boundsOf(resolvePeriod({ from: '2026-12-31', to: '2026-12-31' }, KST)).to).toBe(
      '2027-01-01T00:00:00+09:00',
    );
  });

  it('윤년의 2월 29일은 3월 1일로 넘어간다', () => {
    expect(boundsOf(resolvePeriod({ from: '2028-02-29', to: '2028-02-29' }, KST)).to).toBe(
      '2028-03-01T00:00:00+09:00',
    );
  });

  it('평년의 2월 28일도 3월 1일로 넘어간다', () => {
    expect(boundsOf(resolvePeriod({ from: '2026-02-28', to: '2026-02-28' }, KST)).to).toBe(
      '2026-03-01T00:00:00+09:00',
    );
  });

  it('UTC 서쪽 시간대는 음수 오프셋으로 적는다', () => {
    expect(boundsOf(resolvePeriod({ from: '2026-08-12', to: '2026-08-12' }, -300))).toEqual({
      from: '2026-08-12T00:00:00-05:00',
      to: '2026-08-13T00:00:00-05:00',
    });
  });

  it('UTC는 +00:00으로 적는다', () => {
    expect(boundsOf(resolvePeriod({ from: '2026-08-12', to: '2026-08-12' }, 0)).from).toBe(
      '2026-08-12T00:00:00+00:00',
    );
  });

  it('30분 단위 시간대도 분까지 적는다', () => {
    expect(boundsOf(resolvePeriod({ from: '2026-08-12', to: '2026-08-12' }, 330)).from).toBe(
      '2026-08-12T00:00:00+05:30',
    );
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

  it('기본 기간은 스스로 막히지 않는다', () => {
    expect(periodLockReason(defaultPeriod(new Date(2026, 7, 12)))).toBeNull();
  });
});

describe('periodLockReason', () => {
  it('막는 사유를 그대로 돌려준다', () => {
    expect(periodLockReason({ from: '', to: '' })).toBe(t.periodRequired);
    expect(periodLockReason({ from: '2026-02-31', to: '2026-08-12' })).toBe(t.periodInvalid);
    expect(periodLockReason({ from: '2026-08-13', to: '2026-08-12' })).toBe(t.periodReversed);
  });

  it('올바른 기간은 막지 않는다', () => {
    expect(periodLockReason({ from: '2026-07-14', to: '2026-08-12' })).toBeNull();
  });
});
