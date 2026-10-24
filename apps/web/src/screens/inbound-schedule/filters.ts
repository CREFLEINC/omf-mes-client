import { messages } from '@omf-mes/i18n';

import type { PeriodInput } from './period';
import { isStageGroup } from './stage';
import type { InboundScheduleQuery, InboundStageGroup, OrderSort, OrderSortKey } from './types';

/**
 * 조회 조건 — **주소가 정본이다.** 새로고침·뒤로가기·공유가 같은 결과를 내게 하려면
 * 화면 상태가 아니라 주소가 조건을 들고 있어야 한다.
 *
 * 값은 전부 문자열로 다룬다(두 켜짐 표시만 참·거짓). 입력 도중의 상태를 숫자로 강제하면
 * 지우는 중간에 값이 튄다.
 *
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 파일을 참조하지 않는다.
 */

const t = messages.inboundSchedule;

export interface ScheduleFilters {
  /** 공급사 번호. 정수만 뜻이 있다 — 계약이 `supplierId`를 정수로 요구한다. */
  supplier: string;
  /** 공장 번호. 공급사와 같은 이유로 정수만 받는다. */
  plant: string;
  /** 품목 번호. 품목 선택 창으로 고른다. */
  item: string;
  /** 발주번호 · ERP 발주번호 검색어 */
  q: string;
  /**
   * 아직 다 들어오지 않은 라인만 본다. **화면 기본이 켬이다** — 서버 기본도 켬이다.
   * 이 화면의 대상은 「들어올 것」이고, 끄면 다 들어온·취소된 라인까지 온다.
   */
  openOnly: boolean;
  /** 납기가 공장 현지 오늘보다 앞선 미완료 라인만 본다. 켜면 서버가 미완료 조건을 함께 건다. */
  overdueOnly: boolean;
  /** 입고 단계 묶음(탭 줄의 단계 칩). 비면 거르지 않는다. 계약 대기 — 앞선 서버는 이 조건을 무시한다. */
  stage: InboundStageGroup | '';
  /**
   * 왼쪽 표의 열 정렬. 없으면 서버 기본 순서다. 조건은 아니지만 **쪽을 넘는 순서**라 조건과 함께 주소가 들고 서버가
   * 정렬한다(계약 대기 — 앞선 서버는 무시한다). 초기화하면 함께 풀린다.
   */
  sort: OrderSort | null;
}

/**
 * 화면이 아무 조건도 걸지 않은 상태. **「빈」이 아니라 「기본」이다** —
 * 미완료만이 켜진 것이 이 화면의 시작점이고, 초기화도 여기로 돌아온다.
 */
export const DEFAULT_FILTERS: ScheduleFilters = {
  supplier: '',
  plant: '',
  item: '',
  q: '',
  openOnly: true,
  overdueOnly: false,
  stage: '',
  sort: null,
};

/** 주소 키는 짧게 쓰고 계약 이름과 분리한다 — 주소는 사람이 읽고 고치는 자리다. */
const URL_KEYS = {
  supplier: 'supplier',
  plant: 'plant',
  item: 'item',
  q: 'q',
  openOnly: 'open',
  overdueOnly: 'overdue',
  stage: 'stage',
  sort: 'sort',
  sortDirection: 'dir',
  page: 'page',
} as const;

const ORDER_SORT_KEYS: readonly OrderSortKey[] = [
  'overdue',
  'expectedReceiptDate',
  'purchaseOrderNo',
  'inboundStage',
  'supplierName',
  'openLineCount',
  'orderDate',
];

const isOrderSortKey = (value: string): value is OrderSortKey =>
  (ORDER_SORT_KEYS as readonly string[]).includes(value);

/** 주소의 정렬 — 모르는 열이면 정렬하지 않는다. 방향은 `desc` 만 내림차순이고 나머지는 오름차순이다. */
const readOrderSort = (params: URLSearchParams): OrderSort | null => {
  const key = params.get(URL_KEYS.sort) ?? '';

  if (!isOrderSortKey(key)) return null;

  return {
    key,
    direction: params.get(URL_KEYS.sortDirection) === 'desc' ? 'descending' : 'ascending',
  };
};

