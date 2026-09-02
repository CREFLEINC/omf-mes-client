import { messages } from '@omf-mes/i18n';
import { describe, expect, it } from 'vitest';

import {
  DEFAULT_PERIOD_DAYS,
  defaultPeriod,
  periodLockReason,
  type PeriodInput,
  resolvePeriod,
  WIDE_PERIOD_DAYS,
} from './period';

const t = messages.workOrderProgress.filters;
const KST = 540;

const period = (from: string, to: string): PeriodInput => ({ from, to });

const boundsOf = (from: string, to: string, offset = KST) => {
  const state = resolvePeriod(period(from, to), offset);
  if (state.kind !== 'ready') throw new Error(`막혔다: ${state.reason}`);
  return state;
};

describe('defaultPeriod', () => {
  it('오늘을 마지막 날로 두고 한 달치를 고른다 — 오늘을 포함해 센다', () => {
    expect(defaultPeriod(new Date(2026, 7, 30))).toEqual({ from: '2026-08-01', to: '2026-08-30' });
  });

  it('달 경계를 넘어간다', () => {
    expect(defaultPeriod(new Date(2026, 8, 5))).toEqual({ from: '2026-08-07', to: '2026-09-05' });
  });

  it('기본값이 곧바로 조회된다 — 들어오자마자 막혀 있지 않다', () => {
    expect(periodLockReason(defaultPeriod(new Date(2026, 7, 30)))).toBeNull();
  });

  it(`기본 기간이 ${String(DEFAULT_PERIOD_DAYS)}일이다`, () => {
    const { from, to } = defaultPeriod(new Date(2026, 7, 30));
    const span = (Date.parse(to) - Date.parse(from)) / (24 * 60 * 60 * 1000) + 1;

    expect(span).toBe(DEFAULT_PERIOD_DAYS);
  });
});

describe('resolvePeriod — 막는 자리', () => {
  it.each([
    ['둘 다 빔', '', ''],
    ['시작만 빔', '', '2026-08-30'],
    ['종료만 빔', '2026-08-01', ''],
  ])('⛔ %s 이면 채우라고 말한다 — 기간은 비울 수 없다', (_name, from, to) => {
    expect(periodLockReason(period(from, to))).toBe(t.periodRequired);
  });

  it.each([
    ['달력에 없는 날', '2026-02-31', '2026-03-05'],
    ['모양이 틀림', '2026-8-1', '2026-08-30'],
    ['월 범위 밖', '2026-13-01', '2026-13-05'],
  ])('⛔ %s 이면 다시 고르라고 말한다', (_name, from, to) => {
    expect(periodLockReason(period(from, to))).toBe(t.periodInvalid);
  });

  it('⛔ 역순이면 바꾸라고 말한다', () => {
    expect(periodLockReason(period('2026-08-30', '2026-08-01'))).toBe(t.periodReversed);
  });

  /*
   * ⛔ 세 사유의 해법이 서로 다르다. 없는 날짜를 「두 날짜를 바꾸세요」로 안내하면 바꿔도
   * 풀리지 않는다 — 순서가 뜻을 갖는다.
   */
  it('⛔ 비어 있으면서 역순으로 보이는 값도 「채우세요」가 먼저다', () => {
    expect(periodLockReason(period('', '2026-08-01'))).toBe(t.periodRequired);
  });

  it('⛔ 없는 날짜가 역순이어도 「다시 고르세요」가 먼저다', () => {
    expect(periodLockReason(period('2026-02-31', '2026-01-01'))).toBe(t.periodInvalid);
  });

  it('세 사유가 서로 다른 문구다 — 무엇을 해야 하는지 갈린다', () => {
    expect(new Set([t.periodRequired, t.periodInvalid, t.periodReversed]).size).toBe(3);
  });
});

describe('resolvePeriod — 보내는 값', () => {
  it('시작은 그날 0시다', () => {
    expect(boundsOf('2026-08-01', '2026-08-30').bounds.from).toBe('2026-08-01T00:00:00+09:00');
  });

  /*
   * ⛔ **L-3-1 반열림.** 「8월 30일까지」를 `23:59:59`로 닫으면 `23:59:59.5`가 어느 경계로
   * 잘라도 빠진다. 익일 0시를 보내야 그날이 온전히 들어온다.
   */
  it('⛔ 끝은 «익일» 0시다 — 23:59:59로 닫지 않는다', () => {
    const { bounds } = boundsOf('2026-08-01', '2026-08-30');

    expect(bounds.to).toBe('2026-08-31T00:00:00+09:00');
    expect(bounds.to).not.toContain('23:59:59');
  });

  it('끝이 달 경계를 넘어간다', () => {
    expect(boundsOf('2026-08-01', '2026-08-31').bounds.to).toBe('2026-09-01T00:00:00+09:00');
  });

  it('끝이 해 경계를 넘어간다', () => {
    expect(boundsOf('2026-12-01', '2026-12-31').bounds.to).toBe('2027-01-01T00:00:00+09:00');
  });

  it('윤년 2월 29일을 넘긴다', () => {
    expect(boundsOf('2028-02-01', '2028-02-29').bounds.to).toBe('2028-03-01T00:00:00+09:00');
  });

  it('하루만 고르면 그날 0시부터 익일 0시까지다', () => {
    const { bounds } = boundsOf('2026-08-05', '2026-08-05');

    expect(bounds).toEqual({ from: '2026-08-05T00:00:00+09:00', to: '2026-08-06T00:00:00+09:00' });
  });

  it.each([
    ['한국', 540, '+09:00'],
    ['베트남', 420, '+07:00'],
    ['UTC', 0, '+00:00'],
    ['서쪽', -300, '-05:00'],
  ])('%s 시간대를 두 끝에 함께 찍는다', (_name, offset, zone) => {
    const { bounds } = boundsOf('2026-08-01', '2026-08-30', offset);

    expect(bounds.from.endsWith(zone)).toBe(true);
    expect(bounds.to.endsWith(zone)).toBe(true);
  });
});

describe('resolvePeriod — 넓은 기간', () => {
  /*
   * ⛔ **막지 않는다.** 넓게 봐야 하는 일이 실제로 있다. 느려질 수 있다는 사실만 미리 알린다 —
   * 예고이지 금지가 아니다.
   */
  it('⛔ 3개월을 넘겨도 조회를 막지 않는다', () => {
    expect(periodLockReason(period('2026-01-01', '2026-12-31'))).toBeNull();
  });

  it('넘기면 느릴 수 있다고 미리 알린다', () => {
    expect(boundsOf('2026-01-01', '2026-12-31').warning).toBe(t.periodWide);
  });

  it('넘지 않으면 아무 말도 하지 않는다 — 늘 뜨는 경고는 읽히지 않는다', () => {
    expect(boundsOf('2026-08-01', '2026-08-30').warning).toBeNull();
  });

  it(`경계가 ${String(WIDE_PERIOD_DAYS)}일이다 — 딱 그만큼은 조용하고 하루 더는 알린다`, () => {
    const start = new Date(2026, 0, 1);
    const at = (days: number): string => {
      const end = new Date(2026, 0, 1 + days - 1);
      return `${String(end.getFullYear())}-${String(end.getMonth() + 1).padStart(2, '0')}-${String(end.getDate()).padStart(2, '0')}`;
    };
    const from = `${String(start.getFullYear())}-01-01`;

    expect(boundsOf(from, at(WIDE_PERIOD_DAYS)).warning).toBeNull();
    expect(boundsOf(from, at(WIDE_PERIOD_DAYS + 1)).warning).toBe(t.periodWide);
  });
});
