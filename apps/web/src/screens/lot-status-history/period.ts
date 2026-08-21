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

/** 호출자는 validateHistoryPeriod가 성공한 뒤 검증된 지역 날짜만 전달한다. */
export const toHistoryPeriodBounds = (
  period: HistoryPeriod,
  offsetMinutes: number,
): HistoryPeriodBounds => {
  const offset = formatOffset(offsetMinutes);

  return {
    from: `${period.from}T00:00:00${offset}`,
    to: `${period.to}T23:59:59${offset}`,
  };
};