/** 미완료만은 켬이 기본이라 **끔만** 주소에 적는다. 이 값이 그 표식이다. */
const OPEN_ONLY_OFF = '0';
/** 납기 지난 것만은 끔이 기본이라 **켬만** 주소에 적는다. */
const OVERDUE_ONLY_ON = '1';

const POSITIVE_INTEGER = /^\d+$/;

/**
 * 정수가 아닌 번호는 조건으로 받지 않는다. 그대로 `Number()`에 넘기면 `NaN`이 요청 URL에 실려
 * **조회 전체가 400으로 실패**하고, 사용자에게는 「조회가 늘 안 된다」로만 보인다.
 * 주소를 손으로 고친 경우가 이 자리다.
 */
const readNumberFilter = (raw: string): string =>
  POSITIVE_INTEGER.test(raw) && Number(raw) >= 1 ? raw : '';

/** 공백만 친 검색어는 조건이 아니다 — 주소에 남기면 조건이 걸린 것처럼 보인다. */
const normalizeQuery = (raw: string): string => raw.trim();

export const readFilters = (params: URLSearchParams): ScheduleFilters => ({
  supplier: readNumberFilter(params.get(URL_KEYS.supplier) ?? ''),
  plant: readNumberFilter(params.get(URL_KEYS.plant) ?? ''),
  item: readNumberFilter(params.get(URL_KEYS.item) ?? ''),
  q: params.get(URL_KEYS.q) ?? '',
  /*
   * 알 수 없는 값은 기본으로 본다. 주소를 손으로 고쳤을 때 화면이 못 알아듣는 값 때문에
   * **대상이 아닌 라인까지 보이는** 것보다, 기본으로 되돌아가는 편이 놀랍지 않다.
   */
  openOnly: params.get(URL_KEYS.openOnly) !== OPEN_ONLY_OFF,
  overdueOnly: params.get(URL_KEYS.overdueOnly) === OVERDUE_ONLY_ON,
  /* 묶음 이름이 아니면 빈 조건이다 — 모르는 값을 서버에 보내지 않는다. */
  stage: isStageGroup(params.get(URL_KEYS.stage) ?? '')
    ? (params.get(URL_KEYS.stage) as InboundStageGroup)
    : '',
  sort: readOrderSort(params),
});

/** 주소가 가리키는 쪽. 이상한 값은 첫 쪽으로 본다 — 주소는 손으로 고쳐지는 자리다. */
export const readPage = (params: URLSearchParams): number => {
  const raw = params.get(URL_KEYS.page) ?? '';

  return POSITIVE_INTEGER.test(raw) && Number(raw) >= 1 ? Number(raw) : 1;
};

/**
 * 조건 전체를 주소로 옮긴다. **빈 조건·기본값은 키 자체를 두지 않는다** —
 * 같은 화면의 주소가 두 가지가 되지 않게 하고, 주소가 걸린 조건을 그대로 드러내게 한다.
 *
 * 기간은 기본(오늘 앞뒤 2주)과 다를 때만 적는다.
 */
export const toSearchParams = (
  period: PeriodInput,
  filters: ScheduleFilters,
  page: number,
  fallback: PeriodInput,
): URLSearchParams => {
  const next = new URLSearchParams();

  /* 기본 기간과 같은 쪽은 적지 않는다. 다르면 **빈 값도 적는다** — 지운 기간이 기본으로 되돌아가지 않게. */
  if (period.from !== fallback.from) next.set('from', period.from);
  if (period.to !== fallback.to) next.set('to', period.to);

  const entries: [string, string][] = [
    [URL_KEYS.supplier, readNumberFilter(filters.supplier)],
    [URL_KEYS.plant, readNumberFilter(filters.plant)],
    [URL_KEYS.item, readNumberFilter(filters.item)],
    [URL_KEYS.q, normalizeQuery(filters.q)],
  ];

  for (const [key, value] of entries) {
    if (value !== '') next.set(key, value);
  }

  if (!filters.openOnly) next.set(URL_KEYS.openOnly, OPEN_ONLY_OFF);
  if (filters.overdueOnly) next.set(URL_KEYS.overdueOnly, OVERDUE_ONLY_ON);
  if (filters.stage !== '') next.set(URL_KEYS.stage, filters.stage);
  if (filters.sort !== null) {
    next.set(URL_KEYS.sort, filters.sort.key);
    next.set(URL_KEYS.sortDirection, filters.sort.direction === 'descending' ? 'desc' : 'asc');
  }
  if (page > 1) next.set(URL_KEYS.page, String(page));

  return next;
};

