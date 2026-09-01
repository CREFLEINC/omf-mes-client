/**
 * 출하작업지시를 부를 기간.
 *
 * ⚠ **스펙에 없는 칸이다.** 스펙 §3은 출하작업지시를 선택칸 하나로 그렸지만, 계약이
 * `shipDateFrom`을 「필수 — 공유계약 L-3」으로 표시한다. 기간 없이는 목록을 **부를 수조차
 * 없으므로** 화면이 칸을 만든다 — 몰래 오늘 하루로 고정하면 어제 지시가 안 보이는 이유를
 * 사용자가 알 길이 없다.
 */

const pad = (value: number): string => String(value).padStart(2, '0');

export interface Period {
  from: string;
  to: string;
}

export const toDateString = (date: Date): string =>
  `${String(date.getFullYear())}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** 달력에 실제로 있는 날인가 — `2026-02-31`은 모양은 맞지만 없는 날이다. */
export const isDate = (value: string): boolean => {
  if (!DATE_PATTERN.test(value)) return false;

  const parts = value.split('-').map(Number);
  const [year, month, day] = parts;
  if (year === undefined || month === undefined || day === undefined) return false;

  const date = new Date(year, month - 1, day);

  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
};

/** 기본 기간 — 최근 한 달. `today`를 밖에서 받아 실행하는 날에 결과가 좌우되지 않게 한다. */
export const defaultPeriod = (today: Date): Period => {
  const from = new Date(today.getFullYear(), today.getMonth() - 1, today.getDate());
  return { from: toDateString(from), to: toDateString(today) };
};

/** 쓸 수 있는 기간인가. 시작이 끝보다 뒤면 조회하지 않는다. */
export const isUsablePeriod = (period: Period): boolean =>
  isDate(period.from) && isDate(period.to) && period.from <= period.to;
