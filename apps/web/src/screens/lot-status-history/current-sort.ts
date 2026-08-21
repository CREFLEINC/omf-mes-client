import type { SortState } from '@crefle/web-ui';

import { DEFAULT_LOT_SORT, type LotStatusSort } from './filters';

const TABLE_SORTS: Record<LotStatusSort, SortState> = {
  lotNoAsc: { key: 'lotNo', direction: 'ascending' },
  lotNoDesc: { key: 'lotNo', direction: 'descending' },
  itemAsc: { key: 'item', direction: 'ascending' },
  itemDesc: { key: 'item', direction: 'descending' },
  latestTransitionAsc: { key: 'latestTransitionAt', direction: 'ascending' },
  latestTransitionDesc: { key: 'latestTransitionAt', direction: 'descending' },
};

export const toTableSort = (sort: LotStatusSort): SortState => TABLE_SORTS[sort];

export const toLotStatusSort = (sort: SortState | null): LotStatusSort => {
  if (sort === null) return DEFAULT_LOT_SORT;
  const suffix = sort.direction === 'ascending' ? 'Asc' : 'Desc';
  if (sort.key === 'lotNo') return `lotNo${suffix}`;
  if (sort.key === 'item') return `item${suffix}`;
  if (sort.key === 'latestTransitionAt') return `latestTransition${suffix}`;
  return DEFAULT_LOT_SORT;
};
