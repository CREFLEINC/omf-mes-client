import type { components } from '@omf-mes/api-client';
import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { useApiClient } from '../../patterns/api-context';
import { runRequest } from '../../patterns/request';
import { toWorkOrderFact, type WorkOrderFact } from '../work-order/queries';

type WorkOrder = components['schemas']['WorkOrder'];
type PageMeta = components['schemas']['PageMeta'];
type OutboundItemSetting = components['schemas']['OutboundItemSetting'];

export interface WorkOrderCloseFact extends WorkOrderFact {
  completedAt: string | null;
  completionVarianceReasonCode: string | null;
  closedAt: string | null;
}

export interface WorkOrderCloseFilters {
  statusCode: string | null;
  productionPlanId: number | null;
  plannedStartFrom: string | null;
  plannedStartTo: string | null;
  page: number;
}

export interface WorkOrderCloseCandidatesResponse {
  items: WorkOrderCloseFact[];
  page: PageMeta;
}

export interface WorkOrderCloseOpenSessionState {
  hasOpenSession: boolean;
}

export interface WorkOrderCloseOutboundItemSetting {
  outboundItemCode: OutboundItemSetting['outboundItemCode'];
  outboundItemName: string;
  enabled: boolean;
  locked: boolean;
  lockReason: string | null;
  sendTimingNote: string | null;
}

export const workOrderCloseKeys = {
  all: ['work-order-close'] as const,
  candidates: (filters: WorkOrderCloseFilters) =>
    [
      'work-order-close',
      'candidates',
      filters.statusCode,
      filters.productionPlanId,
      filters.plannedStartFrom,
      filters.plannedStartTo,
      filters.page,
    ] as const,
  detail: (workOrderId: number | null) => ['work-order-close', 'detail', workOrderId] as const,
  openSession: (workOrderId: number | null) =>
    ['work-order-close', 'open-session', workOrderId] as const,
  outboundItemSettings: () => ['work-order-close', 'outbound-item-settings'] as const,
};

export const workOrderCloseDetailPath = (workOrderId: number): string =>
  `/production/work-orders/${workOrderId}`;

export const toWorkOrderCloseFact = (workOrder: WorkOrder): WorkOrderCloseFact => ({
  ...toWorkOrderFact(workOrder),
  completedAt: workOrder.completedAt ?? null,
  completionVarianceReasonCode: workOrder.completionVarianceReasonCode ?? null,
  closedAt: workOrder.closedAt ?? null,
});

export const useWorkOrderCloseCandidates = (
  filters: WorkOrderCloseFilters,
): UseQueryResult<WorkOrderCloseCandidatesResponse> => {
  const { client } = useApiClient();
  const statusCode = filters.statusCode;

  return useQuery({
    queryKey: workOrderCloseKeys.candidates(filters),
    enabled: statusCode !== null,
    queryFn: async () => {
      if (statusCode === null) {
        throw new Error('A status code is required to load close candidates.');
      }

      const data = await runRequest(() =>
        client.GET('/production/work-orders', {
          params: {
            query: {
              statusCode,
              ...(filters.productionPlanId === null
                ? {}
                : { productionPlanId: filters.productionPlanId }),
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

      return { items: data.items.map(toWorkOrderCloseFact), page: data.page };
    },
  });
};

export const useWorkOrderCloseDetail = (
  workOrderId: number | null,
): UseQueryResult<WorkOrderCloseFact> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: workOrderCloseKeys.detail(workOrderId),
    enabled: workOrderId !== null,
    queryFn: async () => {
      if (workOrderId === null) {
        throw new Error('A work order is required to load close detail.');
      }

      return toWorkOrderCloseFact(
        await runRequest(() =>
          client.GET('/production/work-orders/{workOrderId}', {
            params: { path: { workOrderId } },
          }),
        ),
      );
    },
  });
};

export const useWorkOrderCloseOpenSession = (
  workOrderId: number | null,
): UseQueryResult<WorkOrderCloseOpenSessionState> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: workOrderCloseKeys.openSession(workOrderId),
    enabled: workOrderId !== null,
    queryFn: async () => {
      if (workOrderId === null) {
        throw new Error('A work order is required to load its open session state.');
      }

      const data = await runRequest(() =>
        client.GET('/production/work-sessions', {
          params: { query: { open: true, workOrderId, page: 1, size: 1 } },
        }),
      );

      return { hasOpenSession: data.items.length > 0 };
    },
  });
};

export const useWorkOrderCloseOutboundItemSettings = (): UseQueryResult<
  WorkOrderCloseOutboundItemSetting[]
> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: workOrderCloseKeys.outboundItemSettings(),
    queryFn: async () => {
      const data = await runRequest(() => client.GET('/integration/outbound-item-settings'));

      return data.items.map((item) => ({
        outboundItemCode: item.outboundItemCode,
        outboundItemName: item.outboundItemName,
        enabled: item.enabled,
        locked: item.locked,
        lockReason: item.lockReason ?? null,
        sendTimingNote: item.sendTimingNote ?? null,
      }));
    },
  });
};
