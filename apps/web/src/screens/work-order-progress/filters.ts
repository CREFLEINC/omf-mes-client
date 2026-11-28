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
  /** 공정. 계약의 `processId`다 — 서버가 Routing 공정을 거쳐 잇는다. */
  processId: string;
  /** W/O 번호 검색. 계약의 `q`다. */
  keyword: string;
}

/** 보기 — 같은 조회 결과를 표로 보거나 날짜 축 일정으로 본다. */
export type ProgressView = 'table' | 'timeline';

/** 스펙 레이아웃이 「128건 중 1–50」으로 적었다. */
export const PAGE_SIZE = 50;

export interface ProgressListQuery {
  plannedStartFrom: string;
  plannedStartTo: string;
  productionLineId?: number;
  statusCode?: string;
  processId?: number;
  q?: string;
  sort: ReturnType<typeof toSortParam>;
  page?: number;
  size: number;
  /** 실적 누계를 함께 받는다 — 목록의 양품·불량·달성률이 여기서 온다. */
  withProgress: true;
  /** 요약 집계를 함께 받는다 — 조건 전체 기준이고 목록과 같은 트랜잭션에서 온다. */
  withSummary: true;
}

/**
 * 상태 칩의 건수만 묻는 조회 — 걸린 조건에서 **상태만 뺀** 것이다.
 *
 * 상태를 고른 채로 받은 요약은 그 상태 하나만 세어 온다. 다른 상태 칩의 건수를 지우지 않으려면
 * 상태 없는 요약을 한 번 더 받아야 한다. 줄은 필요 없어 한 건만 받는다.
 */
export interface StatusCountQuery {
  plannedStartFrom: string;
  plannedStartTo: string;
  productionLineId?: number;
  processId?: number;
  q?: string;
  size: 1;
  withSummary: true;
}

const KEYS = {
  from: 'from',
  to: 'to',
  productionLineId: 'line',
  statusCode: 'st',
  processId: 'proc',
  keyword: 'q',
  sort: 'sort',
  page: 'page',
  selected: 'workOrderId',
  view: 'view',
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
 * 기간이 비었거나 쓸 수 없는 값이면 **기본 기간(오늘 앞뒤 14일)으로 되돌린다** — L-3이 기간을 비울 수 없게 하므로
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
    processId: identifierOf(params.get(KEYS.processId)),
    keyword: params.get(KEYS.keyword)?.trim() ?? '',
  };
};

/** 주소의 보기. 적히지 않았거나 모르는 값이면 표다. */
export const readView = (params: URLSearchParams): ProgressView =>
  params.get(KEYS.view) === 'timeline' ? 'timeline' : 'table';

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

/** 상태를 뺀 나머지 조건 — 목록 조회와 상태 칩 건수 조회가 함께 쓴다. */
const scopeOf = (
  filters: ProgressFilters,
): Pick<ProgressListQuery, 'productionLineId' | 'processId' | 'q'> => ({
  ...(optionalNumber(filters.productionLineId) === undefined
    ? {}
    : { productionLineId: Number(filters.productionLineId) }),
  ...(optionalNumber(filters.processId) === undefined
    ? {}
    : { processId: Number(filters.processId) }),
  ...(optionalText(filters.keyword) === undefined ? {} : { q: filters.keyword }),
});

/**
 * 서버로 보낼 조회 조건. **기간이 막히면 `null`** — 막았는데 요청이 나가는 상태를 만들지 않는다.
 */
export const toProgressListQuery = (
  filters: ProgressFilters,
  sort: SortState,
  page: number,
  offsetMinutes: number,
  /** 고른 쪽 크기(10 · 20 · 50 · #360) — 주지 않으면 종전대로 50. */
  size: number = PAGE_SIZE,
): ProgressListQuery | null => {
  const period = resolvePeriod(filters, offsetMinutes);
  if (period.kind !== 'ready') return null;

  return {
    plannedStartFrom: period.bounds.from,
    plannedStartTo: period.bounds.to,
    ...scopeOf(filters),
    ...(optionalText(filters.statusCode) === undefined ? {} : { statusCode: filters.statusCode }),
    sort: toSortParam(sort, filters),
    ...(page > 1 ? { page } : {}),
    size,
    withProgress: true,
    withSummary: true,
  };
};

