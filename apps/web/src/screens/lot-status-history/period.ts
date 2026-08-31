export interface HistoryPeriod {
  from: string;
  to: string;
}

export type HistoryPeriodError = 'missing' | 'invalid' | 'reversed';

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

const isExistingDate = (value: string): boolean => {
  const match = DATE_PATTERN.exec(value);
  if (match === null) return false;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);

  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
};

export const validateHistoryPeriod = (period: HistoryPeriod): HistoryPeriodError | null => {
  if (period.from === '' || period.to === '') return 'missing';
  if (!isExistingDate(period.from) || !isExistingDate(period.to)) return 'invalid';
  if (period.from > period.to) return 'reversed';

  return null;
};

export interface HistoryPeriodBounds {
  from: string;
  to: string;
}

const formatOffset = (offsetMinutes: number): string => {
  const sign = offsetMinutes >= 0 ? '+' : '-';
  const absoluteMinutes = Math.abs(offsetMinutes);
  const hours = Math.floor(absoluteMinutes / 60);
  const minutes = absoluteMinutes % 60;

  return `${sign}${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
};

/** 하루 뒤. 호출자가 이미 검증한 값만 받으므로 `Date`가 달·해 경계를 대신 넘겨 준다. */
const nextDay = (value: string): string => {
  const match = DATE_PATTERN.exec(value);
  const year = Number(match?.[1]);
  const month = Number(match?.[2]);
  const day = Number(match?.[3]);
  const date = new Date(year, month - 1, day + 1);

  return `${String(date.getFullYear()).padStart(4, '0')}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

/**
 * 호출자는 validateHistoryPeriod가 성공한 뒤 검증된 지역 날짜만 전달한다.
 *
 * ⛔ **끝 경계는 반열림이다**(공유계약 L-3-1) — 「그날까지」를 익일 00:00:00으로 보낸다.
 * `23:59:59`로 닫으면 그 초의 소수점 이하가 어느 경계로 잘라도 빠진다.
 */
export const toHistoryPeriodBounds = (
  period: HistoryPeriod,
  offsetMinutes: number,
): HistoryPeriodBounds => {
  const offset = formatOffset(offsetMinutes);

  return {
    from: `${period.from}T00:00:00${offset}`,
    to: `${nextDay(period.to)}T00:00:00${offset}`,
  };
};
