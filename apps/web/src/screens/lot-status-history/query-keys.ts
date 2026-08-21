import type { HistoryFilters, LotFilters } from './filters';

type QueryKey = readonly unknown[];

const ROOT_KEY = 'lot-status-history';

type LotScopeFilters = Omit<LotFilters, 'sort'>;

const copyLotScope = (filters: LotFilters): LotScopeFilters => ({
  lotType: filters.lotType,
  q: filters.q,
  item: filters.item,
  status: filters.status,
  warehouse: filters.warehouse,
  location: filters.location,
});

const copyLotListFilters = (filters: LotFilters): LotFilters => ({
  ...copyLotScope(filters),
  sort: filters.sort,
});

const copyHistoryFilters = (filters: HistoryFilters): HistoryFilters => ({
  from: filters.from,
  to: filters.to,
  actor: filters.actor,
  lot: filters.lot,
});

export const lotStatusKeys = {
  summary: (filters: LotFilters): QueryKey => [ROOT_KEY, 'summary', copyLotScope(filters)],
  list: (filters: LotFilters, page: number): QueryKey => [
    ROOT_KEY,
    'list',
    copyLotListFilters(filters),
    page,
  ],
  detail: (lotId: number | null): QueryKey => [ROOT_KEY, 'detail', lotId],
  holds: (lotId: number | null, page = 1): QueryKey => [ROOT_KEY, 'holds', lotId, page],
  actors: [ROOT_KEY, 'actors'] as const,
  history: (filters: HistoryFilters, page: number, offsetMinutes: number): QueryKey => [
    ROOT_KEY,
    'history',
    copyHistoryFilters(filters),
    page,
    offsetMinutes,
  ],
};
