import { messages } from '@omf-mes/i18n';

/**
 * 조회 기간 — 필수, 최대 31일(계약). W-06-10 `integration-sync/period.ts` 와 같은 방식이다.
 * 순수 함수만 둔다 — 「오늘」과 시간대 오프셋은 호출부가 인자로 준다.
 */

const t = messages.dispatchHistory.errors;

export const DEFAULT_PERIOD_DAYS = 7;
export const MAX_PERIOD_DAYS = 31;

/** `<input type="date">` 가 주는 `YYYY-MM-DD` 그대로. */
export interface PeriodInput {
  from: string;
  to: string;
}

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MS = 86_400_000;
const pad = (value: number, length: number): string => String(value).padStart(length, '0');

/** 양 끝을 포함한 날 수. 날짜만 견주므로 UTC 자정끼리 뺀다 — 서머타임 영향이 없다. */
const daysInclusive = (input: PeriodInput): number =>
  (Date.parse(`${input.to}T00:00:00Z`) - Date.parse(`${input.from}T00:00:00Z`)) / DAY_MS + 1;

/** 조회할 수 있으면 `null`, 아니면 사유. 31일을 넘기면 서버가 400 을 내므로 화면이 먼저 막는다. */
export const validatePeriod = (input: PeriodInput): string | null => {
  if (!DATE_PATTERN.test(input.from) || !DATE_PATTERN.test(input.to)) return t.periodRequired;
  if (input.to < input.from) return t.periodReversed;
  return daysInclusive(input) > MAX_PERIOD_DAYS ? t.periodTooLong : null;
};

/** RFC3339 로 바꾼다. 종료는 그날 23:59:59 — 마지막 날 건이 빠지지 않게 한다. */
export const toPeriodQuery = (
  input: PeriodInput,
  offsetMinutes: number,
): { from: string; to: string } => {
  const sign = offsetMinutes < 0 ? '-' : '+';
  const absolute = Math.abs(offsetMinutes);
  const zone = `${sign}${pad(Math.floor(absolute / 60), 2)}:${pad(absolute % 60, 2)}`;
  return { from: `${input.from}T00:00:00${zone}`, to: `${input.to}T23:59:59${zone}` };
};

/** 오늘을 마지막 날로 두고 오늘을 포함해 7일. */
export const defaultPeriod = (today: Date): PeriodInput => {
  const format = (date: Date): string =>
    `${pad(date.getFullYear(), 4)}-${pad(date.getMonth() + 1, 2)}-${pad(date.getDate(), 2)}`;
  const from = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate() - (DEFAULT_PERIOD_DAYS - 1),
  );
  return { from: format(from), to: format(today) };
};
