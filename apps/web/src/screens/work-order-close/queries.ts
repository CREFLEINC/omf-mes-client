import type { components, WorkOrderForward, WorkSessionForward } from '@omf-mes/api-client';
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
  closeDispositionCode: 'CARRY_OVER' | 'WRITE_OFF' | null;
  /** POP 마감일 때만 있다 */
  closedWorkerNo: string | null;
  closedWorkerName: string | null;
  /** 관리웹 마감일 때만 있다 */
  closedByUserName: string | null;
  closeJudgmentCode: 'UNDER' | 'NORMAL' | 'OVER' | null;
  voidedLotCount: number | null;
}

export interface WorkOrderCloseDetailFact extends WorkOrderCloseFact {
  progress: WorkOrderProgress | null;
  preIssuedLots: PreIssuedLotSummary | null;
}

export interface WorkOrderCloseFilters {
  statusCode: string | null;
  completionJudgmentCode: string | null;
  productionOrderId: number | null;
  plannedStartFrom: string | null;
  plannedStartTo: string | null;
  page: number;
}

/** 목록 줄도 진척을 싣는다 — 미달 건을 열어 보지 않고 찾게 한다. */
export interface WorkOrderCloseCandidateFact extends WorkOrderCloseFact {
  progress: WorkOrderProgress | null;
}

export interface WorkOrderCloseCandidatesResponse {
  items: WorkOrderCloseCandidateFact[];
  page: PageMeta;
}

/** 마감을 막는 열린 세션 한 건 — 어느 단말에서 끝낼지 알리는 데 쓴다. */
export interface WorkOrderCloseOpenSessionView {
  workSessionId: number;
  terminalCode: string | null;
  workerName: string | null;
  workerNo: string | null;
  startedAt: string;
  statusCode: string;
}

export interface WorkOrderCloseOpenSessionState {
  hasOpenSession: boolean;
  sessions: WorkOrderCloseOpenSessionView[];
}

const OPEN_SESSION_PAGE_SIZE = 20;

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
  /** 다국어 표시명. 표시명은 고른 언어의 이 칸이 먼저고 `codeName`이 fallback이다(G-33). */
  nameKo?: string | null;
  nameVi?: string | null;
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
      filters.completionJudgmentCode,
      filters.productionOrderId,
      filters.plannedStartFrom,
      filters.plannedStartTo,
      filters.page,
    ] as const,
  detail: (workOrderId: number | null) => ['work-order-close', 'detail', workOrderId] as const,
  openSession: (workOrderId: number | null) =>
    ['work-order-close', 'open-session', workOrderId] as const,
  openLots: (workOrderId: number | null) => ['work-order-close', 'open-lots', workOrderId] as const,
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

export const toWorkOrderCloseFact = (workOrder: WorkOrderForward): WorkOrderCloseFact => ({
  ...toWorkOrderFact(workOrder),
  completedAt: workOrder.completedAt ?? null,
  completionVarianceReasonCode: workOrder.completionVarianceReasonCode ?? null,
  closedAt: workOrder.closedAt ?? null,
  closeDispositionCode: workOrder.closeDispositionCode ?? null,
  closedWorkerNo: workOrder.closedWorkerNo ?? null,
  closedWorkerName: workOrder.closedWorkerName ?? null,
  closedByUserName: workOrder.closedByUserName ?? null,
  closeJudgmentCode: workOrder.closeJudgmentCode ?? null,
  voidedLotCount: workOrder.voidedLotCount ?? null,
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
              ...(filters.completionJudgmentCode === null
                ? {}
                : {
                    completionJudgmentCode: filters.completionJudgmentCode as
                      'UNDER' | 'NORMAL' | 'OVER',
                  }),
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

      return {
        items: data.items.map((item) => ({
          ...toWorkOrderCloseFact(item),
          progress: item.progress === undefined ? null : { ...item.progress },
        })),
        page: data.page,
      };
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
          params: { query: { open: true, workOrderId, page: 1, size: OPEN_SESSION_PAGE_SIZE } },
        }),
      );
      const items = data.items as WorkSessionForward[];

      return {
        hasOpenSession: items.length > 0,
        sessions: items.map((session) => ({
          workSessionId: session.workSessionId,
          terminalCode: session.terminalCode ?? null,
          workerName: session.workerName ?? null,
          workerNo: session.workerNo ?? null,
          startedAt: session.startedAt,
          statusCode: session.statusCode,
        })),
      };
    },
  });
};

/** 진행 중(실적이 붙었고 아직 완료되지 않은) LOT. 쪽을 넘긴 나머지는 건수로만 안다. */
export interface WorkOrderCloseOpenLots {
  lotNos: string[];
  /** 받은 쪽 밖에 더 있을 수 있는 미완료 LOT 수. 진행 중인지는 모른다 */
  uncheckedCount: number;
}

const OPEN_LOT_PAGE_SIZE = 100;

/*
 * 마감은 진행 중 LOT 을 막지 않는다(서버도 보지 않는다) — 그 LOT 이 그대로 남는다는 사실을
 * 확인 창에서 알리려고 읽는다. 실적 없는 대기 슬롯은 마감 때 폐번되므로 여기서 뺀다.
 */
export const useWorkOrderCloseOpenLots = (
  workOrderId: number | null,
): UseQueryResult<WorkOrderCloseOpenLots> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: workOrderCloseKeys.openLots(workOrderId),
    enabled: workOrderId !== null,
    queryFn: async () => {
      if (workOrderId === null) {
        throw new Error('A work order is required to load its open LOTs.');
      }

      const data = await runRequest(() =>
        client.GET('/trace/lots', {
          params: {
            query: { workOrderId, completed: false, page: 1, size: OPEN_LOT_PAGE_SIZE },
          },
        }),
      );

      return {
        lotNos: data.items
          .filter((lot) => lot.lifecycleStatusCode === 'ACTIVE')
          .map((lot) => lot.lotNo),
        uncheckedCount: Math.max(0, data.page.total - data.items.length),
      };
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
          nameKo: value.nameKo ?? null,
          nameVi: value.nameVi ?? null,
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
