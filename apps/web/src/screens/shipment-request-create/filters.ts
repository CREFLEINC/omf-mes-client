import type { AssignmentMode } from './types';

/**
 * 좌측 목록의 조회 조건과 선택 상태 — **주소가 정본이다.** 새로고침·뒤로가기·공유가 같은
 * 결과를 내게 하려면 화면 상태가 아니라 주소가 조건을 들고 있어야 한다.
 *
 * 계획이 정한 필터는 셋이다 — 고객·주문일(범위)·미편성만. 지시서 번호 검색(`q`)과 상태 필터는
 * 이번 슬라이스에 없다(작업 슬라이스 「filters.ts — 좌측 3필터 쿼리」).
 *
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 파일을 참조하지 않는다.
 */

export interface SourceFilters {
  customer: string;
  orderDateFrom: string;
  orderDateTo: string;
  unassignedOnly: boolean;
}

export const EMPTY_FILTERS: SourceFilters = {
  customer: '',
  orderDateFrom: '',
  orderDateTo: '',
  unassignedOnly: false,
};

const URL_KEYS = {
  customer: 'customer',
  orderDateFrom: 'from',
  orderDateTo: 'to',
  unassignedOnly: 'unassigned',
} as const satisfies Record<keyof SourceFilters, string>;

const PAGE_KEY = 'page';

/**
 * 편성 대상을 가리키는 키. **`toSearchParams`가 만들지 않는다** — 조건이 바뀌면 목록의
 * 편성 대상이 결과에 없을 수 있으나, 이미 고른 지시서 상세는 조건과 무관하게 계속 열려 있어야
 * 한다(사용자가 조건을 좁혔다고 편성 중인 폼이 사라지면 안 된다). 그래서 고르는 쪽만 이 키를
 * 다룬다(product-stock-status의 `SELECTION_KEYS`와 같은 형태).
 */
export const TARGET_KEYS = {
  salesOrder: 'so',
  mode: 'mode',
} as const;

const POSITIVE_INTEGER = /^[1-9]\d*$/;

const readNumberFilter = (raw: string): string => (POSITIVE_INTEGER.test(raw) ? raw : '');

export const readFilters = (params: URLSearchParams): SourceFilters => ({
  customer: readNumberFilter(params.get(URL_KEYS.customer) ?? ''),
  orderDateFrom: params.get(URL_KEYS.orderDateFrom) ?? '',
  orderDateTo: params.get(URL_KEYS.orderDateTo) ?? '',
  unassignedOnly: params.get(URL_KEYS.unassignedOnly) === 'true',
});

export const readPage = (params: URLSearchParams): number => {
  const raw = params.get(PAGE_KEY) ?? '';

  return POSITIVE_INTEGER.test(raw) ? Number(raw) : 1;
};

/**
 * 지금 편성 대상 — **주소 하나로 세 상태를 가른다.** `so`가 있으면 지시서 경유,
 * 없이 `mode=new`면 단독 생성, 둘 다 없으면 아직 고르지 않은 것이다.
 */
export type SourceTarget =
  | { kind: 'none' }
  | { kind: 'order'; salesOrderId: number; mode: 'fromOrder' }
  | { kind: 'standalone'; mode: 'standalone' };

export const readTarget = (params: URLSearchParams): SourceTarget => {
  const raw = params.get(TARGET_KEYS.salesOrder) ?? '';

  if (POSITIVE_INTEGER.test(raw)) {
    return { kind: 'order', salesOrderId: Number(raw), mode: 'fromOrder' };
  }

  if (params.get(TARGET_KEYS.mode) === 'new') return { kind: 'standalone', mode: 'standalone' };

  return { kind: 'none' };
};

export const targetModeOf = (target: SourceTarget): AssignmentMode | null =>
  target.kind === 'none' ? null : target.mode;

/**
 * 조건·쪽 전체를 주소로 옮긴다. **빈 조건은 키 자체를 두지 않는다.**
 * **기본값은 적지 않는다** — 첫 쪽 · 미편성만 꺼짐.
 * **`TARGET_KEYS`를 만들지 않는다** — 조건이 바뀌어도 편성 중인 대상은 유지된다(위 설명).
 */
export const toSearchParams = (
  filters: SourceFilters,
  page: number,
  target: SourceTarget,
): URLSearchParams => {
  const next = new URLSearchParams();

  const entries: [string, string][] = [
    [URL_KEYS.customer, readNumberFilter(filters.customer)],
    [URL_KEYS.orderDateFrom, filters.orderDateFrom],
    [URL_KEYS.orderDateTo, filters.orderDateTo],
  ];

  for (const [key, value] of entries) {
    if (value !== '') next.set(key, value);
  }

  if (filters.unassignedOnly) next.set(URL_KEYS.unassignedOnly, 'true');
  if (page > 1) next.set(PAGE_KEY, String(page));

  if (target.kind === 'order') next.set(TARGET_KEYS.salesOrder, String(target.salesOrderId));
  if (target.kind === 'standalone') next.set(TARGET_KEYS.mode, 'new');

  return next;
};

/** 계약이 쓰는 쿼리 이름. */
export interface SourceFilterQuery {
  customerId?: number;
  orderDateFrom?: string;
  orderDateTo?: string;
  unassignedOnly?: boolean;
}

export const toSourceFilterQuery = (filters: SourceFilters): SourceFilterQuery => {
  const customer = readNumberFilter(filters.customer);

  return {
    ...(customer === '' ? {} : { customerId: Number(customer) }),
    ...(filters.orderDateFrom === '' ? {} : { orderDateFrom: filters.orderDateFrom }),
    ...(filters.orderDateTo === '' ? {} : { orderDateTo: filters.orderDateTo }),
    ...(filters.unassignedOnly ? { unassignedOnly: true } : {}),
  };
};

export interface FilterChip {
  key: 'customer' | 'period' | 'unassignedOnly';
  label: string;
  removeLabel: string;
}
