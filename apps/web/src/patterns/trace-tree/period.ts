import { messages } from '@omf-mes/i18n';

/**
 * 목록 조건의 기간 — 공장 현지 날짜(양 끝 포함), 둘 다 필수, 최대 366일(서버 계약 §1). 처음 값은 최근 30일(FR-013).
 * 순수 함수만 둔다. 「오늘」은 부르는 쪽이 공장 날짜로 준다(`plantToday`).
 */
const t = messages.traceTree.period;

export const DEFAULT_PERIOD_DAYS = 30;
export const MAX_PERIOD_DAYS = 366;

export interface Period {
  from: string;
  to: string;
}

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MS = 86_400_000;

const toUtcMs = (date: string): number => Date.parse(`${date}T00:00:00Z`);

const formatUtc = (ms: number): string => new Date(ms).toISOString().slice(0, 10);

/** 찾을 수 있으면 `null`, 아니면 기간 칸 아래 보일 사유. 서버도 같은 조건에서 400을 낸다. */
export const validatePeriod = ({ from, to }: Period): string | null => {
  if (!DATE_PATTERN.test(from)) return t.required;
  if (!DATE_PATTERN.test(to)) return t.invalid;
  if (to < from) return t.reversed;
  return (toUtcMs(to) - toUtcMs(from)) / DAY_MS + 1 > MAX_PERIOD_DAYS ? t.tooLong : null;
};

/** 공장 날짜 오늘을 끝으로 오늘을 포함해 `days`일. */
export const defaultPeriod = (today: string, days = DEFAULT_PERIOD_DAYS): Period => ({
  from: formatUtc(toUtcMs(today) - (days - 1) * DAY_MS),
  to: today,
});
