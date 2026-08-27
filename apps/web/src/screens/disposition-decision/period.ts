import { messages } from '@omf-mes/i18n';

export interface PeriodInput {
  from: string;
  to: string;
}

export interface PeriodBounds {
  from: string;
  to: string;
}

/**
 * L-3 — 기간 필터를 비울 수 없게 하고 기본값을 최근 한 달로 둔다.
 * 무제한 조회를 허용하면 원장이 쌓인 뒤 목록이 멎는다.
 */
export const DEFAULT_PERIOD_DAYS = 30;

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

const pad = (value: number, width: number): string => String(value).padStart(width, '0');

const formatDate = (date: Date): string =>
  `${pad(date.getFullYear(), 4)}-${pad(date.getMonth() + 1, 2)}-${pad(date.getDate(), 2)}`;

/** 달력에 실재하는 날인지 본다 — `2026-02-31`은 형태만 맞고 날이 아니다. */
const isDate = (value: string): boolean => {
  const match = DATE_PATTERN.exec(value);
  if (match === null) return false;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);

  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
};

export const isPeriodDate = isDate;

/** 조회를 막는 사유. 없으면 `null`. */
export const periodLockReason = (input: PeriodInput): string | null => {
  const t = messages.dispositionDecision;

  if (input.from === '' || input.to === '') return t.values.periodRequired;
  if (!isDate(input.from) || !isDate(input.to)) return t.values.periodRequired;
  // 자릿수가 고정된 `YYYY-MM-DD`라 문자열 비교가 곧 날짜 비교다.
  if (input.to < input.from) return t.values.periodRequired;

  return null;
};

/** 오늘을 마지막 날로 두고 `DEFAULT_PERIOD_DAYS`일치를 고른다 — **오늘을 포함해** 센다. */
export const defaultPeriod = (today: Date): PeriodInput => {
  const from = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate() - (DEFAULT_PERIOD_DAYS - 1),
  );

  return { from: formatDate(from), to: formatDate(today) };
};

const zoneOf = (offsetMinutes: number): string => {
  const sign = offsetMinutes < 0 ? '-' : '+';
  const absolute = Math.abs(offsetMinutes);

  return `${sign}${pad(Math.floor(absolute / 60), 2)}:${pad(absolute % 60, 2)}`;
};

/** 하루 뒤 날짜. `Date`가 달·해의 경계를 넘겨 준다. */
const nextDay = (value: string): string => {
  const match = DATE_PATTERN.exec(value);
  if (match === null) return value;

  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]) + 1);

  return formatDate(date);
};

/**
 * 기간의 두 끝을 서버가 받는 형태로 바꾼다.
 *
 * ⭐ **끝은 «반열림»이다 — 「그날까지」를 익일 00:00:00으로 보낸다**(공유계약 L-3-1).
 * `23:59:59`로 닫으면 그 초의 소수점 이하(`23:59:59.5`)가 어느 경계로 잘라도 빠진다.
 * ⚠ 이 저장소의 앞선 화면들은 `23:59:59`를 쓰는데, 그 코드가 L-3-1 신설보다 앞선다 —
 * 새 조회는 이 규약을 따르고 앞선 자리는 각자의 슬라이스에서 옮긴다.
 *
 * `offsetMinutes`는 UTC 기준 분(한국은 +540)이다. 화면이 `-new Date().getTimezoneOffset()`을
 * 한 번 계산해 넘기고, 감지기는 고정값을 넣는다 — 실행 환경의 시간대가 결과를 바꾸지 않게 한다.
 */
export const toPeriodBounds = (input: PeriodInput, offsetMinutes: number): PeriodBounds => {
  const zone = zoneOf(offsetMinutes);

  return {
    from: `${input.from}T00:00:00${zone}`,
    to: `${nextDay(input.to)}T00:00:00${zone}`,
  };
};
