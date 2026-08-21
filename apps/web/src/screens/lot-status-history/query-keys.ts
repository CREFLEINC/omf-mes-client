import type { HistoryFilters, LotFilters } from './filters';

type QueryKey = readonly unknown[];

const ROOT_KEY = 'lot-status-history';

const copyLotFilters = (filters: LotFilters): LotFilters => ({
  lotType: filters.lotType,
  q: filters.q,
  item: filters.item,
  status: filters.status,
  warehouse: filters.warehouse,
  location: filters.location,
});

const copyHistoryFilters = (filters: HistoryFilters): HistoryFilters => ({
  from: filters.from,
  to: filters.to,
  actor: filters.actor,
  lot: filters.lot,
});

export const lotStatusKeys = {
  summary: (filters: LotFilters): QueryKey => [ROOT_KEY, 'summary', copyLotFilters(filters)],
  list: (filters: LotFilters, page: number): QueryKey => [
    ROOT_KEY,
    'list',
    copyLotFilters(filters),
    page,
  ],
  detail: (lotId: number | null): QueryKey => [ROOT_KEY, 'detail', lotId],
  holds: (lotId: number | null): QueryKey => [ROOT_KEY, 'holds', lotId],
  history: (filters: HistoryFilters, page: number): QueryKey => [
    ROOT_KEY,
    'history',
    copyHistoryFilters(filters),
    page,
  ],
};
