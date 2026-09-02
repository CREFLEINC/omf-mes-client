import { messages } from '@omf-mes/i18n';

import type { SortKey } from './sort';
import { DEFAULT_VIEW, type ViewAxis } from './view-axis';

/**
 * 조회 조건 — **주소가 정본이다.** 새로고침·뒤로가기·공유가 같은 결과를 내게 하려면
 * 화면 상태가 아니라 주소가 조건을 들고 있어야 한다.
 *
 * 계획이 정한 필터는 넷뿐이다 — 창고(필수)·품목(선택)·묶기(`view-axis.ts`가 다룬다)·가용만.
 * W-01-07처럼 위치·LOT·품질 상태·소유 구분 조건은 이 화면에 없다.
 *
 * **고르는 쪽의 키(`SELECTION_KEYS`)는 `toSearchParams`가 만들지 않는다** — 조회 조건이
 * 바뀌면 고른 LOT이 새 결과에 없을 수 있어 함께 비워져야 하고, 고르는 쪽(`screen.tsx`의
 * 고르기 핸들러)만 덧붙인다.
 *
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 파일을 참조하지 않는다.
 */

const t = messages.productStockStatus;

export interface BalanceFilters {
  /** 창고 번호. 이 화면이 필수로 둔다(계획 §완료 조건 1) — 전 창고 조회는 무겁다. */
  warehouse: string;
  item: string;
  /** 가용 재고(`inventoryStatusCode=AVAILABLE`)만 낼지. */
  availableOnly: boolean;
}

export const EMPTY_FILTERS: BalanceFilters = {
  warehouse: '',
  item: '',
  availableOnly: false,
};

const URL_KEYS = {
  warehouse: 'wh',
  item: 'item',
  availableOnly: 'avail',
} as const satisfies Record<keyof BalanceFilters, string>;

const VIEW_KEY = 'view';
const SORT_KEY = 'sort';
const PAGE_KEY = 'page';

/**
 * `toSearchParams`가 만들지 않는 키들. 고르는 쪽이 덧붙인다.
 * 이름을 한 곳에 모아 두는 이유는 W-01-07의 `SELECTION_KEYS`와 같다 — 만드는 자리와 읽는
 * 자리가 다른 파일에 있어, 문자열을 양쪽에 적으면 한쪽만 고쳐졌을 때 조회는 되는데
 * 아무것도 안 걸린 것처럼 보인다.
 */
export const SELECTION_KEYS = {
  lot: 'sel',
} as const;

/**
 * 1 이상의 정수만. `\d+`는 `0`을 통과시키는데 `0`은 어느 자원의 번호도 아니다.
 */
const POSITIVE_INTEGER = /^[1-9]\d*$/;

const readNumberFilter = (raw: string): string => (POSITIVE_INTEGER.test(raw) ? raw : '');

export const readFilters = (params: URLSearchParams): BalanceFilters => ({
  warehouse: readNumberFilter(params.get(URL_KEYS.warehouse) ?? ''),
  item: readNumberFilter(params.get(URL_KEYS.item) ?? ''),
  availableOnly: params.get(URL_KEYS.availableOnly) === 'true',
});

/** 주소가 담은 보기. 모르는 값의 처리는 `view-axis.ts`가 정한다. */
export const readViewParam = (params: URLSearchParams): string | null => params.get(VIEW_KEY);

/** 주소가 담은 정렬 열. 보기별 유효성 판정은 `sort.ts`가 한다. */
export const readSortParam = (params: URLSearchParams): string | null => params.get(SORT_KEY);

/** 주소가 가리키는 쪽. 이상한 값은 첫 쪽으로 본다 — 주소는 손으로 고쳐지는 자리다. */
export const readPage = (params: URLSearchParams): number => {
  const raw = params.get(PAGE_KEY) ?? '';

  return POSITIVE_INTEGER.test(raw) ? Number(raw) : 1;
};

