import type { paths } from '@omf-mes/api-client';

import { DEFAULT_PAGE_SIZE } from './filters';
import { defaultPeriod, isPeriodDate, periodLockReason, resolvePeriod } from './period';
import type { PeriodInput } from './period';

type HistoryQueryParams = NonNullable<
  paths['/quality/disposition-decisions']['get']['parameters']['query']
>;

export interface HistoryFilters extends PeriodInput {
  /** 품목 — 처분 대기와 같은 검색 창으로 고른다(사용자 지시 · #223). 비면 전체. */
  itemId: string;
  dispositionTypeCode: string;
}

export interface HistoryListQuery {
  decidedFrom: string;
  decidedTo: string;
  /** 처분 유형은 계약이 세 값으로 닫았다(`REWORK`·`SCRAP`·`NORMAL` · omf-mes#336) */
  dispositionTypeCode?: HistoryQueryParams['dispositionTypeCode'];
  itemId?: number;
  page?: number;
  /** 한 쪽 건수 10 · 20 · 50(#223). */
  size?: number;
}

/**
 * 처리 이력 탭은 판정 대기와 **같은 주소 이름**(`from`·`to`)을 쓴다 — 탭을 옮겨도 보고 있던
 * 기간이 유지된다. 다만 걸리는 축이 다르다: 판정 대기는 접수일, 이력은 판정일이다.
 */
const KEYS = {
  from: 'from',
  to: 'to',
  /* 품목도 처분 대기와 같은 주소 이름 — 탭을 옮겨도 고른 품목이 남는다. */
  itemId: 'item',
  dispositionTypeCode: 'disp',
} as const;

const dateOf = (value: string | null): string => {
  const date = value?.trim() ?? '';
  return isPeriodDate(date) ? date : '';
};

/** 품목 번호는 양의 정수만 — 그 밖의 값은 조건에서 뺀다. */
const itemIdOf = (value: string | null): string => {
  const id = value?.trim() ?? '';
  return /^[1-9]\d*$/.test(id) ? id : '';
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
    itemId: itemIdOf(params.get(KEYS.itemId)),
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
  replace(KEYS.itemId, itemIdOf(filters.itemId));
  replace(KEYS.dispositionTypeCode, filters.dispositionTypeCode.trim());
  replace('page', page > 1 ? String(page) : '');
  // 조건이 바뀌면 고른 줄이 목록에 없을 수 있다 — 처분 대기와 같이 고른 것을 지운다(#223).
  next.delete('nonconformanceId');
  next.delete('decision');

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
  size: number = DEFAULT_PAGE_SIZE,
): HistoryListQuery | null => {
  const period = resolvePeriod({ from: filters.from, to: filters.to }, offsetMinutes);
  if (period.kind === 'blocked') return null;

  return {
    decidedFrom: period.bounds.from,
    decidedTo: period.bounds.to,
    ...(filters.dispositionTypeCode === ''
      ? {}
      : {
          dispositionTypeCode:
            filters.dispositionTypeCode as HistoryQueryParams['dispositionTypeCode'],
        }),
    ...(filters.itemId === '' ? {} : { itemId: Number(filters.itemId) }),
    ...(page > 1 ? { page } : {}),
    size,
  };
};
