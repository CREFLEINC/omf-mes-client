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
  /* 005 FR-035 — 입하 LOT 조건은 걸렸을 때만 열쇠에 싣는다(걸리지 않은 열쇠 모양은 그대로). */
  ...((filters.inboundLotNo ?? '') === '' ? {} : { inboundLotNo: filters.inboundLotNo }),
  ...((filters.inboundLot ?? '') === '' ? {} : { inboundLot: filters.inboundLot }),
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
  list: (filters: LotFilters, page: number, size: number): QueryKey => [
    ROOT_KEY,
    'list',
    copyLotListFilters(filters),
    page,
    size,
  ],
  detail: (lotId: number | null): QueryKey => [ROOT_KEY, 'detail', lotId],
  holds: (lotId: number | null, page = 1): QueryKey => [ROOT_KEY, 'holds', lotId, page],
  actors: [ROOT_KEY, 'actors'] as const,
  history: (filters: HistoryFilters, offsetMinutes: number): QueryKey => [
    ROOT_KEY,
    'history',
    copyHistoryFilters(filters),
    offsetMinutes,
  ],
  lotTimeline: (lotId: number): QueryKey => [ROOT_KEY, 'lot-timeline', lotId],
};