/** 고른 LOT의 번호. 잔액 요청에 실리지 않는다 — LOT 상세 경로의 조각으로만 쓴다. */
export const readSelectedLotId = (params: URLSearchParams): number | null => {
  const raw = params.get(SELECTION_KEYS.lot) ?? '';

  return POSITIVE_INTEGER.test(raw) ? Number(raw) : null;
};

/**
 * 보기·조건·정렬·쪽 전체를 주소로 옮긴다. **빈 조건은 키 자체를 두지 않는다** —
 * 주소가 조건을 그대로 드러내야 무엇으로 조회했는지 읽을 수 있다.
 *
 * **기본값은 적지 않는다** — 기본 보기(품목별) · 첫 쪽 · 정렬 없음 · 가용만 꺼짐.
 *
 * **`SELECTION_KEYS`를 만들지 않는다** — 보기·조건·정렬·쪽이 바뀌면 고른 LOT이 새 결과에
 * 없을 수 있어 함께 비워져야 한다.
 */
export const toSearchParams = (
  view: ViewAxis,
  filters: BalanceFilters,
  sort: SortKey | null,
  page: number,
): URLSearchParams => {
  const next = new URLSearchParams();

  const entries: [string, string][] = [
    [URL_KEYS.warehouse, readNumberFilter(filters.warehouse)],
    [URL_KEYS.item, readNumberFilter(filters.item)],
  ];

  for (const [key, value] of entries) {
    if (value !== '') next.set(key, value);
  }

  if (filters.availableOnly) next.set(URL_KEYS.availableOnly, 'true');
  if (view !== DEFAULT_VIEW) next.set(VIEW_KEY, view);
  if (sort !== null) next.set(SORT_KEY, sort);
  if (page > 1) next.set(PAGE_KEY, String(page));

  return next;
};

/** 계약이 쓰는 쿼리 이름. */
export interface BalanceFilterQuery {
  warehouseId?: number;
  itemId?: number;
  inventoryStatusCode?: 'AVAILABLE';
}

export const toBalanceFilterQuery = (filters: BalanceFilters): BalanceFilterQuery => {
  const warehouse = readNumberFilter(filters.warehouse);
  const item = readNumberFilter(filters.item);

  return {
    ...(warehouse === '' ? {} : { warehouseId: Number(warehouse) }),
    ...(item === '' ? {} : { itemId: Number(item) }),
    /* 가용만이 꺼져 있으면 값을 아예 싣지 않는다 — 계약 기본값이 「거르지 않음」이다. */
    ...(filters.availableOnly ? { inventoryStatusCode: 'AVAILABLE' as const } : {}),
  };
};

export interface FilterChip {
  key: keyof BalanceFilters;
  label: string;
  removeLabel: string;
}

/** 참조 조건의 표시 이름. 화면이 이름으로 풀어 넘긴다 — 내부 번호를 문자열로 옮기는 자리를 두지 않는다. */
export interface FilterChipNames {
  warehouse: string;
  item: string;
}

/** 적용된 조건마다 칩 하나. 순서는 조건 줄의 컨트롤 순서와 같다. */
export const toFilterChips = (filters: BalanceFilters, names: FilterChipNames): FilterChip[] => {
  const candidates: FilterChip[] = [
    {
      key: 'warehouse',
      label: t.filters.chipWarehouse(names.warehouse),
      removeLabel: t.filters.chipRemoveWarehouse,
    },
    {
      key: 'item',
      label: t.filters.chipItem(names.item),
      removeLabel: t.filters.chipRemoveItem,
    },
    {
      key: 'availableOnly',
      label: t.filters.chipAvailableOnly,
      removeLabel: t.filters.chipRemoveAvailableOnly,
    },
  ];

  return candidates.filter((chip) => isFilterSet(filters, chip.key));
};

const isFilterSet = (filters: BalanceFilters, key: keyof BalanceFilters): boolean => {
  const value = filters[key];

  return typeof value === 'boolean' ? value : value !== '';
};
