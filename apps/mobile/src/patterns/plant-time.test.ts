import { describe, expect, it } from 'vitest';

import { plantClock, plantDateTime, plantShortDateTime, plantToday } from './plant-time';

describe('PDA 공장 시각', () => {
  it('UTC 로 온 시각을 기기 시간대가 아니라 공장 시각(UTC+7)으로 그린다', () => {
    expect(plantClock('2026-11-11T01:05:00Z')).toBe('08:05');
    expect(plantShortDateTime('2026-11-10T17:00:00Z')).toBe('11-11 00:00');
    expect(plantDateTime('2026-11-10T17:00:00Z')).toBe('2026-11-11 00:00');
  });

  it('공장 날짜가 바뀐 뒤면 업무일자도 공장 날짜다', () => {
    expect(plantToday(new Date('2026-11-11T18:30:00Z'))).toBe('2026-11-12');
  });

  it('읽지 못하는 값은 지어내지 않는다', () => {
    expect(plantClock(null)).toBe('');
    expect(plantShortDateTime('아님')).toBe('아님');
    expect(plantDateTime(null)).toBe('');
  });
});
