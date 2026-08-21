export type ScreenMode = 'lot' | 'history';

export interface LotFilters {
  lotType: string;
  q: string;
  item: string;
  status: string;
  warehouse: string;
  location: string;
}

export interface HistoryFilters {
  from: string;
  to: string;
  actor: string;
  lot: string;
}

export const EMPTY_LOT_FILTERS: LotFilters = {
  lotType: '',
  q: '',
  item: '',
  status: '',
  warehouse: '',
  location: '',
};

export const EMPTY_HISTORY_FILTERS: HistoryFilters = { from: '', to: '', actor: '', lot: '' };

const URL_KEYS = {
  mode: 'mode',
  lotType: 'lotType',
  q: 'q',
  item: 'item',
  status: 'status',
  warehouse: 'warehouse',
  location: 'location',
  lotPage: 'page',
  selectedLot: 'lot',
  historyFrom: 'from',
  historyTo: 'to',
  historyActor: 'actor',
  historyLot: 'historyLot',
  historyPage: 'historyPage',
} as const;

const POSITIVE_INTEGER = /^\d+$/;
const FIRST_PAGE = 1;

const readPositiveIntegerString = (raw: string | null): string => {
  if (raw === null || !POSITIVE_INTEGER.test(raw)) return '';
  const value = Number(raw);
  return Number.isSafeInteger(value) && value >= 1 ? raw : '';
};

const readPositiveInteger = (raw: string | null): number | null => {
  const value = readPositiveIntegerString(raw);
  return value === '' ? null : Number(value);
};

export const readMode = (params: URLSearchParams): ScreenMode =>
  params.get(URL_KEYS.mode) === 'history' ? 'history' : 'lot';

export const readLotFilters = (params: URLSearchParams): LotFilters => ({
  lotType: params.get(URL_KEYS.lotType) ?? '',
  q: params.get(URL_KEYS.q) ?? '',
  item: readPositiveIntegerString(params.get(URL_KEYS.item)),
  status: params.get(URL_KEYS.status) ?? '',
  warehouse: readPositiveIntegerString(params.get(URL_KEYS.warehouse)),
  location: readPositiveIntegerString(params.get(URL_KEYS.location)),
});

export const readHistoryFilters = (params: URLSearchParams): HistoryFilters => ({
  from: params.get(URL_KEYS.historyFrom) ?? '',
  to: params.get(URL_KEYS.historyTo) ?? '',
  actor: readPositiveIntegerString(params.get(URL_KEYS.historyActor)),
  lot: readPositiveIntegerString(params.get(URL_KEYS.historyLot)),
});

export const readLotPage = (params: URLSearchParams): number =>
  readPositiveInteger(params.get(URL_KEYS.lotPage)) ?? FIRST_PAGE;

export const readHistoryPage = (params: URLSearchParams): number =>
  readPositiveInteger(params.get(URL_KEYS.historyPage)) ?? FIRST_PAGE;

export const readSelectedLotId = (params: URLSearchParams): number | null =>
  readPositiveInteger(params.get(URL_KEYS.selectedLot));

const setOrDelete = (params: URLSearchParams, key: string, value: string): void => {
  if (value === '') params.delete(key);
  else params.set(key, value);
};

const setPage = (params: URLSearchParams, key: string, page: number): void => {
  if (Number.isSafeInteger(page) && page > FIRST_PAGE) params.set(key, String(page));
  else params.delete(key);
};

export const toModeSearchParams = (current: URLSearchParams, mode: ScreenMode): URLSearchParams => {
  const next = new URLSearchParams(current);
  if (mode === 'history') next.set(URL_KEYS.mode, mode);
  else next.delete(URL_KEYS.mode);
  next.delete(URL_KEYS.selectedLot);
  return next;
};

export const toAppliedLotSearchParams = (
  current: URLSearchParams,
  filters: LotFilters,
  page: number,
): URLSearchParams => {
  const next = new URLSearchParams(current);
  setOrDelete(next, URL_KEYS.lotType, filters.lotType);
  setOrDelete(next, URL_KEYS.q, filters.q);
  setOrDelete(next, URL_KEYS.item, filters.item);
  setOrDelete(next, URL_KEYS.status, filters.status);
  setOrDelete(next, URL_KEYS.warehouse, filters.warehouse);
  setOrDelete(next, URL_KEYS.location, filters.location);
  setPage(next, URL_KEYS.lotPage, page);
  next.delete(URL_KEYS.selectedLot);
  return next;
};

export const toAppliedHistorySearchParams = (
  current: URLSearchParams,
  filters: HistoryFilters,
  page: number,
): URLSearchParams => {
  const next = new URLSearchParams(current);
  setOrDelete(next, URL_KEYS.historyFrom, filters.from);
  setOrDelete(next, URL_KEYS.historyTo, filters.to);
  setOrDelete(next, URL_KEYS.historyActor, filters.actor);
  setOrDelete(next, URL_KEYS.historyLot, filters.lot);
  setPage(next, URL_KEYS.historyPage, page);
  return next;
};

export const withSelectedLot = (
  current: URLSearchParams,
  lotId: number | null,
): URLSearchParams => {
  const next = new URLSearchParams(current);
  if (lotId !== null && Number.isSafeInteger(lotId) && lotId >= 1) {
    next.set(URL_KEYS.selectedLot, String(lotId));
  } else {
    next.delete(URL_KEYS.selectedLot);
  }
  return next;
};
