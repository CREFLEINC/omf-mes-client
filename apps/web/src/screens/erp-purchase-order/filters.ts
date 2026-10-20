/**
 * 조회 조건은 전부 주소가 소유한다 — 새로고침·뒤로가기·공유가 같은 결과를 낸다.
 * 고른 P/O(`sel`)도 주소에 두어 링크 하나로 같은 상세를 연다.
 */

export interface PurchaseOrderFilters {
  q: string;
  supplier: string;
  plant: string;
  status: string;
  from: string;
  to: string;
  /** 입하가 끝나지 않은 건만. 주소에는 `1` 로 적는다 */
  openOnly: boolean;
}

export const DEFAULT_FILTERS: PurchaseOrderFilters = {
  q: '',
  supplier: '',
  plant: '',
  status: '',
  from: '',
  to: '',
  openOnly: false,
};

const TEXT_KEYS = ['q', 'supplier', 'plant', 'status', 'from', 'to'] as const;

export const readFilters = (params: URLSearchParams): PurchaseOrderFilters => ({
  q: params.get('q') ?? '',
  supplier: params.get('supplier') ?? '',
  plant: params.get('plant') ?? '',
  status: params.get('status') ?? '',
  from: params.get('from') ?? '',
  to: params.get('to') ?? '',
  openOnly: params.get('open') === '1',
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
 * 빈 값은 적지 않아 주소가 짧게 남는다.
 */
export const toSearchParams = (filters: PurchaseOrderFilters, page: number): URLSearchParams => {
  const params = new URLSearchParams();
  TEXT_KEYS.forEach((key) => {
    const value = filters[key].trim();
    if (value !== '') params.set(key, value);
  });
  if (filters.openOnly) params.set('open', '1');
  if (page > 1) params.set('page', String(page));
  return params;
};

/** 고른 건만 바꾼다 — 조건과 쪽은 그대로 둔다. */
export const toSelectionSearchParams = (
  current: URLSearchParams,
  purchaseOrderId: number,
): URLSearchParams => {
  const next = new URLSearchParams(current);
  next.set('sel', String(purchaseOrderId));
  return next;
};

/** 숫자로 읽히지 않는 식별자는 보내지 않는다 — 서버가 400 으로 목록 전체를 막는다. */
const toId = (value: string): number | undefined => {
  const id = Number(value);
  return value !== '' && Number.isSafeInteger(id) && id > 0 ? id : undefined;
};

export interface PurchaseOrderListQuery {
  q?: string;
  supplierId?: number;
  plantId?: number;
  statusCode?: string;
  orderDateFrom?: string;
  orderDateTo?: string;
  openOnly?: boolean;
  page?: number;
  size?: number;
}

export const LIST_PAGE_SIZE = 25;

/** 주소의 조건을 계약의 쿼리로 옮긴다. 빈 조건은 싣지 않는다. */
export const toListQuery = (
  filters: PurchaseOrderFilters,
  page: number,
): PurchaseOrderListQuery => {
  const query: PurchaseOrderListQuery = { page, size: LIST_PAGE_SIZE };
  const q = filters.q.trim();
  if (q !== '') query.q = q;
  const supplierId = toId(filters.supplier);
  if (supplierId !== undefined) query.supplierId = supplierId;
  const plantId = toId(filters.plant);
  if (plantId !== undefined) query.plantId = plantId;
  if (filters.status !== '') query.statusCode = filters.status;
  if (filters.from !== '') query.orderDateFrom = filters.from;
  if (filters.to !== '') query.orderDateTo = filters.to;
  if (filters.openOnly) query.openOnly = true;
  return query;
};
