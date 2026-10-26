import { messages } from '@omf-mes/i18n';

/**
 * 조회 기간 — 공장 현지 날짜(양 끝 포함), 시작 필수, 최대 366일(계약 P-119).
 * 순수 함수만 둔다. 「오늘」은 부르는 쪽이 공장 날짜로 준다(`plantToday`).
 */
const t = messages.lotTrace.period;

export const DEFAULT_PERIOD_DAYS = 7;
export const MAX_PERIOD_DAYS = 366;

export interface Period {
  from: string;
  /** 비면 서버가 정한다(시작만 보낸다). */
  to: string;
}

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MS = 86_400_000;

const toUtcMs = (date: string): number => Date.parse(`${date}T00:00:00Z`);

const formatUtc = (ms: number): string => new Date(ms).toISOString().slice(0, 10);

/** 조회할 수 있으면 `null`, 아니면 기간 칸 아래 보일 사유. 서버도 같은 조건에서 400을 낸다. */
export const validatePeriod = ({ from, to }: Period): string | null => {
  if (!DATE_PATTERN.test(from)) return t.required;
  if (to === '') return null;
  if (!DATE_PATTERN.test(to)) return t.required;
  if (to < from) return t.reversed;
  return (toUtcMs(to) - toUtcMs(from)) / DAY_MS + 1 > MAX_PERIOD_DAYS ? t.tooLong : null;
};

/** 공장 날짜 오늘을 끝으로 오늘을 포함해 7일. */
export const defaultPeriod = (today: string): Period => ({
  from: formatUtc(toUtcMs(today) - (DEFAULT_PERIOD_DAYS - 1) * DAY_MS),
  to: today,
});
