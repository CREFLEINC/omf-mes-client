import type { PeriodInput } from './period';
import type { DispatchQuery } from './types';

/** 조회 조건 — **주소가 정본이다.** 빈 조건은 키를 두지 않는다. */
export interface DispatchFilters {
  event: string;
  department: string;
  /** `NOTIFIED` · `SKIPPED` · 빈 값(전체) */
  result: string;
}

export const EMPTY_FILTERS: DispatchFilters = { event: '', department: '', result: '' };

const POSITIVE = /^[1-9][0-9]*$/;
const RESULTS = new Set(['NOTIFIED', 'SKIPPED']);

export const readPeriod = (params: URLSearchParams): PeriodInput => ({
  from: params.get('from') ?? '',
  to: params.get('to') ?? '',
});

export const readFilters = (params: URLSearchParams): DispatchFilters => ({
  event: params.get('event') ?? '',
  department: POSITIVE.test(params.get('dept') ?? '') ? (params.get('dept') ?? '') : '',
  result: RESULTS.has(params.get('result') ?? '') ? (params.get('result') ?? '') : '',
});

export const readPage = (params: URLSearchParams): number => {
  const raw = params.get('page') ?? '';
  return POSITIVE.test(raw) ? Number(raw) : 1;
};

/** 고른 이벤트 처리 건 — 상세 드로어가 이 번호로 Zalo 발송을 부른다(T-W-A `?selected=`). */
export const readSelected = (params: URLSearchParams): number | null => {
  const raw = params.get('selected') ?? '';
  return POSITIVE.test(raw) ? Number(raw) : null;
};

export const toSearchParams = (
  period: PeriodInput,
  filters: DispatchFilters,
  page = 1,
  selected: number | null = null,
): URLSearchParams => {
  const next = new URLSearchParams({ from: period.from, to: period.to });
  if (filters.event !== '') next.set('event', filters.event);
  if (filters.department !== '') next.set('dept', filters.department);
  if (filters.result !== '') next.set('result', filters.result);
  if (page > 1) next.set('page', String(page));
  if (selected !== null) next.set('selected', String(selected));
  return next;
};

export const toFilterQuery = (filters: DispatchFilters): Omit<DispatchQuery, 'from' | 'to'> => ({
  ...(filters.event === '' ? {} : { eventCode: filters.event }),
  ...(filters.department === '' ? {} : { departmentId: Number(filters.department) }),
  ...(filters.result === ''
    ? {}
    : { status: filters.result as NonNullable<DispatchQuery['status']> }),
});