/**
 * 상태 칩 건수 조회. **상태를 고르지 않았으면 `null`** — 그때는 목록의 요약이 이미 상태 전체를 센 것이라
 * 다시 묻지 않는다. 기간이 막혔을 때도 `null`.
 */
export const toStatusCountQuery = (
  filters: ProgressFilters,
  offsetMinutes: number,
): StatusCountQuery | null => {
  if (filters.statusCode === '') return null;

  const period = resolvePeriod(filters, offsetMinutes);
  if (period.kind !== 'ready') return null;

  return {
    plannedStartFrom: period.bounds.from,
    plannedStartTo: period.bounds.to,
    ...scopeOf(filters),
    size: 1,
    withSummary: true,
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
  replace(next, KEYS.processId, filters.processId.trim());
  replace(next, KEYS.keyword, filters.keyword.trim());
  replace(next, KEYS.page, page > 1 ? String(page) : '');
  // 조건이 바뀌면 앞서 고른 W/O는 목록에 없을 수 있다 — 고른 것을 지우고 다시 고르게 한다.
  next.delete(KEYS.selected);

  return next;
};

/**
 * 기간만 주소에 적는다 — 다른 것은 건드리지 않는다.
 *
 * 주소에 기간이 없이 들어온 첫 화면에서 쓴다. ⛔ **조회를 다시 거는 것이 아니다** — 그래서
 * 쪽도, 고른 W/O 도 비우지 않는다. `?workOrderId=…` 만 담긴 링크를 받아 들어온 사용자에게서
 * **선택을 빼앗지 않으려는 것이다.**
 */
export const withPeriod = (current: URLSearchParams, period: PeriodInput): URLSearchParams => {
  const next = new URLSearchParams(current);

  replace(next, KEYS.from, dateOf(period.from));
  replace(next, KEYS.to, dateOf(period.to));

  return next;
};

export const withSort = (current: URLSearchParams, sort: SortState): URLSearchParams => {
  const next = new URLSearchParams(current);

  replace(next, KEYS.sort, `${sort.key},${sort.direction}`);
  // 순서가 바뀌면 2쪽의 내용이 달라진다 — 첫 쪽으로 되돌린다.
  next.delete(KEYS.page);

  return next;
};

/**
 * 보기를 바꾼다. 표는 기본이라 적지 않는다.
 *
 * 일정 보기는 계획 시작 순으로 다시 받으므로 쪽의 내용이 달라진다 — 첫 쪽으로 되돌린다. 고른 W/O 는 그대로 둔다.
 */
export const withView = (current: URLSearchParams, view: ProgressView): URLSearchParams => {
  const next = new URLSearchParams(current);

  replace(next, KEYS.view, view === 'timeline' ? 'timeline' : '');
  next.delete(KEYS.page);

  return next;
};

export const withPage = (current: URLSearchParams, page: number): URLSearchParams => {
  const next = new URLSearchParams(current);
  replace(next, KEYS.page, page > 1 ? String(page) : '');
  return next;
};

/** 이 화면의 진입 주소(W/O 하나를 골라 연다) — 다른 화면이 「작업지시 열기」로 건다(품질 승인 처리 #193). */
export const WORK_ORDER_PROGRESS_SCREEN_PATH = '/production/work-order-progress';
export const workOrderProgressEntryPath = (workOrderId: number): string =>
  `${WORK_ORDER_PROGRESS_SCREEN_PATH}?${KEYS.selected}=${String(workOrderId)}`;

export const withSelectedWorkOrder = (
  current: URLSearchParams,
  workOrderId: number | null,
): URLSearchParams => {
  const next = new URLSearchParams(current);
  replace(next, KEYS.selected, workOrderId === null ? '' : String(workOrderId));
  return next;
};
