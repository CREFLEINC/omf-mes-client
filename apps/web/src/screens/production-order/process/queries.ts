import type { components } from '@omf-mes/api-client';
import { useQueries, useQuery } from '@tanstack/react-query';

import { useApiClient } from '../../../patterns/api-context';
import { fetchAllPages } from '../../../patterns/fetch-all-pages';
import { runRequest } from '../../../patterns/request';
import { REQUIRED_ASSIGNMENT_FIELDS } from '../../work-order/assignment-model';
import { toValidationReport, toWorkOrderFact, workOrderKeys } from '../../work-order/queries';

type WorkOrder = components['schemas']['WorkOrder'] & {
  routingOperationName?: string;
  productionOrderId?: number;
};

/** ERP W/O 하나에 딸린 배포 전 W/O. 처리 화면의 4M 배정과 배포 확인 단계가 쓴다. */
export interface OrderWorkOrder {
  workOrderId: number;
  workOrderNo: string;
  productionPlanId: number;
  operationName: string;
  orderQty: number;
  uomId: number;
  itemId: number;
  statusCode: string;
  priorityNo: number;
}

/** `work-orders` 접두를 써서 계획 확정, 4M 저장, 배포 뒤의 기존 무효화가 이 목록에도 닿는다. */
export const orderWorkOrderKeys = {
  unreleased: (productionOrderId: number) =>
    ['work-orders', 'by-order', productionOrderId, 'unreleased'] as const,
  all: (productionOrderId: number) =>
    ['work-orders', 'by-order', productionOrderId, 'all'] as const,
};

const toOrderWorkOrder = (item: WorkOrder): OrderWorkOrder => ({
  workOrderId: item.workOrderId,
  workOrderNo: item.workOrderNo,
  productionPlanId: item.productionPlanId,
  operationName: item.routingOperationName ?? '',
  orderQty: item.orderQty,
  uomId: item.uomId,
  itemId: item.itemId,
  statusCode: item.statusCode,
  priorityNo: item.priorityNo,
});

const useOrderWorkOrders = (
  productionOrderId: number | null,
  key: readonly unknown[],
  extra: { released?: false },
) => {
  const { client } = useApiClient();
  return useQuery({
    queryKey: key,
    enabled: productionOrderId !== null,
    queryFn: async () => {
      const result = await fetchAllPages((page, size) =>
        runRequest(() =>
          client.GET('/production/work-orders', {
            params: { query: { productionOrderId: productionOrderId ?? 0, ...extra, page, size } },
          }),
        ),
      );
      return result.items.map((item) => toOrderWorkOrder(item as WorkOrder));
    },
  });
};

export const useUnreleasedWorkOrders = (productionOrderId: number | null) =>
  useOrderWorkOrders(productionOrderId, orderWorkOrderKeys.unreleased(productionOrderId ?? 0), {
    released: false,
  });

/**
 * 배포 전 W/O마다 배포 가능 여부. 상세(라인, 기본 위치 셋)와 점검 결과(차단 지적)로 판정한다. 배포 요청이 실제로 막는 조건과 같다.
 *
 * 목록 필터 `releasable`은 쓰지 않는다. 실측에서 라인과 위치를 모두 채운 W/O를 `releasable=false`로 돌려주면서
 * 배포 요청은 성공했다(요청 목록 .client-dev/requests/w02-requests.md). 대상 하나의 하위 W/O라 W/O 수만큼 부른다.
 */
export interface WorkOrderReadiness {
  workOrderId: number;
  ready: boolean;
  /** 비어 있는 첫 필수 칸. 칸이 다 찼는데 점검이 막으면 null. */
  missingField: (typeof REQUIRED_ASSIGNMENT_FIELDS)[number] | null;
  /** 칸이 다 찼는데 점검이 막으면 그 첫 지적 */
  finding: string | null;
}

export const useWorkOrderReadiness = (workOrders: readonly OrderWorkOrder[] | undefined) => {
  const { client } = useApiClient();
  const ids = (workOrders ?? []).map((item) => item.workOrderId);
  const details = useQueries({
    queries: ids.map((workOrderId) => ({
      queryKey: workOrderKeys.detail(workOrderId),
      queryFn: async () =>
        toWorkOrderFact(
          await runRequest(() =>
            client.GET('/production/work-orders/{workOrderId}', {
              params: { path: { workOrderId } },
            }),
          ),
        ),
    })),
  });
  const validations = useQueries({
    queries: ids.map((workOrderId) => ({
      queryKey: workOrderKeys.validation(workOrderId),
      queryFn: async () =>
        toValidationReport(
          await runRequest(() =>
            client.GET('/production/work-orders/{workOrderId}/validation', {
              params: { path: { workOrderId } },
            }),
          ),
        ),
    })),
  });
  if (
    workOrders === undefined ||
    details.some((q) => q.isPending) ||
    validations.some((q) => q.isPending)
  ) {
    return undefined;
  }
  return ids.map((workOrderId, index): WorkOrderReadiness => {
    const detail = details[index]?.data;
    const report = validations[index]?.data;
    /* 못 받은 W/O는 배포 가능으로 보지 않는다. */
    const missingField =
      detail === undefined
        ? null
        : (REQUIRED_ASSIGNMENT_FIELDS.find((field) => detail[field] === null) ?? null);
    const blockedByCheck =
      report === undefined ||
      !report.passed ||
      report.findings.some((finding) => finding.severity === 'BLOCK');
    return {
      workOrderId,
      ready: detail !== undefined && missingField === null && !blockedByCheck,
      missingField,
      finding: report?.findings.find((item) => item.severity === 'BLOCK')?.message ?? null,
    };
  });
};

export const useAllOrderWorkOrders = (productionOrderId: number | null) =>
  useOrderWorkOrders(productionOrderId, orderWorkOrderKeys.all(productionOrderId ?? 0), {});
