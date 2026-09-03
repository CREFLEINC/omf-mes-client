import type { paths } from '@omf-mes/api-client';

/**
 * 조회 조건과 선택 — **주소가 정본이다.** 새로고침·뒤로가기·링크 공유가 같은 화면을 다시 세운다.
 *
 * | 키 | 뜻 |
 * | --- | --- |
 * | `cust` | 고객(거래처 번호) |
 * | `from` · `to` | 출하일 기간 — 비울 수 없다(L-3). 주소에 없으면 최근 한 달 |
 * | `q` | 출하번호·LOT 번호 검색어 |
 * | `page` | 쪽 |
 * | `shipment` | 고른 원 출하 |
 * | `mode=direct` | 원 출하 없이 등록 |
 *
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 파일을 참조하지 않는다.
 */

export const RETURN_RECEIPT_SCREEN_PATH = '/shipment/return-receipts';

export interface SearchFilters {
  customerId: string;
  from: string;
  to: string;
  q: string;
}

export type ShipmentListQuery = NonNullable<
  paths['/logistics/shipments']['get']['parameters']['query']
>;

const KEYS = {
  customer: 'cust',
  from: 'from',
  to: 'to',
  q: 'q',
  page: 'page',
  shipment: 'shipment',
  mode: 'mode',
} as const;

const DIRECT_MODE = 'direct';

const pad = (value: number): string => String(value).padStart(2, '0');

export const toDateString = (date: Date): string =>
  `${String(date.getFullYear())}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** 달력에 실제로 있는 날인가 — `2026-02-31` 은 모양은 맞지만 없는 날이다. */
export const isDate = (value: string): boolean => {
  if (!DATE_PATTERN.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  if (year === undefined || month === undefined || day === undefined) return false;
  const date = new Date(year, month - 1, day);

  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
};

/** 기본 기간 — 최근 한 달. 반품은 출하 뒤 며칠에서 몇 주 사이에 돌아온다. */
export const defaultPeriod = (today: Date): { from: string; to: string } => {
  const from = new Date(today.getFullYear(), today.getMonth() - 1, today.getDate());
  return { from: toDateString(from), to: toDateString(today) };
};

const isId = (value: string): boolean => /^\d+$/.test(value);

export const readFilters = (params: URLSearchParams, today: Date): SearchFilters => {
  const from = params.get(KEYS.from) ?? '';
  const to = params.get(KEYS.to) ?? '';
  const period = from === '' && to === '' ? defaultPeriod(today) : { from, to };
  const customer = params.get(KEYS.customer) ?? '';

  return {
    customerId: isId(customer) ? customer : '',
    from: period.from,
    to: period.to,
    q: params.get(KEYS.q) ?? '',
  };
};

export const isUsable = (filters: SearchFilters): boolean =>
  isDate(filters.from) && isDate(filters.to) && filters.from <= filters.to;

export const readPage = (params: URLSearchParams): number => {
  const value = Number(params.get(KEYS.page) ?? '1');
  return Number.isInteger(value) && value >= 1 ? value : 1;
};

/** 조회 조건. **기간이 못 쓸 값이면 `null`** — 기간 없이는 부르지 않는다(L-3). */
export const toListQuery = (filters: SearchFilters, page: number): ShipmentListQuery | null => {
  if (!isUsable(filters)) return null;

  return {
    shipDateFrom: filters.from,
    shipDateTo: filters.to,
    ...(filters.customerId === '' ? {} : { customerId: Number(filters.customerId) }),
    ...(filters.q.trim() === '' ? {} : { q: filters.q.trim() }),
    ...(page > 1 ? { page } : {}),
  };
};

export type Selection =
  { kind: 'none' } | { kind: 'shipment'; shipmentId: number } | { kind: 'direct' };

export const readSelection = (params: URLSearchParams): Selection => {
  if (params.get(KEYS.mode) === DIRECT_MODE) return { kind: 'direct' };
  const shipment = params.get(KEYS.shipment) ?? '';
  return isId(shipment) ? { kind: 'shipment', shipmentId: Number(shipment) } : { kind: 'none' };
};

export const withSelection = (current: URLSearchParams, selection: Selection): URLSearchParams => {
  const next = new URLSearchParams(current);
  next.delete(KEYS.shipment);
  next.delete(KEYS.mode);
  if (selection.kind === 'shipment') next.set(KEYS.shipment, String(selection.shipmentId));
  if (selection.kind === 'direct') next.set(KEYS.mode, DIRECT_MODE);

  return next;
};

/** 조건을 적용한다 — **고른 출하는 지운다.** 새 목록에 없을 수 있다. 직접 입력 모드는 남긴다. */
export const toAppliedSearchParams = (
  current: URLSearchParams,
  filters: SearchFilters,
  page: number,
): URLSearchParams => {
  const next = new URLSearchParams(current);
  const set = (key: string, value: string): void => {
    if (value === '') next.delete(key);
    else next.set(key, value);
  };
  set(KEYS.customer, filters.customerId);
  set(KEYS.from, filters.from);
  set(KEYS.to, filters.to);
  set(KEYS.q, filters.q.trim());
  set(KEYS.page, page > 1 ? String(page) : '');
  next.delete(KEYS.shipment);

  return next;
};