/** 계약이 쓰는 질의 중 조건 줄이 정하는 부분(기간·쪽 제외). */
export type ScheduleFilterQuery = Omit<
  InboundScheduleQuery,
  'expectedReceiptDateFrom' | 'expectedReceiptDateTo' | 'page'
>;

/**
 * 조건을 계약 질의로 옮긴다. 번호 셋만 숫자로 보낸다 — 계약이 정수를 요구한다.
 *
 * 두 켜짐 표시는 **서버 기본과 다를 때만** 싣는다 — 미완료만은 끌 때(`openOnly=false`),
 * 납기 지난 것만은 켤 때(`overdueOnly=true`). 기본값을 실으면 요청을 읽는 사람에게 조건이
 * 하나 더 걸린 것처럼 보인다.
 */
export const toFilterQuery = (filters: ScheduleFilters): ScheduleFilterQuery => {
  const supplier = readNumberFilter(filters.supplier);
  const plant = readNumberFilter(filters.plant);
  const item = readNumberFilter(filters.item);
  const query = normalizeQuery(filters.q);

  return {
    ...(supplier === '' ? {} : { supplierId: Number(supplier) }),
    ...(plant === '' ? {} : { plantId: Number(plant) }),
    ...(item === '' ? {} : { itemId: Number(item) }),
    ...(query === '' ? {} : { q: query }),
    ...(filters.openOnly ? {} : { openOnly: false }),
    ...(filters.overdueOnly ? { overdueOnly: true } : {}),
    ...(filters.stage === '' ? {} : { inboundStage: filters.stage }),
    ...(filters.sort === null
      ? {}
      : {
          sort: `${filters.sort.key},${filters.sort.direction === 'descending' ? 'desc' : 'asc'}`,
        }),
  };
};

/** 칩으로 내는 조건 — 값이 있는 글자 조건뿐이다. 두 켜짐 표시는 조건 줄에 늘 보이므로 칩이 없다. */
export type ChipKey = 'supplier' | 'plant' | 'item' | 'q';

export interface FilterChip {
  key: ChipKey;
  label: string;
  /** 제거 버튼의 접근 이름. 「제거」가 넷이면 어느 조건을 푸는 것인지 알 수 없다. */
  removeLabel: string;
}

/**
 * 참조 조건의 표시 이름. **화면이 이름으로 풀어 넘긴다.**
 *
 * 이 모듈이 번호를 문구로 바꾸지 않는 것이 #44를 구조로 막는 형태다 —
 * 내부 번호를 문자열로 만드는 자리가 아예 없으면 그 값이 화면에 샐 경로도 없다.
 */
export interface FilterChipNames {
  supplier: string;
  plant: string;
  item: string;
}

/** 적용된 조건마다 칩 하나. 순서는 조건 줄의 컨트롤 순서와 같다. */
export const toFilterChips = (filters: ScheduleFilters, names: FilterChipNames): FilterChip[] => {
  const candidates: FilterChip[] = [
    {
      key: 'supplier',
      label: t.filters.chipSupplier(names.supplier),
      removeLabel: t.filters.chipRemoveSupplier,
    },
    {
      key: 'plant',
      label: t.filters.chipPlant(names.plant),
      removeLabel: t.filters.chipRemovePlant,
    },
    { key: 'item', label: t.filters.chipItem(names.item), removeLabel: t.filters.chipRemoveItem },
    { key: 'q', label: t.filters.chipQ(filters.q), removeLabel: t.filters.chipRemoveQ },
  ];

  return candidates.filter((chip) => filters[chip.key] !== '');
};
