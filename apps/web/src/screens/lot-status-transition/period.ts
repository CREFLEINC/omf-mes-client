export const DEFAULT_TRANSITION_PERIOD_DAYS = 30;

export interface TransitionPeriod {
  from: string;
  to: string;
}

export type TransitionPeriodError = 'missing' | 'invalid' | 'reversed';

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const pad = (value: number): string => String(value).padStart(2, '0');
const formatDate = (value: Date): string =>
  `${String(value.getFullYear()).padStart(4, '0')}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;

const isCalendarDate = (value: string): boolean => {
  const matched = DATE_PATTERN.exec(value);
  if (matched === null) return false;

  const year = Number(matched[1]);
  const month = Number(matched[2]);
  const day = Number(matched[3]);
  const date = new Date(year, month - 1, day);

  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
};

export const defaultTransitionPeriod = (today: Date): TransitionPeriod => {
  const from = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate() - (DEFAULT_TRANSITION_PERIOD_DAYS - 1),
  );

  return { from: formatDate(from), to: formatDate(today) };
};

export const validateTransitionPeriod = (
  period: TransitionPeriod,
): TransitionPeriodError | null => {
  if (period.from === '' || period.to === '') return 'missing';
  if (!isCalendarDate(period.from) || !isCalendarDate(period.to)) return 'invalid';
  if (period.from > period.to) return 'reversed';

  return null;
};

const formatOffset = (offsetMinutes: number): string => {
  const sign = offsetMinutes >= 0 ? '+' : '-';
  const absolute = Math.abs(offsetMinutes);

  return `${sign}${pad(Math.floor(absolute / 60))}:${pad(absolute % 60)}`;
};

/** 하루 뒤. 호출자가 이미 검증한 값만 받으므로 `Date`가 달·해 경계를 대신 넘겨 준다. */
const nextDay = (value: string): string => {
  const matched = DATE_PATTERN.exec(value);
  const year = Number(matched?.[1]);
  const month = Number(matched?.[2]);
  const day = Number(matched?.[3]);
  const date = new Date(year, month - 1, day + 1);

  return formatDate(date);
};

/**
 * ⛔ **끝 경계는 반열림이다**(공유계약 L-3-1) — 「그날까지」를 익일 00:00:00으로 보낸다.
 * `23:59:59`로 닫으면 그 초의 소수점 이하가 어느 경계로 잘라도 빠진다.
 */
export const toTransitionPeriodBounds = (
  period: TransitionPeriod,
  offsetMinutes: number,
): { transitionFrom: string; transitionTo: string } => {
  const offset = formatOffset(offsetMinutes);

  return {
    transitionFrom: `${period.from}T00:00:00${offset}`,
    transitionTo: `${nextDay(period.to)}T00:00:00${offset}`,
  };
};
