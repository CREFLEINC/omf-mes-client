export interface ProductionOrderFilters {
  q: string;
  plant: string;
  item: string;
  status: string;
  dueFrom: string;
  dueTo: string;
}

export const DEFAULT_PRODUCTION_ORDER_FILTERS: ProductionOrderFilters = {
  q: '',
  plant: '',
  item: '',
  status: '',
  dueFrom: '',
  dueTo: '',
};

const keys = {
  q: 'q',
  plant: 'plant',
  item: 'item',
  status: 'status',
  dueFrom: 'dueFrom',
  dueTo: 'dueTo',
  page: 'page',
  selection: 'sel',
} as const;
const datePattern = /^(\d{4})-(\d{2})-(\d{2})$/;

const id = (value: string): string => {
  if (!/^\d+$/.test(value)) return '';
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? String(parsed) : '';
};

const date = (value: string): string => {
  const match = datePattern.exec(value);
  if (match === null) return '';
  const parsed = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value ? '' : value;
};

const text = (value: string): string => value.trim();

export const readFilters = (params: URLSearchParams): ProductionOrderFilters => ({
  q: text(params.get(keys.q) ?? ''),
  plant: id(params.get(keys.plant) ?? ''),
  item: id(params.get(keys.item) ?? ''),
  status: text(params.get(keys.status) ?? ''),
  dueFrom: date(params.get(keys.dueFrom) ?? ''),
  dueTo: date(params.get(keys.dueTo) ?? ''),
});

export const readPage = (params: URLSearchParams): number => {
  const value = id(params.get(keys.page) ?? '');
  return value === '' ? 1 : Number(value);
};

export const readSelectedProductionOrderId = (params: URLSearchParams): number | null => {
  const value = id(params.get(keys.selection) ?? '');
  return value === '' ? null : Number(value);
};

export const toSearchParams = (filters: ProductionOrderFilters, page: number): URLSearchParams => {
  const next = new URLSearchParams();
  const entries = [
    [keys.q, text(filters.q)],
    [keys.plant, id(filters.plant)],
    [keys.item, id(filters.item)],
    [keys.status, text(filters.status)],
    [keys.dueFrom, date(filters.dueFrom)],
    [keys.dueTo, date(filters.dueTo)],
  ] as const;
  entries.forEach(([key, value]) => value !== '' && next.set(key, value));
  if (Number.isSafeInteger(page) && page > 1) next.set(keys.page, String(page));
  return next;
};

export interface ProductionOrderFilterQuery {
  q?: string;
  plantId?: number;
  itemId?: number;
  statusCode?: string;
  dueDateFrom?: string;
  dueDateTo?: string;
  page?: number;
}

export const toFilterQuery = (
  filters: ProductionOrderFilters,
  page: number,
): ProductionOrderFilterQuery => {
  const valid = readFilters(toSearchParams(filters, 1));
  return {
    ...(valid.q === '' ? {} : { q: valid.q }),
    ...(valid.plant === '' ? {} : { plantId: Number(valid.plant) }),
    ...(valid.item === '' ? {} : { itemId: Number(valid.item) }),
    ...(valid.status === '' ? {} : { statusCode: valid.status }),
    ...(valid.dueFrom === '' ? {} : { dueDateFrom: valid.dueFrom }),
    ...(valid.dueTo === '' ? {} : { dueDateTo: valid.dueTo }),
    ...(Number.isSafeInteger(page) && page > 1 ? { page } : {}),
  };
};

export const toSelectionSearchParams = (
  current: URLSearchParams,
  selection: number | null,
): URLSearchParams => {
  const next = toSearchParams(readFilters(current), readPage(current));
  if (selection !== null && Number.isSafeInteger(selection) && selection > 0) {
    next.set(keys.selection, String(selection));
  }
  return next;
};
