import type {
  MaterialIssueRequestListQuery,
  ReplenishmentArrivalListQuery,
  ReplenishmentItemListQuery,
  ReplenishmentOriginCode,
} from './api-types';
import { FILTER_STATUSES, SERVER_STATUS, type ReplenishmentStatus } from './types';

/** 보기 — 주소 `?view=`(screens/W-02-12.md 「진입」). */
export type ReplenishmentView = 'request' | 'progress' | 'arrival' | 'items';

const VIEWS: readonly ReplenishmentView[] = ['request', 'progress', 'arrival', 'items'];

/** 도착 대기 조건(계약 §2 arrivals). */
export interface ArrivalFilters {
  warehouse: string;
  from: string;
  to: string;
}

export const EMPTY_ARRIVAL: ArrivalFilters = { warehouse: '', from: '', to: '' };

export interface ProgressFilters {
  warehouse: string;
  item: string;
  origin: '' | ReplenishmentOriginCode;
  /** 비어 있으면 전부다. */
  statuses: ReplenishmentStatus[];
  from: string;
  to: string;
}

export interface ItemFilters {
  warehouse: string;
  item: string;
  source: string;
  belowOnly: boolean;
}

export const EMPTY_PROGRESS: ProgressFilters = {
  warehouse: '',
  item: '',
  origin: '',
  statuses: [],
  from: '',
  to: '',
};

export const EMPTY_ITEMS: ItemFilters = { warehouse: '', item: '', source: '', belowOnly: false };

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const ID = /^[1-9]\d*$/;
const readDate = (value: string | null): string =>
  value !== null && DATE.test(value) ? value : '';
const readId = (value: string | null): string => (value !== null && ID.test(value) ? value : '');

export const readView = (params: URLSearchParams): ReplenishmentView => {
  const view = params.get('view');
  return VIEWS.includes(view as ReplenishmentView) ? (view as ReplenishmentView) : 'request';
};

export const readPlant = (params: URLSearchParams): string => readId(params.get('plant'));

export const readSelectedId = (params: URLSearchParams): number | null => {
  const id = readId(params.get('id'));
  return id === '' ? null : Number(id);
};

export const readPage = (params: URLSearchParams): number => {
  const page = Number(params.get('page'));
  return Number.isInteger(page) && page > 1 ? page : 1;
};

export const readProgress = (params: URLSearchParams): ProgressFilters => {
  const origin = params.get('origin');
  return {
    warehouse: readId(params.get('pw')),
    item: readId(params.get('item')),
    origin: origin === 'DIRECT' || origin === 'AUTO' ? origin : '',
    statuses: params
      .getAll('st')
      .filter((value): value is ReplenishmentStatus =>
        FILTER_STATUSES.includes(value as ReplenishmentStatus),
      ),
    from: readDate(params.get('from')),
    to: readDate(params.get('to')),
  };
};

export const readArrival = (params: URLSearchParams): ArrivalFilters => ({
  warehouse: readId(params.get('aw')),
  from: readDate(params.get('afrom')),
  to: readDate(params.get('ato')),
});

export const readItems = (params: URLSearchParams): ItemFilters => ({
  warehouse: readId(params.get('ipw')),
  item: readId(params.get('iitem')),
  source: readId(params.get('isrc')),
  belowOnly: params.get('below') === '1',
});

export interface ScreenState {
  view: ReplenishmentView;
  plant: string;
  progress: ProgressFilters;
  arrival: ArrivalFilters;
  items: ItemFilters;
  page: number;
  id: number | null;
}

/** 기본값은 주소에 적지 않는다. */
export const toSearchParams = (state: ScreenState): URLSearchParams => {
  const params = new URLSearchParams();
  if (state.view !== 'request') params.set('view', state.view);
  if (state.plant !== '') params.set('plant', state.plant);
  const p = state.progress;
  if (p.warehouse !== '') params.set('pw', p.warehouse);
  if (p.item !== '') params.set('item', p.item);
  if (p.origin !== '') params.set('origin', p.origin);
  for (const status of p.statuses) params.append('st', status);
  if (p.from !== '') params.set('from', p.from);
  if (p.to !== '') params.set('to', p.to);
  const a = state.arrival;
  if (a.warehouse !== '') params.set('aw', a.warehouse);
  if (a.from !== '') params.set('afrom', a.from);
  if (a.to !== '') params.set('ato', a.to);
  const i = state.items;
  if (i.warehouse !== '') params.set('ipw', i.warehouse);
  if (i.item !== '') params.set('iitem', i.item);
  if (i.source !== '') params.set('isrc', i.source);
  if (i.belowOnly) params.set('below', '1');
  if (state.page > 1) params.set('page', String(state.page));
  if (state.id !== null) params.set('id', String(state.id));
  return params;
};

/** 진행 목록 조건(계약 §1). 상태는 서버 `replenishmentStatus` 로 거른다 — 쪽 나눔이 맞게. */
export const toProgressQuery = (
  plantId: number,
  filters: ProgressFilters,
  page: number,
  size: number,
): MaterialIssueRequestListQuery => {
  const statuses = filters.statuses
    .filter((status): status is Exclude<ReplenishmentStatus, 'WAITING'> => status !== 'WAITING')
    .map((status) => SERVER_STATUS[status]);
  return {
    requestTypeCode: 'REPLENISHMENT',
    plantId,
    ...(filters.warehouse === '' ? {} : { destinationWarehouseId: Number(filters.warehouse) }),
    ...(filters.item === '' ? {} : { itemId: Number(filters.item) }),
    ...(filters.origin === '' ? {} : { replenishmentOriginCode: filters.origin }),
    ...(statuses.length === 0 ? {} : { replenishmentStatus: statuses }),
    ...(filters.from === '' ? {} : { issueWorkDateFrom: filters.from }),
    ...(filters.to === '' ? {} : { issueWorkDateTo: filters.to }),
    page,
    size,
  };
};

export const toItemQuery = (
  plantId: number,
  filters: ItemFilters,
  page: number,
  size: number,
): ReplenishmentItemListQuery => ({
  plantId,
  ...(filters.warehouse === '' ? {} : { productionWarehouseId: Number(filters.warehouse) }),
  ...(filters.item === '' ? {} : { itemId: Number(filters.item) }),
  ...(filters.source === '' ? {} : { sourceWarehouseId: Number(filters.source) }),
  ...(filters.belowOnly ? { belowPointOnly: true } : {}),
  page,
  size,
});

export const toArrivalQuery = (
  plantId: number,
  filters: ArrivalFilters,
  page: number,
  size: number,
): ReplenishmentArrivalListQuery => ({
  plantId,
  ...(filters.warehouse === '' ? {} : { productionWarehouseId: Number(filters.warehouse) }),
  ...(filters.from === '' ? {} : { goodsIssuedFrom: filters.from }),
  ...(filters.to === '' ? {} : { goodsIssuedTo: filters.to }),
  page,
  size,
});
