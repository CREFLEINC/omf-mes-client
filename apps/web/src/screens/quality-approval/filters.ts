export interface RequestFilters {
  approvalTypeCode: string;
  statusCode: string;
  from: string;
  to: string;
  q: string;
}

export interface RequestListQuery {
  assignedToMe: true;
  pendingOnly?: true;
  approvalTypeCode?: string;
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
  page: 'page',
  selected: 'approvalRequestId',
} as const;

export const PENDING_ONLY_DEFAULT = true;
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
});

export const readPendingOnly = (params: URLSearchParams): boolean =>
  params.get(KEYS.pendingOnly) === '0' ? false : PENDING_ONLY_DEFAULT;

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
  replace(next, KEYS.pendingOnly, pendingOnly === PENDING_ONLY_DEFAULT ? '' : '0');
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
    ...(filters.approvalTypeCode === '' ? {} : { approvalTypeCode: filters.approvalTypeCode }),
    ...(filters.statusCode === '' ? {} : { statusCode: filters.statusCode }),
    ...(from === '' ? {} : { requestedAtFrom: from }),
    ...(to === '' ? {} : { requestedAtTo: to }),
    ...(q === '' ? {} : { q }),
    ...(page > 1 ? { page } : {}),
  };
};
