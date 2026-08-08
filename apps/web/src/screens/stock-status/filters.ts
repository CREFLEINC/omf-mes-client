import { messages } from '@omf-mes/i18n';

import type { SortKey } from './sort';
import { DEFAULT_VIEW, type ViewAxis } from './view-axis';

/**
 * 조회 조건 — **주소가 정본이다.** 새로고침·뒤로가기·공유가 같은 결과를 내게 하려면
 * 화면 상태가 아니라 주소가 조건을 들고 있어야 한다.
 *
 * 값은 전부 문자열로 다룬다(잔액 0 포함만 참·거짓이다). 입력 도중의 상태를 숫자로 강제하면
 * 지우는 중간에 값이 튄다.
 *
 * **`sel`·`hfrom`·`hto`·`tx`는 이 모듈이 만들지 않는다.** 주소 키 수명 표(계획 결정 4)의
 * 1~5행이 그 한 가지로 함께 지켜진다 — `screen.tsx` 주석에 표가 있다.
 *
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 파일을 참조하지 않는다.
 */

const t = messages.stockStatus;

export interface BalanceFilters {
  /**
   * 창고 번호. **화면이 필수로 둔다**(계획 결정 5).
   *
   * 계약은 창고를 강제하지 않는다 — 「창고·품목·LOT 중 적어도 하나」이며 현장 단말이 LOT만
   * 들고 들어오는 경로가 같은 API를 쓴다. **창고 필수는 이 화면의 규칙이지 계약의 규칙이 아니다.**
   */
  warehouse: string;
  item: string;
  lot: string;
  location: string;
  qualityStatus: string;
  inventoryStatus: string;
  ownership: string;
  /** 잔액이 0인 줄도 내릴지. 계약 기본값이 거짓이다. */
  includeZero: boolean;
}

export const EMPTY_FILTERS: BalanceFilters = {
  warehouse: '',
  item: '',
  lot: '',
  location: '',
  qualityStatus: '',
  inventoryStatus: '',
  ownership: '',
  includeZero: false,
};

/** 주소 키는 짧게 쓰고 계약 이름과 분리한다 — 주소는 사람이 읽고 고치는 자리다. */
const URL_KEYS = {
  warehouse: 'wh',
  item: 'item',
  lot: 'lot',
  location: 'loc',
  qualityStatus: 'qs',
  inventoryStatus: 'is',
  ownership: 'own',
  includeZero: 'zero',
} as const satisfies Record<keyof BalanceFilters, string>;

const VIEW_KEY = 'view';
const SORT_KEY = 'sort';
const PAGE_KEY = 'page';

/**
 * **1 이상의 정수만.** `\d+`는 `0`을 통과시키는데 `0`은 어느 자원의 번호도 아니다 —
 * `?wh=0`이 창고 필수 세 겹(타입·`enabled`·잠긴 버튼)을 전부 지나 `warehouseId=0` 요청이
 * 나갔다. 세 겹이 막는 것은 「비어 있음」이지 「0」이 아니다.
 */
const POSITIVE_INTEGER = /^[1-9]\d*$/;

/**
 * 정수가 아닌 번호는 조건으로 받지 않는다. 그대로 `Number()`에 넘기면 `NaN`이 요청 URL에 실려
 * **조회 전체가 400으로 실패**하고, 사용자에게는 「조회가 늘 안 된다」로만 보인다.
 * 주소를 손으로 고친 경우가 이 자리다.
 */
const readNumberFilter = (raw: string): string => (POSITIVE_INTEGER.test(raw) ? raw : '');

export const readFilters = (params: URLSearchParams): BalanceFilters => ({
  warehouse: readNumberFilter(params.get(URL_KEYS.warehouse) ?? ''),
  item: readNumberFilter(params.get(URL_KEYS.item) ?? ''),
  lot: readNumberFilter(params.get(URL_KEYS.lot) ?? ''),
  location: readNumberFilter(params.get(URL_KEYS.location) ?? ''),
  /*
   * 코드값은 값 목록이 확정되지 않았다(omf-mes#64) — 형태를 판정하면 지어내는 것이 되므로
   * 서버가 준 값을 그대로 읽고 그대로 보낸다.
   */
  qualityStatus: params.get(URL_KEYS.qualityStatus) ?? '',
  inventoryStatus: params.get(URL_KEYS.inventoryStatus) ?? '',
  ownership: params.get(URL_KEYS.ownership) ?? '',
  /* 계약 기본값이 거짓이다. 참을 뜻하는 한 가지 표기만 켠 것으로 읽는다. */
  includeZero: params.get(URL_KEYS.includeZero) === 'true',
});

