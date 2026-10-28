/**
 * 조회 조건은 전부 주소가 소유한다 — 새로고침·뒤로가기·공유가 같은 결과를 낸다.
 * 고른 P/O(`sel`)도 주소에 두어 링크 하나로 같은 상세를 연다.
 */

export interface PurchaseOrderFilters {
  q: string;
  supplier: string;
  plant: string;
  status: string;
  /** 발주 유형 — ERP 발주 유형 코드(공통코드 `ORDER_TYPE`). 주소 `type` */
  orderType: string;
  from: string;
  to: string;
  /** 진행(입하가 다 됐는가) — 「전체 · 미완료 · 완료」. 주소에는 `progress=open|done` 으로 적고 전체는 적지 않는다 */
  progress: ProgressFilter;
}

export type ProgressFilter = 'all' | 'open' | 'done';

export const DEFAULT_FILTERS: PurchaseOrderFilters = {
  q: '',
  supplier: '',
  plant: '',
  status: '',
  orderType: '',
  from: '',
  to: '',
  progress: 'all',
};

const TEXT_KEYS = ['q', 'supplier', 'plant', 'status', 'from', 'to'] as const;
/** 주소 키가 칸 이름과 다른 조건 — 발주 유형은 주소에 `type` 으로 짧게 적는다. */
const ORDER_TYPE_KEY = 'type';

/**
 * 진행 조건. 예전 주소의 「입하 미완료만」(`open=1`)은 미완료로 읽는다 — 저장해 둔 링크가 깨지지 않게.
 * 다시 적을 때는 `progress` 로만 적는다.
 */
const readProgress = (params: URLSearchParams): ProgressFilter => {
  const progress = params.get('progress');
  if (progress === 'open' || progress === 'done') return progress;
  return params.get('open') === '1' ? 'open' : 'all';
};

export const readFilters = (params: URLSearchParams): PurchaseOrderFilters => ({
  q: params.get('q') ?? '',
  supplier: params.get('supplier') ?? '',
  plant: params.get('plant') ?? '',
  status: params.get('status') ?? '',
  orderType: params.get(ORDER_TYPE_KEY) ?? '',
  from: params.get('from') ?? '',
  to: params.get('to') ?? '',
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
 * 빈 값은 적지 않아 주소가 짧게 남는다.
 */
export const toSearchParams = (filters: PurchaseOrderFilters, page: number): URLSearchParams => {
  const params = new URLSearchParams();
  TEXT_KEYS.forEach((key) => {
    const value = filters[key].trim();
    if (value !== '') params.set(key, value);
  });
  const orderType = filters.orderType.trim();
  if (orderType !== '') params.set(ORDER_TYPE_KEY, orderType);
  if (filters.progress !== 'all') params.set('progress', filters.progress);
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
  /**
   * 발주 유형 — **계약 사본에 없다**(사용자 지시 2026-10-28 「발주 유형별로 구분」, 서버 세션에 요청). 이 조건을 모르는
   * 서버는 무시하고 전체를 준다. 계약에 실리면 이 주석을 걷고 계약 타입을 따른다.
   */
  erpOrderTypeCode?: string;
  orderDateFrom?: string;
  orderDateTo?: string;
  openOnly?: boolean;
  /**
   * 진행 조건 — **계약 사본에 아직 없다**(서버 #850 · 장부 P-131). 대소문자를 가리고 두 값 말고는 400 이라 이 둘만
   * 싣는다. 계약에 실리면 이 칸을 걷고 계약 타입을 따른다.
   */
  progress?: 'OPEN' | 'COMPLETED';
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
  if (filters.orderType !== '') query.erpOrderTypeCode = filters.orderType;
  if (filters.from !== '') query.orderDateFrom = filters.from;
  if (filters.to !== '') query.orderDateTo = filters.to;
  /* 미완료는 지금 서버가 아는 `openOnly` 도 함께 싣는다 — `progress` 를 모르는 서버에서도 미완료는 걸러진다. */
  if (filters.progress === 'open') {
    query.openOnly = true;
    query.progress = 'OPEN';
  }
  if (filters.progress === 'done') query.progress = 'COMPLETED';
  return query;
};
