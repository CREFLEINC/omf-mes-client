import {
  defaultPeriod,
  isPeriodDate,
  periodLockReason,
  type PeriodInput,
  resolvePeriod,
} from './period';
import { parseSort, type SortState, toSortParam } from './sort';

export interface ProgressFilters extends PeriodInput {
  productionLineId: string;
  statusCode: string;
  productionOrderId: string;
  /** W/O 번호 검색. 계약의 `q`다. */
  keyword: string;
}

/** 스펙 레이아웃이 「128건 중 1–50」으로 적었다. */
export const PAGE_SIZE = 50;

export interface ProgressListQuery {
  plannedStartFrom: string;
  plannedStartTo: string;
  productionLineId?: number;
  statusCode?: string;
  productionOrderId?: number;
  q?: string;
  sort: string;
  page?: number;
  size: number;
  /** 실적 누계를 함께 받는다 — 목록의 양품·불량·달성률이 여기서 온다. */
  withProgress: true;
}

const KEYS = {
  from: 'from',
  to: 'to',
  productionLineId: 'line',
  statusCode: 'st',
  productionOrderId: 'po',
  keyword: 'q',
  sort: 'sort',
  page: 'page',
  selected: 'workOrderId',
} as const;

/**
 * 이 화면의 정식 주소. 라우트에 등록된 값과 **같아야 한다** — 라우트 감지기가 그것을 고정한다.
 *
 * 화면 슬라이스는 `routes/`를 참조할 수 없으므로(의존 방향) 값을 여기 둔다.
 */
export const WORK_ORDER_PROGRESS_PATH = '/production/work-order-progress';

const POSITIVE_INTEGER = /^\d+$/;

const isIdentifier = (raw: string): boolean => {
  const parsed = Number(raw);
  return POSITIVE_INTEGER.test(raw) && Number.isSafeInteger(parsed) && parsed >= 1;
};

const identifierOf = (raw: string | null): string => {
  const value = raw?.trim() ?? '';
  return isIdentifier(value) ? value : '';
};

const dateOf = (value: string | null): string => {
  const date = value?.trim() ?? '';
  return isPeriodDate(date) ? date : '';
};

/**
 * 주소에서 조회 조건을 읽는다.
 *
 * 기간이 비었거나 쓸 수 없는 값이면 **최근 한 달로 되돌린다** — L-3이 기간을 비울 수 없게 하므로
 * 「조건 없는 조회」라는 상태를 만들지 않는다. `today`를 밖에서 받는 이유는 감지기가 실행하는
 * 날에 따라 결과가 달라지지 않게 하기 위해서다.
 */
export const readFilters = (params: URLSearchParams, today: Date): ProgressFilters => {
  const from = dateOf(params.get(KEYS.from));
  const to = dateOf(params.get(KEYS.to));
  const fallback = defaultPeriod(today);
  const period = periodLockReason({ from, to }) === null ? { from, to } : fallback;

  return {
    ...period,
    productionLineId: identifierOf(params.get(KEYS.productionLineId)),
    statusCode: params.get(KEYS.statusCode)?.trim() ?? '',
    productionOrderId: identifierOf(params.get(KEYS.productionOrderId)),
    keyword: params.get(KEYS.keyword)?.trim() ?? '',
  };
};

export const readSort = (params: URLSearchParams, period: PeriodInput): SortState =>
  parseSort(params.get(KEYS.sort), period);

export const readPage = (params: URLSearchParams): number => {
  const raw = params.get(KEYS.page) ?? '';
  return isIdentifier(raw) ? Number(raw) : 1;
};

/** 고른 W/O — 상세를 여는 키. 값이 식별자가 아니면 고른 것이 없는 상태로 둔다. */
export const readSelectedWorkOrderId = (params: URLSearchParams): number | null => {
  const raw = identifierOf(params.get(KEYS.selected));
  return raw === '' ? null : Number(raw);
};

const optionalNumber = (raw: string): number | undefined => (raw === '' ? undefined : Number(raw));

const optionalText = (raw: string): string | undefined => (raw === '' ? undefined : raw);

/**
 * 서버로 보낼 조회 조건. **기간이 막히면 `null`** — 막았는데 요청이 나가는 상태를 만들지 않는다.
 *
 * ⛔ **공정으로 거르는 조건을 만들지 않는다.** 계약에 그 파라미터가 없고 요구서의 액션표에도
 * 없다. 자리만 만들어 두면 「고장 났나」로 읽힌다.
 */
export const toProgressListQuery = (
  filters: ProgressFilters,
  sort: SortState,
  page: number,
  offsetMinutes: number,
): ProgressListQuery | null => {
  const period = resolvePeriod(filters, offsetMinutes);
  if (period.kind !== 'ready') return null;

  return {
    plannedStartFrom: period.bounds.from,
    plannedStartTo: period.bounds.to,
    ...(optionalNumber(filters.productionLineId) === undefined
      ? {}
      : { productionLineId: Number(filters.productionLineId) }),
    ...(optionalText(filters.statusCode) === undefined ? {} : { statusCode: filters.statusCode }),
    ...(optionalNumber(filters.productionOrderId) === undefined
      ? {}
      : { productionOrderId: Number(filters.productionOrderId) }),
    ...(optionalText(filters.keyword) === undefined ? {} : { q: filters.keyword }),
    sort: toSortParam(sort, filters),
    ...(page > 1 ? { page } : {}),
    size: PAGE_SIZE,
    withProgress: true,
  };
};

const replace = (params: URLSearchParams, key: string, value: string): void => {
  if (value === '') params.delete(key);
  else params.set(key, value);
};

export const toAppliedSearchParams = (
  current: URLSearchParams,
  filters: ProgressFilters,
  page: number,
): URLSearchParams => {
  const next = new URLSearchParams(current);

  replace(next, KEYS.from, dateOf(filters.from));
  replace(next, KEYS.to, dateOf(filters.to));
  replace(next, KEYS.productionLineId, filters.productionLineId.trim());
  replace(next, KEYS.statusCode, filters.statusCode.trim());
  replace(next, KEYS.productionOrderId, filters.productionOrderId.trim());
  replace(next, KEYS.keyword, filters.keyword.trim());
  replace(next, KEYS.page, page > 1 ? String(page) : '');
  // 조건이 바뀌면 앞서 고른 W/O는 목록에 없을 수 있다 — 고른 것을 지우고 다시 고르게 한다.
  next.delete(KEYS.selected);

  return next;
};

export const withSort = (current: URLSearchParams, sort: SortState): URLSearchParams => {
  const next = new URLSearchParams(current);

  replace(next, KEYS.sort, `${sort.key},${sort.direction}`);
  // 순서가 바뀌면 2쪽의 내용이 달라진다 — 첫 쪽으로 되돌린다.
  next.delete(KEYS.page);

  return next;
};

export const withPage = (current: URLSearchParams, page: number): URLSearchParams => {
  const next = new URLSearchParams(current);
  replace(next, KEYS.page, page > 1 ? String(page) : '');
  return next;
};

export const withSelectedWorkOrder = (
  current: URLSearchParams,
  workOrderId: number | null,
): URLSearchParams => {
  const next = new URLSearchParams(current);
  replace(next, KEYS.selected, workOrderId === null ? '' : String(workOrderId));
  return next;
};