/**
 * 주소가 담은 조건을 **지금 뜻이 있는 조건**으로 읽는다.
 *
 * 이 화면에는 종속 관계가 둘 있고, 화면이 이미 그것을 선언해 두었다 —
 * **LOT은 품목에**(LOT을 번호 여러 개로 조회할 수단이 없어 품목이 범위를 정한다) ·
 * **위치는 창고에**(계약이 `warehouseId`를 필수로 요구한다) 매달린다.
 * 그런데 매달림이 「참조를 부를지」에만 걸려 있고 **조건 값 자체**에는 걸려 있지 않아,
 * 부모를 빼도 종속 조건이 남아 요청에 계속 실리고 칩은 「알 수 없음」으로 보였다.
 *
 * 「알 수 없음」은 이 저장소에서 뜻이 확정된 낱말이다 — 「이름 목록은 왔는데 그 안에 없다,
 * 즉 **값이 잘못됐다**」. 정상적으로 걸려 결과를 좁히고 있는 조건에 그 표를 붙이면
 * 사용자는 결과가 좁아진 이유를 알 수 없다(#47과 같은 갈래).
 *
 * **읽는 자리에서 판정한다** — `resolveViewAxis`와 같은 갈래다. 제거 핸들러마다 흩어 놓으면
 * 주소 진입·뒤로가기처럼 핸들러를 거치지 않는 경로가 새고, 관계가 늘 때마다 손댈 곳이 는다.
 *
 * **주소는 고쳐 쓰지 않는다.** 부모를 다시 채우면 원하던 조건이 되살아나야 하고,
 * 「주소에 적힌 값과 읽는 값이 다를 수 있다」는 이 화면이 이미 쓰는 규칙이다.
 * 다만 조건 줄의 초안은 **읽은 값**에서 시작하므로, 화면에서 부모를 다시 고르고 조회하면
 * 뜻을 잃었던 종속 조건은 주소에서도 사라진다 — **어긋남이 쌓이지 않는다.**
 */
export const resolveFilters = (filters: BalanceFilters): BalanceFilters => ({
  ...filters,
  location: filters.warehouse === '' ? '' : filters.location,
  lot: filters.item === '' ? '' : filters.lot,
});

/** 주소가 담은 보기. 모르는 값의 처리는 `view-axis.ts`가 정한다. */
export const readViewParam = (params: URLSearchParams): string | null => params.get(VIEW_KEY);

/** 주소가 담은 정렬 열. 보기별 유효성 판정은 `sort.ts`가 한다. */
export const readSortParam = (params: URLSearchParams): string | null => params.get(SORT_KEY);

/** 주소가 가리키는 쪽. 이상한 값은 첫 쪽으로 본다 — 주소는 손으로 고쳐지는 자리다. */
export const readPage = (params: URLSearchParams): number => {
  const raw = params.get(PAGE_KEY) ?? '';

  /* 정규식이 이미 1 이상만 통과시키므로 크기를 다시 묻지 않는다. */
  return POSITIVE_INTEGER.test(raw) ? Number(raw) : 1;
};

/**
 * 보기·조건·정렬·쪽 전체를 주소로 옮긴다. **빈 조건은 키 자체를 두지 않는다** —
 * 주소가 조건을 그대로 드러내야 무엇으로 조회했는지 읽을 수 있다.
 *
 * **기본값은 적지 않는다** — 기본 보기(품목별) · 첫 쪽 · 정렬 없음 · 잔액 0 미포함.
 * 기본값을 주소에 적으면 같은 화면의 주소가 두 가지가 된다.
 *
 * **`sel`·`hfrom`·`hto`·`tx`를 만들지 않는다.** 보기·조건·정렬·쪽이 바뀌면 고른 LOT이
 * 새 결과에 없을 수 있어 함께 비워져야 하고, 고르는 쪽만 이 결과에 덧붙인다(수명 표 1~5행).
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
    [URL_KEYS.lot, readNumberFilter(filters.lot)],
    [URL_KEYS.location, readNumberFilter(filters.location)],
    [URL_KEYS.qualityStatus, filters.qualityStatus],
    [URL_KEYS.inventoryStatus, filters.inventoryStatus],
    [URL_KEYS.ownership, filters.ownership],
  ];

  for (const [key, value] of entries) {
    if (value !== '') next.set(key, value);
  }

  if (filters.includeZero) next.set(URL_KEYS.includeZero, 'true');
  if (view !== DEFAULT_VIEW) next.set(VIEW_KEY, view);
  if (sort !== null) next.set(SORT_KEY, sort);
  if (page > 1) next.set(PAGE_KEY, String(page));

  return next;
};

/** 계약이 쓰는 쿼리 이름. 네 번호만 숫자로 보낸다 — 계약이 정수를 요구한다. */
export interface BalanceFilterQuery {
  warehouseId?: number;
  itemId?: number;
  lotId?: number;
  locationId?: number;
  qualityStatusCode?: string;
  inventoryStatusCode?: string;
  ownershipTypeCode?: string;
  includeZero?: true;
}

