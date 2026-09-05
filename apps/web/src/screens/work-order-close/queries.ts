import type { components } from '@omf-mes/api-client';
import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { useApiClient } from '../../patterns/api-context';
import { runRequest } from '../../patterns/request';
import { toWorkOrderFact, type WorkOrderFact } from '../work-order/queries';
import { toProductionResultRow, type ProductionResultRow } from './result-correction-model';

type WorkOrder = components['schemas']['WorkOrder'];
type WorkOrderProgress = components['schemas']['WorkOrderProgress'];
type PreIssuedLotSummary = components['schemas']['PreIssuedLotSummary'];
type PageMeta = components['schemas']['PageMeta'];
type OutboundItemSetting = components['schemas']['OutboundItemSetting'];
type CodeValue = components['schemas']['CodeValue'];
type ProductionOrder = components['schemas']['ProductionOrder'];
type ProductionResult = components['schemas']['ProductionResult'];
type Worker = components['schemas']['Worker'];

const LOOKUP_PAGE_SIZE = 200;

export interface WorkOrderCloseFact extends WorkOrderFact {
  completedAt: string | null;
  completionVarianceReasonCode: string | null;
  closedAt: string | null;
}

export interface WorkOrderCloseDetailFact extends WorkOrderCloseFact {
  progress: WorkOrderProgress | null;
  preIssuedLots: PreIssuedLotSummary | null;
}

export interface WorkOrderCloseFilters {
  statusCode: string | null;
  productionOrderId: number | null;
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

export interface WorkOrderCloseCodeValue {
  code: string;
  codeName: string;
  displayOrder: number;
  isActive: boolean;
}

export interface WorkOrderCloseProductionOrder {
  productionOrderId: number;
  productionOrderNo: string;
}

export interface WorkOrderCloseLookupList<T> {
  items: T[];
  truncated: boolean;
}

export interface WorkOrderCloseWorker {
  workerId: number;
  workerName: string;
}

export const workOrderCloseKeys = {
  all: ['work-order-close'] as const,
  candidates: (filters: WorkOrderCloseFilters) =>
    [
      'work-order-close',
      'candidates',
      filters.statusCode,
      filters.productionOrderId,
      filters.plannedStartFrom,
      filters.plannedStartTo,
      filters.page,
    ] as const,
  detail: (workOrderId: number | null) => ['work-order-close', 'detail', workOrderId] as const,
  openSession: (workOrderId: number | null) =>
    ['work-order-close', 'open-session', workOrderId] as const,
  outboundItemSettings: () => ['work-order-close', 'outbound-item-settings'] as const,
  productionOrders: () => ['work-order-close', 'lookups', 'production-orders'] as const,
  codeValues: (codeGroupCode: string) =>
    ['work-order-close', 'lookups', 'code-values', codeGroupCode] as const,
  results: (workOrderId: number | null) =>
    ['work-order-close', 'production-results', workOrderId] as const,
  workers: () => ['work-order-close', 'lookups', 'workers'] as const,
};

export const workOrderCloseDetailPath = (workOrderId: number): string =>
  `/production/work-orders/${workOrderId}`;

export const toWorkOrderCloseFact = (workOrder: WorkOrder): WorkOrderCloseFact => ({
  ...toWorkOrderFact(workOrder),
  completedAt: workOrder.completedAt ?? null,
  completionVarianceReasonCode: workOrder.completionVarianceReasonCode ?? null,
  closedAt: workOrder.closedAt ?? null,
});

export const toWorkOrderCloseDetailFact = (workOrder: WorkOrder): WorkOrderCloseDetailFact => ({
  ...toWorkOrderCloseFact(workOrder),
  progress: workOrder.progress === undefined ? null : { ...workOrder.progress },
  preIssuedLots: workOrder.preIssuedLots === undefined ? null : { ...workOrder.preIssuedLots },
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
              ...(filters.productionOrderId === null
                ? {}
                : { productionOrderId: filters.productionOrderId }),
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
): UseQueryResult<WorkOrderCloseDetailFact> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: workOrderCloseKeys.detail(workOrderId),
    enabled: workOrderId !== null,
    queryFn: async () => {
      if (workOrderId === null) {
        throw new Error('A work order is required to load close detail.');
      }

      return toWorkOrderCloseDetailFact(
        await runRequest(() =>
          client.GET('/production/work-orders/{workOrderId}', {
            params: {
              path: { workOrderId },
              query: { withProgress: true, withPreIssuedLots: true },
            },
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

const isTruncated = (page: PageMeta, shown: number): boolean => page.total > shown;

export const useWorkOrderCloseProductionOrders = (): UseQueryResult<
  WorkOrderCloseLookupList<WorkOrderCloseProductionOrder>
> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: workOrderCloseKeys.productionOrders(),
    queryFn: async () => {
      const data = await runRequest(() =>
        client.GET('/planning/production-orders', {
          params: { query: { page: 1, size: LOOKUP_PAGE_SIZE } },
        }),
      );

      return {
        items: data.items.map((order: ProductionOrder) => ({
          productionOrderId: order.productionOrderId,
          productionOrderNo: order.productionOrderNo,
        })),
        truncated: isTruncated(data.page, data.items.length),
      };
    },
  });
};

export const useWorkOrderCloseCodeValues = (
  codeGroupCode: string,
): UseQueryResult<WorkOrderCloseLookupList<WorkOrderCloseCodeValue>> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: workOrderCloseKeys.codeValues(codeGroupCode),
    queryFn: async () => {
      const data = await runRequest(() =>
        client.GET('/mdm/code-values', {
          params: { query: { codeGroupCode, page: 1, size: LOOKUP_PAGE_SIZE } },
        }),
      );

      return {
        items: data.items.map((value: CodeValue) => ({
          code: value.code,
          codeName: value.codeName,
          displayOrder: value.displayOrder,
          isActive: value.isActive,
        })),
        truncated: isTruncated(data.page, data.items.length),
      };
    },
  });
};

export const useWorkOrderCloseProductionResults = (
  workOrderId: number | null,
): UseQueryResult<WorkOrderCloseLookupList<ProductionResultRow>> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: workOrderCloseKeys.results(workOrderId),
    enabled: workOrderId !== null,
    queryFn: async () => {
      if (workOrderId === null) throw new Error('A work order is required to load results.');

      const data = await runRequest(() =>
        client.GET('/production/production-results', {
          params: { query: { workOrderId, page: 1, size: LOOKUP_PAGE_SIZE } },
        }),
      );

      return {
        items: data.items.map((result: ProductionResult) => toProductionResultRow(result)),
        truncated: isTruncated(data.page, data.items.length),
      };
    },
  });
};

export const useWorkOrderCloseWorkers = (): UseQueryResult<
  WorkOrderCloseLookupList<WorkOrderCloseWorker>
> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: workOrderCloseKeys.workers(),
    queryFn: async () => {
      const data = await runRequest(() =>
        client.GET('/mdm/workers', {
          params: { query: { includeInactive: true, page: 1, size: LOOKUP_PAGE_SIZE } },
        }),
      );

      return {
        items: data.items.map((worker: Worker) => ({
          workerId: worker.workerId,
          workerName: worker.workerName,
        })),
        truncated: isTruncated(data.page, data.items.length),
      };
    },
  });
};
