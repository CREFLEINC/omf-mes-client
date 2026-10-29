import type { paths } from '@omf-mes/api-client';

export interface RequestFilters {
  approvalTypeCode: string;
  statusCode: string;
  from: string;
  to: string;
  q: string;
  /** 지금 「나」가 결재할 차례인 요청만(#193 · 계약 `myTurnOnly`). 주소에는 켠 것만 `mt=1` 로 적는다. */
  myTurnOnly?: boolean;
}

type ListQueryParams = NonNullable<paths['/app/approval-requests']['get']['parameters']['query']>;

export interface RequestListQuery {
  assignedToMe: true;
  pendingOnly?: true;
  myTurnOnly?: true;
  /** 계약이 값 목록을 닫았다(코드 사전 2026-09-03). 허용 값은 `allowedCode`가 목록으로 거른다 */
  approvalTypeCode?: ListQueryParams['approvalTypeCode'];
  statusCode?: string;
  requestedAtFrom?: string;
  requestedAtTo?: string;
  q?: string;
  page?: number;
}

const KEYS = {
  approvalTypeCode: 'ty',
  statusCode: 'st',
  from: 'from',
  to: 'to',
  q: 'q',
  pendingOnly: 'pd',
  myTurnOnly: 'mt',
  page: 'page',
  selected: 'approvalRequestId',
} as const;

/**
 * 「결재 대기만 보기」의 기본값 — 꺼짐(전체 조회 · 사용자 지시 2026-10-26 · #186). 주소에는 켠 것만 `pd=1` 로
 * 적는다 — 기본이 켜짐이던 때의 `pd=0` 이 담긴 옛 주소는 기본(전체)과 같게 읽힌다.
 */
export const PENDING_ONLY_DEFAULT = false;
const POSITIVE_INTEGER = /^\d+$/;
const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

const isIdentifier = (raw: string): boolean => {
  const parsed = Number(raw);
  return POSITIVE_INTEGER.test(raw) && Number.isSafeInteger(parsed) && parsed >= 1;
};

const dateOf = (value: string): string => {
  const match = DATE_PATTERN.exec(value);
  if (match === null) return '';

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);

  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day
    ? value
    : '';
};

const allowedCode = (value: string | null, allowed: readonly string[]): string => {
  const code = value?.trim() ?? '';
  return code !== '' && allowed.includes(code) ? code : '';
};

export const EMPTY_FILTERS: RequestFilters = {
  approvalTypeCode: '',
  statusCode: '',
  from: '',
  to: '',
  q: '',
  myTurnOnly: false,
};

export const readFilters = (
  params: URLSearchParams,
  approvalTypeCodes: readonly string[] = [],
  statusCodes: readonly string[] = [],
): RequestFilters => ({
  approvalTypeCode: allowedCode(params.get(KEYS.approvalTypeCode), approvalTypeCodes),
  statusCode: allowedCode(params.get(KEYS.statusCode), statusCodes),
  from: dateOf(params.get(KEYS.from) ?? ''),
  to: dateOf(params.get(KEYS.to) ?? ''),
  q: params.get(KEYS.q) ?? '',
  myTurnOnly: params.get(KEYS.myTurnOnly) === '1',
});

export const readPendingOnly = (params: URLSearchParams): boolean =>
  params.get(KEYS.pendingOnly) === '1' ? true : PENDING_ONLY_DEFAULT;

export const readPage = (params: URLSearchParams): number => {
  const raw = params.get(KEYS.page) ?? '';
  return isIdentifier(raw) ? Number(raw) : 1;
};

export const readSelectedRequestId = (params: URLSearchParams): number | null => {
  const raw = params.get(KEYS.selected) ?? '';
  return isIdentifier(raw) ? Number(raw) : null;
};

const replace = (params: URLSearchParams, key: string, value: string): void => {
  if (value === '') params.delete(key);
  else params.set(key, value);
};

export const toAppliedSearchParams = (
  current: URLSearchParams,
  filters: RequestFilters,
  pendingOnly: boolean,
  page: number,
): URLSearchParams => {
  const next = new URLSearchParams(current);

  replace(next, KEYS.approvalTypeCode, filters.approvalTypeCode.trim());
  replace(next, KEYS.statusCode, filters.statusCode.trim());
  replace(next, KEYS.from, dateOf(filters.from));
  replace(next, KEYS.to, dateOf(filters.to));
  replace(next, KEYS.q, filters.q.trim());
  replace(next, KEYS.myTurnOnly, filters.myTurnOnly === true ? '1' : '');
  replace(next, KEYS.pendingOnly, pendingOnly === PENDING_ONLY_DEFAULT ? '' : '1');
  replace(next, KEYS.page, page > 1 ? String(page) : '');
  next.delete(KEYS.selected);

  return next;
};

export const withSelectedRequest = (
  current: URLSearchParams,
  approvalRequestId: number | null,
): URLSearchParams => {
  const next = new URLSearchParams(current);
  replace(next, KEYS.selected, approvalRequestId === null ? '' : String(approvalRequestId));
  return next;
};

export const toRequestListQuery = (
  filters: RequestFilters,
  pendingOnly: boolean,
  page: number,
): RequestListQuery => {
  const q = filters.q.trim();
  const from = dateOf(filters.from);
  const to = dateOf(filters.to);

  return {
    assignedToMe: true,
    ...(pendingOnly ? { pendingOnly: true } : {}),
    ...(filters.myTurnOnly === true ? { myTurnOnly: true } : {}),
    ...(filters.approvalTypeCode === ''
      ? {}
      : { approvalTypeCode: filters.approvalTypeCode as ListQueryParams['approvalTypeCode'] }),
    ...(filters.statusCode === '' ? {} : { statusCode: filters.statusCode }),
    ...(from === '' ? {} : { requestedAtFrom: from }),
    ...(to === '' ? {} : { requestedAtTo: to }),
    ...(q === '' ? {} : { q }),
    ...(page > 1 ? { page } : {}),
  };
};
