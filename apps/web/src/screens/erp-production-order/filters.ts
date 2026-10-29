import type { ErpProductionOrderListQuery } from './types';

/**
 * 조회 조건은 전부 주소가 소유한다 — 새로고침·뒤로가기·공유가 같은 결과를 낸다.
 */

export interface ErpProductionOrderFilters {
  /** ERP W/O 번호 일부(계약 `q` — 부분일치). */
  q: string;
  /** 품목 번호. 품목 선택 창으로 고른다. */
  item: string;
  status: string;
  /** 계획 시작일 범위(YYYY-MM-DD). */
  from: string;
  to: string;
  /** 진행(생산이 다 됐는가) — 「전체 · 미완료 · 완료」. 주소에는 `progress=open|done` 으로 적고 전체는 적지 않는다 */
  progress: ProgressFilter;
}

export type ProgressFilter = 'all' | 'open' | 'done';

export const DEFAULT_FILTERS: ErpProductionOrderFilters = {
  q: '',
  item: '',
  status: '',
  from: '',
  to: '',
  progress: 'all',
};

const KEYS = ['q', 'item', 'status', 'from', 'to'] as const;

/** 진행 조건. 모르는 값은 전체로 읽는다 — 손으로 고친 주소가 400 을 부르지 않게. */
const readProgress = (params: URLSearchParams): ProgressFilter => {
  const progress = params.get('progress');
  return progress === 'open' || progress === 'done' ? progress : 'all';
};

export const readFilters = (params: URLSearchParams): ErpProductionOrderFilters => ({
  q: params.get('q') ?? '',
  item: params.get('item') ?? '',
  status: params.get('status') ?? '',
  from: params.get('from') ?? '',
  to: params.get('to') ?? '',
  progress: readProgress(params),
});

/** 1 보다 작거나 정수가 아닌 쪽 번호는 첫 쪽으로 읽는다 — 손으로 고친 주소가 화면을 깨지 않게. */
export const readPage = (params: URLSearchParams): number => {
  const page = Number(params.get('page'));
  return Number.isSafeInteger(page) && page > 0 ? page : 1;
};

/** 조건·쪽을 주소로 옮긴다. 빈 값은 적지 않아 주소가 짧게 남는다. */
export const toSearchParams = (
  filters: ErpProductionOrderFilters,
  page: number,
): URLSearchParams => {
  const params = new URLSearchParams();
  KEYS.forEach((key) => {
    const value = filters[key].trim();
    if (value !== '') params.set(key, value);
  });
  if (filters.progress !== 'all') params.set('progress', filters.progress);
  if (page > 1) params.set('page', String(page));
  return params;
};

/** 숫자로 읽히지 않는 식별자는 보내지 않는다 — 서버가 400 으로 목록 전체를 막는다. */
const toId = (value: string): number | undefined => {
  const id = Number(value);
  return value !== '' && Number.isSafeInteger(id) && id > 0 ? id : undefined;
};

/**
 * 달력에 있는 `YYYY-MM-DD` 인가. 서버가 어긋난 날짜를 400 `INVALID` 로 막는다(장부 P-66) —
 * 손으로 고친 주소 하나가 목록 전체를 실패로 만들지 않게 보내기 전에 거른다.
 */
export const isIsoDate = (value: string): boolean => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value);
};

export const LIST_PAGE_SIZE = 25;

/** 주소의 조건을 질의로 옮긴다. 빈 조건·읽히지 않는 값은 싣지 않는다. */
export const toListQuery = (
  filters: ErpProductionOrderFilters,
  page: number,
): ErpProductionOrderListQuery => {
  const query: ErpProductionOrderListQuery = { page, size: LIST_PAGE_SIZE };
  const q = filters.q.trim();
  if (q !== '') query.q = q;
  const itemId = toId(filters.item);
  if (itemId !== undefined) query.itemId = itemId;
  if (filters.status !== '') query.statusCode = filters.status;
  if (isIsoDate(filters.from)) query.plannedStartDateFrom = filters.from;
  if (isIsoDate(filters.to)) query.plannedStartDateTo = filters.to;
  if (filters.progress === 'open') query.progress = 'OPEN';
  if (filters.progress === 'done') query.progress = 'COMPLETED';
  return query;
};
