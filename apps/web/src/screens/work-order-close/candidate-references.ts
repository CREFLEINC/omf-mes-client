import { messages } from '@omf-mes/i18n';
import { useQueries, useQuery } from '@tanstack/react-query';

import { useApiClient } from '../../patterns/api-context';
import { runRequest, toApiError } from '../../patterns/request';

const t = messages.workOrderClose.candidateReferences;

export type WorkOrderCloseItemReference =
  | { itemId: number; status: 'loading' | 'unknown' | 'failed'; label: null }
  | { itemId: number; status: 'named'; label: string };

export interface WorkOrderCloseItemNamesResult {
  items: WorkOrderCloseItemReference[];
  isLoading: boolean;
  refetch: () => void;
}

export interface WorkOrderCloseUomEntry {
  uomId: number;
  label: string;
}

export interface WorkOrderCloseUomReferenceSource {
  entries: readonly WorkOrderCloseUomEntry[];
  isLoading: boolean;
  isError: boolean;
  truncated: boolean;
}

export interface WorkOrderCloseUomLookupResult extends WorkOrderCloseUomReferenceSource {
  entries: WorkOrderCloseUomEntry[];
  refetch: () => void;
}

export type WorkOrderCloseUomReference =
  | { kind: 'failed' }
  | { kind: 'loading' }
  | { kind: 'named'; label: string }
  | { kind: 'truncated' }
  | { kind: 'unknown' };

export const candidateReferenceKeys = {
  item: (itemId: number) => ['work-order-close', 'candidate-references', 'item', itemId] as const,
  uoms: ['work-order-close', 'candidate-references', 'uoms'] as const,
};

const isNotFound = (error: unknown): boolean => {
  const apiError = toApiError(error);
  return apiError.kind === 'http' && apiError.status === 404;
};

export const useWorkOrderCloseItemNames = (
  itemIds: readonly number[],
): WorkOrderCloseItemNamesResult => {
  const { client } = useApiClient();
  const uniqueIds = [...new Set(itemIds)];
  const results = useQueries({
    queries: uniqueIds.map((itemId) => ({
      queryKey: candidateReferenceKeys.item(itemId),
      queryFn: () =>
        runRequest(() => client.GET('/mdm/items/{itemId}', { params: { path: { itemId } } })),
    })),
  });

  return {
    items: results.map((result, index): WorkOrderCloseItemReference => {
      const itemId = uniqueIds[index] as number;
      if (result.isPending) return { itemId, status: 'loading', label: null };
      if (result.isError)
        return { itemId, status: isNotFound(result.error) ? 'unknown' : 'failed', label: null };
      if (result.data !== undefined) {
        const { itemCode, itemName } = result.data.item;
        return { itemId, status: 'named', label: `${itemCode} · ${itemName}` };
      }
      return { itemId, status: 'failed', label: null };
    }),
    isLoading: results.some((result) => result.isPending),
    refetch: () => {
      void Promise.all(results.map((result) => result.refetch()));
    },
  };
};

export const useWorkOrderCloseUomLookup = (): WorkOrderCloseUomLookupResult => {
  const { client } = useApiClient();
  const query = useQuery({
    queryKey: candidateReferenceKeys.uoms,
    queryFn: () =>
      runRequest(() => client.GET('/mdm/uoms', { params: { query: { includeInactive: true } } })),
  });
  const data = query.data;

  return {
    entries:
      data?.items.map((uom) => ({
        uomId: uom.uomId,
        label: `${uom.uomCode} · ${uom.uomName}`,
      })) ?? [],
    isLoading: query.isPending,
    isError: query.isError,
    truncated: data !== undefined && data.page.total > data.items.length,
    refetch: () => {
      void query.refetch();
    },
  };
};

export const describeWorkOrderCloseItemReference = (
  reference: WorkOrderCloseItemReference,
): string => {
  switch (reference.status) {
    case 'loading':
      return t.item.loading;
    case 'named':
      return reference.label;
    case 'unknown':
      return t.item.unknown;
    case 'failed':
      return t.item.failed;
  }
};

export const resolveWorkOrderCloseUomReference = (
  source: WorkOrderCloseUomReferenceSource,
  uomId: number,
): WorkOrderCloseUomReference => {
  if (source.isError) return { kind: 'failed' };
  if (source.isLoading) return { kind: 'loading' };

  const label = source.entries.find((entry) => entry.uomId === uomId)?.label;
  if (label !== undefined) return { kind: 'named', label };
  if (source.truncated) return { kind: 'truncated' };
  return { kind: 'unknown' };
};

const describeWorkOrderCloseUomReference = (reference: WorkOrderCloseUomReference): string => {
  switch (reference.kind) {
    case 'failed':
      return t.uom.failed;
    case 'loading':
      return t.uom.loading;
    case 'named':
      return reference.label;
    case 'truncated':
      return t.uom.truncated;
    case 'unknown':
      return t.uom.unknown;
  }
};

export const toWorkOrderCloseQuantityLabel = (
  orderQty: number,
  uom: WorkOrderCloseUomReference,
): string => `${String(orderQty)} ${describeWorkOrderCloseUomReference(uom)}`;
