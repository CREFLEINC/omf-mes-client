import {
  defaultPeriod,
  isPeriodDate,
  periodLockReason,
  resolvePeriod,
  type PeriodInput,
} from './period';

export interface PendingFilters extends PeriodInput {
  itemId: string;
  severityCode: string;
  statusCode: string;
}

export interface PendingListQuery {
  openedFrom: string;
  openedTo: string;
  itemId?: number;
  severityCode?: string;
  statusCode?: string;
  page?: number;
}

export type ScreenTab = 'pending' | 'history';

/**
 * 주소에 실리는 이름.
 *
 * ⭐ `nonconformanceId`만 줄여 쓰지 않는다 — **W-03-09의 「부적합 열기」가 이 이름으로 들어온다**
 * (진입 규약 omf-mes#194 §3). 나머지는 이 화면 안에서만 쓰이므로 짧게 둔다.
 */
const KEYS = {
  from: 'from',
  to: 'to',
  itemId: 'item',
  severityCode: 'sev',
  statusCode: 'st',
  page: 'page',
  tab: 'tab',
  selected: 'nonconformanceId',
} as const;

const POSITIVE_INTEGER = /^\d+$/;

const isIdentifier = (raw: string): boolean => {
  const parsed = Number(raw);
  return POSITIVE_INTEGER.test(raw) && Number.isSafeInteger(parsed) && parsed >= 1;
};

const identifierOf = (raw: string | null): string => {
  const value = raw?.trim() ?? '';
  return isIdentifier(value) ? value : '';
};

const allowedCode = (value: string | null, allowed: readonly string[]): string => {
  const code = value?.trim() ?? '';
  return code !== '' && allowed.includes(code) ? code : '';
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
export const readPendingFilters = (
  params: URLSearchParams,
  today: Date,
  severityCodes: readonly string[] = [],
  statusCodes: readonly string[] = [],
): PendingFilters => {
  const from = dateOf(params.get(KEYS.from));
  const to = dateOf(params.get(KEYS.to));
  const fallback = defaultPeriod(today);
  const period = periodLockReason({ from, to }) === null ? { from, to } : fallback;

  return {
    ...period,
    itemId: identifierOf(params.get(KEYS.itemId)),
    severityCode: allowedCode(params.get(KEYS.severityCode), severityCodes),
    statusCode: allowedCode(params.get(KEYS.statusCode), statusCodes),
  };
};

export const readPage = (params: URLSearchParams): number => {
  const raw = params.get(KEYS.page) ?? '';
  return isIdentifier(raw) ? Number(raw) : 1;
};

export const readTab = (params: URLSearchParams): ScreenTab =>
  params.get(KEYS.tab) === 'history' ? 'history' : 'pending';

/** ⭐ W-03-09에서 넘어온 진입 키. 값이 식별자가 아니면 고른 것이 없는 상태로 둔다. */
export const readSelectedNonconformanceId = (params: URLSearchParams): number | null => {
  const raw = identifierOf(params.get(KEYS.selected));
  return raw === '' ? null : Number(raw);
};

const replace = (params: URLSearchParams, key: string, value: string): void => {
  if (value === '') params.delete(key);
  else params.set(key, value);
};

export const toAppliedSearchParams = (
  current: URLSearchParams,
  filters: PendingFilters,
  page: number,
): URLSearchParams => {
  const next = new URLSearchParams(current);

  replace(next, KEYS.from, dateOf(filters.from));
  replace(next, KEYS.to, dateOf(filters.to));
  replace(next, KEYS.itemId, filters.itemId.trim());
  replace(next, KEYS.severityCode, filters.severityCode.trim());
  replace(next, KEYS.statusCode, filters.statusCode.trim());
  replace(next, KEYS.page, page > 1 ? String(page) : '');
  // 조건이 바뀌면 앞서 고른 부적합은 목록에 없을 수 있다 — 고른 것을 지우고 다시 고르게 한다.
  next.delete(KEYS.selected);

  return next;
};

export const withSelectedNonconformance = (
  current: URLSearchParams,
  nonconformanceId: number | null,
): URLSearchParams => {
  const next = new URLSearchParams(current);
  replace(next, KEYS.selected, nonconformanceId === null ? '' : String(nonconformanceId));
  return next;
};

export const withTab = (current: URLSearchParams, tab: ScreenTab): URLSearchParams => {
  const next = new URLSearchParams(current);
  replace(next, KEYS.tab, tab === 'history' ? 'history' : '');
  // 탭마다 목록이 다르다 — 쪽과 고른 부적합을 그대로 물려주면 없는 자리를 가리킨다.
  next.delete(KEYS.page);
  next.delete(KEYS.selected);
  return next;
};

/**
 * 판정 대기 목록의 조회 조건. **기간은 언제나 실린다**(L-3) — 나머지는 고른 것만 싣는다.
 * 빈 문자열을 그대로 보내면 서버가 「빈 코드로 거른다」로 읽는다.
 *
 * ⭐ **기간이 막히면 `null`을 돌려 조회 자체를 열지 않는다.** `readPendingFilters`가 기본 기간을
 * 심으므로 실제로는 닿기 어렵지만, 타입이 그 경우를 처리하게 강제해야 「막았는데 요청은 나가는」
 * 상태가 생기지 않는다.
 */
export const toPendingListQuery = (
  filters: PendingFilters,
  page: number,
  offsetMinutes: number,
): PendingListQuery | null => {
  const period = resolvePeriod({ from: filters.from, to: filters.to }, offsetMinutes);
  if (period.kind === 'blocked') return null;

  return {
    openedFrom: period.bounds.from,
    openedTo: period.bounds.to,
    ...(filters.itemId === '' ? {} : { itemId: Number(filters.itemId) }),
    ...(filters.severityCode === '' ? {} : { severityCode: filters.severityCode }),
    ...(filters.statusCode === '' ? {} : { statusCode: filters.statusCode }),
    ...(page > 1 ? { page } : {}),
  };
};
