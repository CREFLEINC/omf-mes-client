import { describe, expect, it } from 'vitest';

import { calendarCodeBase, nextCalendarCode } from './calendar-code';

describe('작업 캘린더 — 등록 코드 자동 채움', () => {
  it('공장 코드와 해로 바탕 코드를 만든다', () => {
    expect(calendarCodeBase('PL13', 2026)).toBe('CAL-PL13-2026');
  });

  it('공장을 모르면 해만 쓴다', () => {
    expect(calendarCodeBase(null, 2026)).toBe('CAL-2026');
  });

  it('같은 코드가 없으면 바탕 코드 그대로', () => {
    expect(nextCalendarCode('CAL-PL13-2026', ['CAL-PL11-2026', 'CAL-PL13-2025'])).toBe(
      'CAL-PL13-2026',
    );
  });

  it('바탕 코드가 있으면 -02 를 붙인다', () => {
    expect(nextCalendarCode('CAL-PL13-2026', ['CAL-PL13-2026'])).toBe('CAL-PL13-2026-02');
  });

  it('번호가 붙은 것이 있으면 가장 큰 번호 다음', () => {
    expect(
      nextCalendarCode('CAL-PL13-2026', ['CAL-PL13-2026', 'CAL-PL13-2026-03', 'CAL-PL13-2026-X']),
    ).toBe('CAL-PL13-2026-04');
  });

  it('앞만 같은 다른 코드는 세지 않는다', () => {
    expect(nextCalendarCode('CAL-PL1-2026', ['CAL-PL13-2026', 'XCAL-PL1-2026'])).toBe(
      'CAL-PL1-2026',
    );
  });
});
