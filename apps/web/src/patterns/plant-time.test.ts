import { describe, expect, it } from 'vitest';

import {
  PLANT_TIME_ZONE,
  formatPlantClock,
  formatPlantDateTime,
  plantToday,
  toPlantDateTimeParts,
} from './plant-time';

/*
 * ⭐ 결과는 실행 환경의 TZ 와 무관해야 한다 — 변환 기준이 `PLANT_TIME_ZONE` 고정값이기 때문이다.
 * (TZ=UTC · TZ=Asia/Seoul 두 가지로 돌려 확인한다.)
 */
describe('toPlantDateTimeParts — 공장 시각(Asia/Ho_Chi_Minh) 표시', () => {
  it('기준 시간대는 베트남이다', () => {
    expect(PLANT_TIME_ZONE).toBe('Asia/Ho_Chi_Minh');
  });

  it('UTC(Z) 값을 공장 시각으로 바꾼다 — 7시간 이르게 찍히지 않는다(#20)', () => {
    expect(formatPlantDateTime('2026-09-18T14:07:31.145Z')).toBe('2026-09-18 21:07');
  });

  it('+07:00 값은 그대로 같은 시각이다', () => {
    expect(formatPlantDateTime('2026-09-18T21:07:31+07:00')).toBe('2026-09-18 21:07');
  });

  it('다른 offset(+09:00)도 같은 순간이면 같은 공장 시각이다', () => {
    expect(formatPlantDateTime('2026-09-18T23:07:31+09:00')).toBe('2026-09-18 21:07');
  });

  it('자정을 넘기면 날짜도 넘어간다 — 18:30Z 는 다음날 01:30', () => {
    expect(toPlantDateTimeParts('2026-09-18T18:30:00Z')).toEqual({
      date: '2026-09-19',
      time: '01:30',
    });
  });

  it('offset 이 없는 값은 벽시계 시각으로 보고 글자를 그대로 쓴다', () => {
    expect(formatPlantDateTime('2026-09-18T09:10')).toBe('2026-09-18 09:10');
  });

  it('⛔ 날짜만 있는 값은 다루지 않는다 — 시간대를 적용하면 하루가 밀린다', () => {
    expect(toPlantDateTimeParts('2026-09-18')).toBeNull();
  });

  it('형식이 아니거나 읽을 수 없는 값은 null — 부르는 쪽이 기존 표시를 쓴다', () => {
    expect(toPlantDateTimeParts('어제')).toBeNull();
    expect(toPlantDateTimeParts('')).toBeNull();
    expect(toPlantDateTimeParts(null)).toBeNull();
    expect(toPlantDateTimeParts(undefined)).toBeNull();
    expect(toPlantDateTimeParts('2026-13-45T25:99:00Z')).toBeNull();
  });
});

describe('plantToday', () => {
  it('공장 날짜다 — UTC 로 아직 전날이어도 베트남 아침이면 그날이다', () => {
    expect(plantToday(new Date('2026-10-19T18:30:00Z'))).toBe('2026-10-20');
    expect(plantToday(new Date('2026-10-19T16:30:00Z'))).toBe('2026-10-19');
  });
});

describe('formatPlantClock', () => {
  it('공장 시각의 시:분:초다 — 자정 넘은 시각도 24시가 아니라 00시로', () => {
    expect(formatPlantClock(new Date('2026-10-27T03:04:05Z'))).toBe('10:04:05');
    expect(formatPlantClock(new Date('2026-10-26T17:00:09Z'))).toBe('00:00:09');
  });
});
