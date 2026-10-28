/**
 * 조회 조건은 전부 주소가 소유한다 — 새로고침·뒤로가기·공유가 같은 결과를 낸다.
 * 고른 수주(`sel`)도 주소에 두어 링크 하나로 같은 상세를 연다.
 */

export interface SalesOrderFilters {
  q: string;
  customer: string;
  status: string;
  from: string;
  to: string;
  /** 아직 편성되지 않은 것만. 주소에는 `1` 로 적는다 */
  unassignedOnly: boolean;
  /** 진행(출하가 다 됐는가) — 「전체 · 미완료 · 완료」. 주소에는 `progress=open|done` 으로 적고 전체는 적지 않는다 */
  progress: ProgressFilter;
}

export type ProgressFilter = 'all' | 'open' | 'done';

export const DEFAULT_FILTERS: SalesOrderFilters = {
  q: '',
  customer: '',
  status: '',
  from: '',
  to: '',
  unassignedOnly: false,
  progress: 'all',
};

const TEXT_KEYS = ['q', 'customer', 'status', 'from', 'to'] as const;

/** 진행 조건. 모르는 값은 전체로 읽는다 — 손으로 고친 주소가 400 을 부르지 않게. */
const readProgress = (params: URLSearchParams): ProgressFilter => {
  const progress = params.get('progress');
  return progress === 'open' || progress === 'done' ? progress : 'all';
};

export const readFilters = (params: URLSearchParams): SalesOrderFilters => ({
  q: params.get('q') ?? '',
  customer: params.get('customer') ?? '',
  status: params.get('status') ?? '',
  from: params.get('from') ?? '',
  to: params.get('to') ?? '',
  unassignedOnly: params.get('unassigned') === '1',
  progress: readProgress(params),
});

/** 1 보다 작거나 정수가 아닌 쪽 번호는 첫 쪽으로 읽는다 — 손으로 고친 주소가 화면을 깨지 않게. */
export const readPage = (params: URLSearchParams): number => {
  const page = Number(params.get('page'));
  return Number.isSafeInteger(page) && page > 0 ? page : 1;
};

export const readSelectedId = (params: URLSearchParams): number | null => {
  const id = Number(params.get('sel'));
  return Number.isSafeInteger(id) && id > 0 ? id : null;
};

/**
 * 조건·쪽을 주소로 옮긴다. **조건이 바뀌면 고른 건을 놓는다** — 새 결과에 그 건이 없을 수 있다.
 */
export const toSearchParams = (filters: SalesOrderFilters, page: number): URLSearchParams => {
  const params = new URLSearchParams();
  TEXT_KEYS.forEach((key) => {
    const value = filters[key].trim();
    if (value !== '') params.set(key, value);
  });
  if (filters.unassignedOnly) params.set('unassigned', '1');
  if (filters.progress !== 'all') params.set('progress', filters.progress);
  if (page > 1) params.set('page', String(page));
  return params;
};

/** 고른 건만 바꾼다 — 조건과 쪽은 그대로 둔다. */
export const toSelectionSearchParams = (
  current: URLSearchParams,
  salesOrderId: number,
): URLSearchParams => {
  const next = new URLSearchParams(current);
  next.set('sel', String(salesOrderId));
  return next;
};

/** 숫자로 읽히지 않는 식별자는 보내지 않는다 — 서버가 400 으로 목록 전체를 막는다. */
const toId = (value: string): number | undefined => {
  const id = Number(value);
  return value !== '' && Number.isSafeInteger(id) && id > 0 ? id : undefined;
};

export interface SalesOrderListQuery {
  q?: string;
  customerId?: number;
  statusCode?: string;
  orderDateFrom?: string;
  orderDateTo?: string;
  unassignedOnly?: boolean;
  /**
   * 진행 조건 — **계약 사본에 아직 없다**(서버에 요청 2026-10-28). 그전 서버는 모르는 조건을 무시해 거르지 않은 목록을
   * 낸다. 두 값 말고는 400 일 수 있어 이 둘만 싣는다. 계약에 실리면 이 칸을 걷고 계약 타입을 따른다.
   */
  progress?: 'OPEN' | 'COMPLETED';
  page?: number;
  size?: number;
}

export const LIST_PAGE_SIZE = 25;

/** 주소의 조건을 계약의 쿼리로 옮긴다. 빈 조건은 싣지 않는다. */
export const toListQuery = (filters: SalesOrderFilters, page: number): SalesOrderListQuery => {
  const query: SalesOrderListQuery = { page, size: LIST_PAGE_SIZE };
  const q = filters.q.trim();
  if (q !== '') query.q = q;
  const customerId = toId(filters.customer);
  if (customerId !== undefined) query.customerId = customerId;
  const status = filters.status.trim();
  if (status !== '') query.statusCode = status;
  if (filters.from !== '') query.orderDateFrom = filters.from;
  if (filters.to !== '') query.orderDateTo = filters.to;
  if (filters.unassignedOnly) query.unassignedOnly = true;
  if (filters.progress === 'open') query.progress = 'OPEN';
  if (filters.progress === 'done') query.progress = 'COMPLETED';
  return query;
};
