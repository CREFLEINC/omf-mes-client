import type {
  MaterialIssueDisplayStatus,
  MaterialIssueRequestListQueryForward,
} from '@omf-mes/api-client';

import { DISPLAY_STATUSES } from './status';

/** 조회 조건 — 모두 주소가 갖는다(새로고침 · 뒤로가기 · 공유가 같은 결과). */
export interface StatusFilters {
  plant: string;
  workFrom: string;
  workTo: string;
  prodFrom: string;
  prodTo: string;
  q: string;
  warehouse: string;
  /** 비어 있으면 전부다. */
  statuses: MaterialIssueDisplayStatus[];
  shortageOnly: boolean;
  failedOnly: boolean;
  groupByPlan: boolean;
}

export type StatusView = 'list' | 'shortage';

export const EMPTY_FILTERS: StatusFilters = {
  plant: '',
  workFrom: '',
  workTo: '',
  prodFrom: '',
  prodTo: '',
  q: '',
  warehouse: '',
  statuses: [],
  shortageOnly: false,
  failedOnly: false,
  groupByPlan: false,
};

const KEYS = {
  plant: 'plant',
  workFrom: 'wfrom',
  workTo: 'wto',
  prodFrom: 'pfrom',
  prodTo: 'pto',
  q: 'q',
  warehouse: 'wh',
  statuses: 'st',
  shortageOnly: 'short',
  failedOnly: 'failed',
  groupByPlan: 'group',
} as const;

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const ID = /^[1-9]\d*$/;

const readDate = (value: string | null): string =>
  value !== null && DATE.test(value) ? value : '';
const readId = (value: string | null): string => (value !== null && ID.test(value) ? value : '');

export const readView = (params: URLSearchParams): StatusView =>
  params.get('view') === 'shortage' ? 'shortage' : 'list';

export const readSelectedId = (params: URLSearchParams): number | null => {
  const id = readId(params.get('id'));
  return id === '' ? null : Number(id);
};

export const readFilters = (params: URLSearchParams): StatusFilters => ({
  plant: readId(params.get(KEYS.plant)),
  workFrom: readDate(params.get(KEYS.workFrom)),
  workTo: readDate(params.get(KEYS.workTo)),
  prodFrom: readDate(params.get(KEYS.prodFrom)),
  prodTo: readDate(params.get(KEYS.prodTo)),
  q: params.get(KEYS.q)?.trim() ?? '',
  warehouse: readId(params.get(KEYS.warehouse)),
  statuses: params
    .getAll(KEYS.statuses)
    .filter((value): value is MaterialIssueDisplayStatus =>
      DISPLAY_STATUSES.includes(value as MaterialIssueDisplayStatus),
    ),
  shortageOnly: params.get(KEYS.shortageOnly) === '1',
  failedOnly: params.get(KEYS.failedOnly) === '1',
  groupByPlan: params.get(KEYS.groupByPlan) === '1',
});

/** 기본값은 주소에 적지 않는다. 고른 요청(`id`)과 쪽은 조건이 바뀌면 비운다. */
export const toSearchParams = (
  view: StatusView,
  filters: StatusFilters,
  page = 1,
): URLSearchParams => {
  const params = new URLSearchParams();
  if (view === 'shortage') params.set('view', 'shortage');
  for (const key of [
    'plant',
    'workFrom',
    'workTo',
    'prodFrom',
    'prodTo',
    'q',
    'warehouse',
  ] as const) {
    if (filters[key] !== '') params.set(KEYS[key], filters[key]);
  }
  for (const status of filters.statuses) params.append(KEYS.statuses, status);
  if (filters.shortageOnly) params.set(KEYS.shortageOnly, '1');
  if (filters.failedOnly) params.set(KEYS.failedOnly, '1');
  if (filters.groupByPlan) params.set(KEYS.groupByPlan, '1');
  if (page > 1) params.set('page', String(page));
  return params;
};

/** 계약 조건(계약 §1). 묶음 보기는 화면만의 일이라 싣지 않는다. */
export const toListQuery = (
  filters: StatusFilters,
  page: number,
  size: number,
): MaterialIssueRequestListQueryForward => ({
  ...(filters.plant === '' ? {} : { plantId: Number(filters.plant) }),
  ...(filters.workFrom === '' ? {} : { issueWorkDateFrom: filters.workFrom }),
  ...(filters.workTo === '' ? {} : { issueWorkDateTo: filters.workTo }),
  ...(filters.prodFrom === '' ? {} : { productionDateFrom: filters.prodFrom }),
  ...(filters.prodTo === '' ? {} : { productionDateTo: filters.prodTo }),
  ...(filters.q === '' ? {} : { q: filters.q }),
  ...(filters.warehouse === '' ? {} : { sourceWarehouseId: Number(filters.warehouse) }),
  ...(filters.statuses.length === 0 ? {} : { displayStatus: [...filters.statuses] }),
  ...(filters.shortageOnly ? { hasShortage: true } : {}),
  ...(filters.failedOnly ? { releaseFailed: true } : {}),
  page,
  size,
});
