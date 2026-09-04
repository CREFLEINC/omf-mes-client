import { messages } from '@omf-mes/i18n';
import { describe, expect, it } from 'vitest';

import {
  levelLabel,
  resolutionSummary,
  stepNote,
  type WorkCalendarEffectiveResponse,
} from './effective-resolution';

const t = messages.workCalendar.effective;

const effective = (
  overrides: Partial<WorkCalendarEffectiveResponse> = {},
): WorkCalendarEffectiveResponse => ({
  equipmentId: 3001,
  equipmentName: '프레스 1호기',
  steps: [],
  ...overrides,
});

describe('resolutionSummary', () => {
  it('따르는 캘린더와 정해진 층을 말한다', () => {
    expect(
      resolutionSummary(
        effective({ calendarCode: 'CAL-A', resolvedFromLevelCode: 'PLANT' }),
        levelLabel,
      ),
    ).toBe(t.follows('CAL-A', t.levels.plant));
  });

  /*
   * ⛔ **어느 층에도 지정이 없으면 「없다」**(계약). 「모른다」와 다른 사실이라 다른 말로 그린다.
   */
  it.each([undefined, null, ''])('캘린더 코드가 %s 면 따르는 것이 없다고 말한다', (code) => {
    expect(resolutionSummary(effective({ calendarCode: code }), levelLabel)).toBe(t.none);
  });

  /* ⛔ 정해졌는데 층을 모르면 층을 지어내지 않는다(G-9). */
  it.each([undefined, null])('층이 %s 면 층을 모른다고 말한다', (level) => {
    expect(
      resolutionSummary(
        effective({ calendarCode: 'CAL-A', resolvedFromLevelCode: level }),
        levelLabel,
      ),
    ).toBe(t.unknownLevel);
  });

  it('세 갈래가 서로 다른 말이다', () => {
    const said = [
      resolutionSummary(
        effective({ calendarCode: 'CAL-A', resolvedFromLevelCode: 'PLANT' }),
        levelLabel,
      ),
      resolutionSummary(effective(), levelLabel),
      resolutionSummary(effective({ calendarCode: 'CAL-A' }), levelLabel),
    ];

    expect(new Set(said).size).toBe(3);
  });
});

describe('levelLabel', () => {
  it('두 층을 사람 이름으로 푼다', () => {
    expect(levelLabel('PLANT')).toBe(t.levels.plant);
    expect(levelLabel('EQUIPMENT_GROUP')).toBe(t.levels.equipmentGroup);
  });

  /* ⛔ 모르는 층의 이름을 지어내지 않는다. */
  it('모르는 층은 코드를 그대로 보인다', () => {
    expect(levelLabel('SITE')).toBe('SITE');
  });
});

describe('stepNote', () => {
  /* ⭐ 지정이 있는 첫 층에서 멈춘다 — 그 층을 표시해야 「왜 이 캘린더인가」가 보인다. */
  it('그 층에 지정이 있는지 말한다', () => {
    expect(
      stepNote({ levelCode: 'PLANT', targetId: 11, targetName: '제1공장', hasApplication: true }),
    ).toBe(t.hasApplication);
    expect(
      stepNote({ levelCode: 'PLANT', targetId: 11, targetName: '제1공장', hasApplication: false }),
    ).toBe(t.noApplication);
  });
});
