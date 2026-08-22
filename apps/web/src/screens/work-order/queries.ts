import type { components } from '@omf-mes/api-client';
import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { useApiClient } from '../../patterns/api-context';
import { runRequest } from '../../patterns/request';

type WorkOrder = components['schemas']['WorkOrder'];
type ValidationFinding = components['schemas']['ValidationFinding'];

export interface WorkOrderFact {
  workOrderId: number;
  workOrderNo: string;
  productionPlanId: number;
  routingOperationId: number;
  itemId: number;
  orderQty: number;
  uomId: number;
  workOrderTypeCode: string;
  priorityNo: number;
  statusCode: string;
  productionLineId: number | null;
  responsibleWorkerId: number | null;
  plannedStartAt: string | null;
  plannedEndAt: string | null;
  plannedEquipmentId: number | null;
  plannedMoldId: number | null;
  plannedShiftId: number | null;
  remarks: string | null;
}

export interface WorkOrderListResponse {
  items: WorkOrderFact[];
  page: components['schemas']['PageMeta'];
}

export interface WorkOrderValidationFinding {
  severity: ValidationFinding['severity'];
  field: string | null;
  code: string;
  message: string;
}

export interface WorkOrderValidationReport {
  passed: boolean;
  findings: WorkOrderValidationFinding[];
}

export const workOrderKeys = {
  all: ['work-orders'] as const,
  list: (productionPlanId: number | null, page: number) =>
    ['work-orders', 'list', productionPlanId, page] as const,
  detail: (workOrderId: number | null) => ['work-orders', 'detail', workOrderId] as const,
  validation: (workOrderId: number | null) => ['work-orders', 'validation', workOrderId] as const,
};

export const toWorkOrderFact = (workOrder: WorkOrder): WorkOrderFact => ({
  workOrderId: workOrder.workOrderId,
  workOrderNo: workOrder.workOrderNo,
  productionPlanId: workOrder.productionPlanId,
  routingOperationId: workOrder.routingOperationId,
  itemId: workOrder.itemId,
  orderQty: workOrder.orderQty,
  uomId: workOrder.uomId,
  workOrderTypeCode: workOrder.workOrderTypeCode,
  priorityNo: workOrder.priorityNo,
  statusCode: workOrder.statusCode,
  productionLineId: workOrder.productionLineId ?? null,
  responsibleWorkerId: workOrder.responsibleWorkerId ?? null,
  plannedStartAt: workOrder.plannedStartAt ?? null,
  plannedEndAt: workOrder.plannedEndAt ?? null,
  plannedEquipmentId: workOrder.plannedEquipmentId ?? null,
  plannedMoldId: workOrder.plannedMoldId ?? null,
  plannedShiftId: workOrder.plannedShiftId ?? null,
  remarks: workOrder.remarks ?? null,
});

const toValidationReport = (
  report: components['schemas']['ValidationReport'],
): WorkOrderValidationReport => ({
  passed: report.passed,
  findings: report.findings.map((finding) => ({
    severity: finding.severity,
    field: finding.field ?? null,
    code: finding.code,
    message: finding.message,
  })),
});

export const useWorkOrderList = (
  productionPlanId: number | null,
  page: number,
): UseQueryResult<WorkOrderListResponse> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: workOrderKeys.list(productionPlanId, page),
    enabled: productionPlanId !== null,
    queryFn: async () => {
      if (productionPlanId === null) {
        throw new Error('A production plan is required to list work orders.');
      }

      const data = await runRequest(() =>
        client.GET('/production/work-orders', { params: { query: { productionPlanId, page } } }),
      );
      return { items: data.items.map(toWorkOrderFact), page: data.page };
    },
  });
};

export const useWorkOrderDetail = (workOrderId: number | null): UseQueryResult<WorkOrderFact> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: workOrderKeys.detail(workOrderId),
    enabled: workOrderId !== null,
    queryFn: async () => {
      if (workOrderId === null) {
        throw new Error('A work order is required to load its detail.');
      }

      return toWorkOrderFact(
        await runRequest(() =>
          client.GET('/production/work-orders/{workOrderId}', {
            params: { path: { workOrderId } },
          }),
        ),
      );
    },
  });
};

export const useWorkOrderValidation = (
  workOrderId: number | null,
): UseQueryResult<WorkOrderValidationReport> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: workOrderKeys.validation(workOrderId),
    enabled: workOrderId !== null,
    queryFn: async () => {
      if (workOrderId === null) {
        throw new Error('A work order is required to load validation.');
      }

      return toValidationReport(
        await runRequest(() =>
          client.GET('/production/work-orders/{workOrderId}/validation', {
            params: { path: { workOrderId } },
          }),
        ),
      );
    },
  });
};
