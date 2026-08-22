import { messages } from '@omf-mes/i18n';
import { useQuery } from '@tanstack/react-query';

import { useApiClient } from '../../patterns/api-context';
import { runRequest } from '../../patterns/request';
import type { PageMeta, SelectOption } from './types';

const t = messages.productionOrder;

export interface ReferenceSource {
  entries: readonly SelectOption[];
  isLoading: boolean;
  isError: boolean;
  truncated: boolean;
}

export interface ReferenceLookupResult extends ReferenceSource {
  entries: SelectOption[];
  refetch: () => void;
}

export type ReferenceState =
  | { kind: 'failed' }
  | { kind: 'loading' }
  | { kind: 'named'; label: string }
  | { kind: 'truncated' }
  | { kind: 'unknown' };

interface ListResponse<T> {
  items: T[];
  page: PageMeta;
}

interface LookupQuery<T> {
  data: ListResponse<T> | undefined;
  isError: boolean;
  isPending: boolean;
  refetch: () => Promise<unknown>;
}

const EMPTY_ENTRIES: SelectOption[] = [];

const isTruncated = (page: PageMeta, shown: number): boolean => page.total > shown;

const toLookupResult = <T>(
  query: LookupQuery<T>,
  toEntry: (item: T) => SelectOption,
): ReferenceLookupResult => {
  const data = query.data;

  return {
    entries: data?.items.map(toEntry) ?? EMPTY_ENTRIES,
    isLoading: query.isPending,
    isError: query.isError,
    truncated: data !== undefined && isTruncated(data.page, data.items.length),
    refetch: () => {
      void query.refetch();
    },
  };
};

export const productionOrderReferenceKeys = {
  plants: ['production-order-reference-lookups', 'plants'] as const,
  uoms: ['production-order-reference-lookups', 'uoms'] as const,
};

export const usePlantReferenceLookup = (): ReferenceLookupResult => {
  const { client } = useApiClient();
  const query = useQuery({
    queryKey: productionOrderReferenceKeys.plants,
    queryFn: () =>
      runRequest(() => client.GET('/mdm/plants', { params: { query: { includeInactive: true } } })),
  });

  return toLookupResult(query, (plant) => ({
    value: String(plant.plantId),
    label: `${plant.plantCode} · ${plant.plantName}`,
  }));
};

export const useUomReferenceLookup = (): ReferenceLookupResult => {
  const { client } = useApiClient();
  const query = useQuery({
    queryKey: productionOrderReferenceKeys.uoms,
    queryFn: () =>
      runRequest(() => client.GET('/mdm/uoms', { params: { query: { includeInactive: true } } })),
  });

  return toLookupResult(query, (uom) => ({
    value: String(uom.uomId),
    label: `${uom.uomCode} · ${uom.uomName}`,
  }));
};

export const resolveReference = (
  source: ReferenceSource,
  id: number | null | undefined,
): ReferenceState => {
  if (id === null || id === undefined) return { kind: 'unknown' };
  if (source.isError) return { kind: 'failed' };
  if (source.isLoading) return { kind: 'loading' };

  const label = source.entries.find((entry) => entry.value === String(id))?.label;

  if (label !== undefined) return { kind: 'named', label };
  if (source.truncated) return { kind: 'truncated' };

  return { kind: 'unknown' };
};

export const describeReference = (state: ReferenceState): string => {
  switch (state.kind) {
    case 'failed':
      return t.values.referenceFailed;
    case 'loading':
      return t.values.referenceLoading;
    case 'named':
      return state.label;
    case 'truncated':
      return t.values.referenceTruncated;
    case 'unknown':
      return t.values.referenceUnknown;
  }
};

export const lookupNote = (source: ReferenceSource): string | undefined => {
  if (source.isError) return t.values.referenceFailed;
  if (source.isLoading) return t.values.referenceLoading;
  if (source.truncated) return t.values.referenceTruncated;

  return undefined;
};
