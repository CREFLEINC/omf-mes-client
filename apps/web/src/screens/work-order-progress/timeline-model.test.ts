import { describe, expect, it } from 'vitest';

import { basisPosition, dayLabel, toTimelineAxis, toTimelineBar } from './timeline-model';

/* 공장 시각(UTC+7)의 08-01 ~ 08-04, 나흘. 하루가 축의 25% 다. */
const DAYS = ['2026-08-01', '2026-08-02', '2026-08-03', '2026-08-04'];
const axis = toTimelineAxis(DAYS);
if (axis === null) throw new Error('축을 만들지 못했습니다.');

const at = (value: string): number => Date.parse(value);

describe('toTimelineAxis', () => {
  /* 표가 계획 시각을 공장 시각으로 적는다 — 축의 날 경계도 같은 시간대여야 막대가 제 날에 놓인다. */
  it('축은 공장 시각의 첫날 0시에서 마지막 날 끝까지다', () => {
    expect(axis.startMs).toBe(at('2026-08-01T00:00:00+07:00'));
    expect(axis.endMs).toBe(at('2026-08-05T00:00:00+07:00'));
  });

  it('날이 없으면 축도 없다', () => {
    expect(toTimelineAxis([])).toBeNull();
  });
});

describe('toTimelineBar', () => {
  const row = (overrides: Partial<Parameters<typeof toTimelineBar>[0]> = {}) => ({
    plannedStartAt: '2026-08-02T00:00:00+07:00',
    plannedEndAt: '2026-08-03T00:00:00+07:00',
    delay: 'onTime' as const,
    ...overrides,
  });
  const BASIS = at('2026-08-03T12:00:00+07:00');

  it('계획 구간을 축 폭에 대한 비율로 놓는다', () => {
    expect(toTimelineBar(row(), axis, BASIS)).toEqual({
      plan: { left: 25, width: 25 },
      late: null,
    });
  });

  /* 같은 순간이면 어느 offset 으로 와도 같은 자리다 — 서버는 UTC 로 보낸다. */
  it('UTC 로 온 시각도 같은 자리에 놓는다', () => {
    const utc = row({
      plannedStartAt: '2026-08-01T17:00:00.000Z',
      plannedEndAt: '2026-08-02T17:00:00.000Z',
    });

    expect(toTimelineBar(utc, axis, BASIS)?.plan).toEqual({ left: 25, width: 25 });
  });

  it('지연이면 계획 종료부터 기준 시각까지를 지연 구간으로 잇는다', () => {
    expect(toTimelineBar(row({ delay: 'delayed' }), axis, BASIS)?.late).toEqual({
      left: 50,
      width: 12.5,
    });
  });

  /* ⛔ 판정은 줄의 것을 따른다 — 끝난 지시는 계획 종료가 지났어도 지연이 아니다. */
  it('⛔ 계획 종료가 지났어도 지연 판정이 아니면 지연 구간을 그리지 않는다', () => {
    expect(toTimelineBar(row({ delay: 'onTime' }), axis, BASIS)?.late).toBeNull();
    expect(toTimelineBar(row({ delay: 'unknown' }), axis, BASIS)?.late).toBeNull();
  });

  it('축 밖으로 나간 부분은 잘라 낸다', () => {
    const long = row({
      plannedStartAt: '2026-07-30T00:00:00+07:00',
      plannedEndAt: '2026-08-09T00:00:00+07:00',
    });

    expect(toTimelineBar(long, axis, BASIS)?.plan).toEqual({ left: 0, width: 100 });
  });

  it('지연 구간도 축 끝에서 멈춘다', () => {
    const late = toTimelineBar(row({ delay: 'delayed' }), axis, at('2026-08-20T00:00:00+07:00'));

    expect(late?.late).toEqual({ left: 50, width: 50 });
  });

  it('계획 종료를 모르면 시작 자리만 표시한다 — 폭이 0 이다', () => {
    expect(toTimelineBar(row({ plannedEndAt: undefined }), axis, BASIS)?.plan).toEqual({
      left: 25,
      width: 0,
    });
  });

  it.each([
    ['계획 시작을 모르면', { plannedStartAt: undefined }],
    ['읽을 수 없는 값이면', { plannedStartAt: '어제' }],
    [
      '계획 구간이 축에 걸리지 않으면',
      { plannedStartAt: '2026-08-10T00:00:00+07:00', plannedEndAt: '2026-08-11T00:00:00+07:00' },
    ],
  ])('⛔ %s 막대가 없다', (_name, overrides) => {
    expect(toTimelineBar(row(overrides), axis, BASIS)).toBeNull();
  });
});

describe('basisPosition', () => {
  it('기준 시각의 자리를 비율로 준다', () => {
    expect(basisPosition(axis, at('2026-08-03T00:00:00+07:00'))).toBe(50);
  });

  /* 지난 기간을 조회하면 「지금」은 축에 없다 — 엉뚱한 자리에 선을 긋지 않는다. */
  it('⛔ 축 밖이면 선을 긋지 않는다', () => {
    expect(basisPosition(axis, at('2026-08-09T00:00:00+07:00'))).toBeNull();
    expect(basisPosition(axis, at('2026-07-09T00:00:00+07:00'))).toBeNull();
  });
});

describe('dayLabel', () => {
  it('해를 빼고 월-일만 적는다', () => {
    expect(dayLabel('2026-08-03')).toBe('08-03');
  });
});
