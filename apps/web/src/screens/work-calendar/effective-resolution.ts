import type { components } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';

export type WorkCalendarEffectiveResponse = components['schemas']['WorkCalendarEffectiveResponse'];
export type WorkCalendarResolutionStep = components['schemas']['WorkCalendarResolutionStep'];

const t = messages.workCalendar.effective;

/**
 * 해석 결과 한 줄.
 *
 * ⭐ **화면이 계산하지 않는다** — 서버가 준 값을 옮기기만 한다. 설계 규칙은 「가장 가까운 것이
 * 이긴다」인데, 화면이 그 규칙을 다시 구현하면 서버와 다른 답을 낼 수 있다.
 *
 * ⛔ **세 갈래를 가른다**(공유계약 G-9):
 * 어느 층에도 지정이 없다 · 정해졌고 층도 안다 · 정해졌는데 층을 모른다.
 * 셋을 뭉개면 「없다」와 「모른다」가 같은 화면이 된다.
 */
export const resolutionSummary = (
  effective: WorkCalendarEffectiveResponse,
  levelLabel: (levelCode: string) => string,
): string => {
  const code = effective.calendarCode;

  if (code === null || code === undefined || code.trim() === '') return t.none;

  const level = effective.resolvedFromLevelCode;

  if (level === null || level === undefined || level.trim() === '') return t.unknownLevel;

  return t.follows(code, levelLabel(level));
};

/** 층 이름. 모르는 값이 오면 코드를 그대로 보인다(G-9). */
export const levelLabel = (levelCode: string): string => {
  if (levelCode === 'EQUIPMENT_GROUP') return t.levels.equipmentGroup;
  if (levelCode === 'PLANT') return t.levels.plant;

  return levelCode;
};

/** 그 층에 지정이 있었는가. **그 차례가 곧 「가장 가까운 것이 이긴다」의 모습이다.** */
export const stepNote = (step: WorkCalendarResolutionStep): string =>
  step.hasApplication ? t.hasApplication : t.noApplication;