export const toBalanceFilterQuery = (filters: BalanceFilters): BalanceFilterQuery => {
  const warehouse = readNumberFilter(filters.warehouse);
  const item = readNumberFilter(filters.item);
  const lot = readNumberFilter(filters.lot);
  const location = readNumberFilter(filters.location);

  return {
    ...(warehouse === '' ? {} : { warehouseId: Number(warehouse) }),
    ...(item === '' ? {} : { itemId: Number(item) }),
    ...(lot === '' ? {} : { lotId: Number(lot) }),
    ...(location === '' ? {} : { locationId: Number(location) }),
    ...(filters.qualityStatus === '' ? {} : { qualityStatusCode: filters.qualityStatus }),
    ...(filters.inventoryStatus === '' ? {} : { inventoryStatusCode: filters.inventoryStatus }),
    ...(filters.ownership === '' ? {} : { ownershipTypeCode: filters.ownership }),
    /* 계약 기본값이 거짓이라 꺼진 상태를 실을 이유가 없다. */
    ...(filters.includeZero ? { includeZero: true as const } : {}),
  };
};

export interface FilterChip {
  key: keyof BalanceFilters;
  label: string;
  /** 제거 버튼의 접근 이름. 「제거」가 여덟이면 어느 조건을 푸는 것인지 알 수 없다. */
  removeLabel: string;
}

/**
 * 참조 조건의 표시 이름. **화면이 이름으로 풀어 넘긴다.**
 *
 * 이 모듈이 번호를 문구로 바꾸지 않는 것이 #44를 구조로 막는 형태다 —
 * 내부 번호를 문자열로 만드는 자리가 아예 없으면 그 값이 화면에 샐 경로도 없다.
 */
export interface FilterChipNames {
  warehouse: string;
  item: string;
  lot: string;
  location: string;
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
    { key: 'lot', label: t.filters.chipLot(names.lot), removeLabel: t.filters.chipRemoveLot },
    {
      key: 'location',
      label: t.filters.chipLocation(names.location),
      removeLabel: t.filters.chipRemoveLocation,
    },
    {
      key: 'qualityStatus',
      label: t.filters.chipQualityStatus(filters.qualityStatus),
      removeLabel: t.filters.chipRemoveQualityStatus,
    },
    {
      key: 'inventoryStatus',
      label: t.filters.chipInventoryStatus(filters.inventoryStatus),
      removeLabel: t.filters.chipRemoveInventoryStatus,
    },
    {
      key: 'ownership',
      label: t.filters.chipOwnership(filters.ownership),
      removeLabel: t.filters.chipRemoveOwnership,
    },
    {
      key: 'includeZero',
      label: t.filters.chipIncludeZero,
      removeLabel: t.filters.chipRemoveIncludeZero,
    },
  ];

  return candidates.filter((chip) => isFilterSet(filters, chip.key));
};

/**
 * 조건이 걸려 있는가. 참·거짓 조건과 문자열 조건의 「비어 있음」이 다르다.
 *
 * **칩을 고르는 데만 쓴다.** 형제 슬라이스에는 「조건이 하나라도 걸렸는가」를 묻는 짝
 * (`hasAnyFilter`)이 있으나 이 화면에는 쓸 자리가 없다 — 빈 상태 세 갈래를 가르는 것은
 * `hasQuery`(창고 유무)와 `isBeyondLast`이고 조건 전체가 아니다. 없는 자리에 두면
 * 검사 범위가 실제보다 넓어 보인다.
 */
const isFilterSet = (filters: BalanceFilters, key: keyof BalanceFilters): boolean => {
  const value = filters[key];

  return typeof value === 'boolean' ? value : value !== '';
};
