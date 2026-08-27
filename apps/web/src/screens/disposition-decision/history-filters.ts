import { defaultPeriod, isPeriodDate, periodLockReason, resolvePeriod } from './period';
import type { PeriodInput } from './period';

export interface HistoryFilters extends PeriodInput {
  dispositionTypeCode: string;
}

export interface HistoryListQuery {
  decidedFrom: string;
  decidedTo: string;
  dispositionTypeCode?: string;
  page?: number;
}

/**
 * 처리 이력 탭은 판정 대기와 **같은 주소 이름**(`from`·`to`)을 쓴다 — 탭을 옮겨도 보고 있던
 * 기간이 유지된다. 다만 걸리는 축이 다르다: 판정 대기는 접수일, 이력은 판정일이다.
 */
const KEYS = {
  from: 'from',
  to: 'to',
  dispositionTypeCode: 'disp',
} as const;

const dateOf = (value: string | null): string => {
  const date = value?.trim() ?? '';
  return isPeriodDate(date) ? date : '';
};

const allowedCode = (value: string | null, allowed: readonly string[]): string => {
  const code = value?.trim() ?? '';
  return code !== '' && allowed.includes(code) ? code : '';
};

export const readHistoryFilters = (
  params: URLSearchParams,
  today: Date,
  dispositionTypeCodes: readonly string[] = [],
): HistoryFilters => {
  const from = dateOf(params.get(KEYS.from));
  const to = dateOf(params.get(KEYS.to));
  const period = periodLockReason({ from, to }) === null ? { from, to } : defaultPeriod(today);

  return {
    ...period,
    dispositionTypeCode: allowedCode(params.get(KEYS.dispositionTypeCode), dispositionTypeCodes),
  };
};

export const toHistoryAppliedSearchParams = (
  current: URLSearchParams,
  filters: HistoryFilters,
  page: number,
): URLSearchParams => {
  const next = new URLSearchParams(current);
  const replace = (key: string, value: string): void => {
    if (value === '') next.delete(key);
    else next.set(key, value);
  };

  replace(KEYS.from, dateOf(filters.from));
  replace(KEYS.to, dateOf(filters.to));
  replace(KEYS.dispositionTypeCode, filters.dispositionTypeCode.trim());
  replace('page', page > 1 ? String(page) : '');

  return next;
};

/**
 * 기간은 언제나 실린다 — 이력 조회에서 기간은 필수다(공유계약 L-3).
 * 막히면 `null`을 돌려 조회를 열지 않는다.
 */
export const toHistoryListQuery = (
  filters: HistoryFilters,
  page: number,
  offsetMinutes: number,
): HistoryListQuery | null => {
  const period = resolvePeriod({ from: filters.from, to: filters.to }, offsetMinutes);
  if (period.kind === 'blocked') return null;

  return {
    decidedFrom: period.bounds.from,
    decidedTo: period.bounds.to,
    ...(filters.dispositionTypeCode === ''
      ? {}
      : { dispositionTypeCode: filters.dispositionTypeCode }),
    ...(page > 1 ? { page } : {}),
  };
};
