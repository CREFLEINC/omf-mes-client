import type { components } from '@omf-mes/api-client';
import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { useApiClient } from '../../patterns/api-context';
import { runRequest } from '../../patterns/request';
import { toWorkOrderFact, type WorkOrderFact } from '../work-order/queries';

type WorkOrder = components['schemas']['WorkOrder'];
type PageMeta = components['schemas']['PageMeta'];

export interface WorkOrderReleaseFact extends WorkOrderFact {
  defaultWipLocationId: number | null;
  defaultFgLocationId: number | null;
  defaultScrapLocationId: number | null;
  operationSettingsSnapshot: WorkOrder['operationSettingsSnapshot'] | null;
  releasedAt: string | null;
}

export interface WorkOrderReleaseFilters {
  statusCode: string | null;
  productionLineId: number | null;
  plannedStartFrom: string | null;
  plannedStartTo: string | null;
  page: number;
}

export interface WorkOrderReleaseCandidatesResponse {
  items: WorkOrderReleaseFact[];
  page: PageMeta;
}

export const workOrderReleaseKeys = {
  all: ['work-order-release'] as const,
  candidates: (filters: WorkOrderReleaseFilters) =>
    [
      'work-order-release',
      'candidates',
      filters.statusCode,
      filters.productionLineId,
      filters.plannedStartFrom,
      filters.plannedStartTo,
      filters.page,
    ] as const,
  detail: (workOrderId: number | null) => ['work-order-release', 'detail', workOrderId] as const,
};

export const workOrderReleaseDetailPath = (workOrderId: number): string =>
  `/production/work-orders/${workOrderId}`;

export const toWorkOrderReleaseFact = (workOrder: WorkOrder): WorkOrderReleaseFact => ({
  ...toWorkOrderFact(workOrder),
  defaultWipLocationId: workOrder.defaultWipLocationId ?? null,
  defaultFgLocationId: workOrder.defaultFgLocationId ?? null,
  defaultScrapLocationId: workOrder.defaultScrapLocationId ?? null,
  operationSettingsSnapshot: workOrder.operationSettingsSnapshot ?? null,
  releasedAt: workOrder.releasedAt ?? null,
});

export const useWorkOrderReleaseCandidates = (
  filters: WorkOrderReleaseFilters,
): UseQueryResult<WorkOrderReleaseCandidatesResponse> => {
  const { client } = useApiClient();
  const statusCode = filters.statusCode;

  return useQuery({
    queryKey: workOrderReleaseKeys.candidates(filters),
    enabled: statusCode !== null,
    queryFn: async () => {
      if (statusCode === null) {
        throw new Error('A status code is required to load release candidates.');
      }

      const data = await runRequest(() =>
        client.GET('/production/work-orders', {
          params: {
            query: {
              statusCode,
              ...(filters.productionLineId === null
                ? {}
                : { productionLineId: filters.productionLineId }),
              ...(filters.plannedStartFrom === null
                ? {}
                : { plannedStartFrom: filters.plannedStartFrom }),
              ...(filters.plannedStartTo === null
                ? {}
                : { plannedStartTo: filters.plannedStartTo }),
              page: filters.page,
            },
          },
        }),
      );

      return { items: data.items.map(toWorkOrderReleaseFact), page: data.page };
    },
  });
};

export const useWorkOrderReleaseDetail = (
  workOrderId: number | null,
): UseQueryResult<WorkOrderReleaseFact> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: workOrderReleaseKeys.detail(workOrderId),
    enabled: workOrderId !== null,
    queryFn: async () => {
      if (workOrderId === null) {
        throw new Error('A work order is required to load release detail.');
      }

      return toWorkOrderReleaseFact(
        await runRequest(() =>
          client.GET('/production/work-orders/{workOrderId}', {
            params: { path: { workOrderId } },
          }),
        ),
      );
    },
  });
};
