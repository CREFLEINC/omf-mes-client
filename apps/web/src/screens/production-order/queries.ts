import type { components } from '@omf-mes/api-client';
import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { useApiClient } from '../../patterns/api-context';
import { runRequest } from '../../patterns/request';
import type { ProductionOrderFact } from './types';

// 서버 집계 칸은 생성 타입 전달 전까지 읽기 전용으로 보존한다.
type ProductionOrder = components['schemas']['ProductionOrder'] & {
  confirmedPlanQty?: number;
  draftPlanQty?: number;
  remainingQty?: number;
};

export const productionOrderKeys = {
  all: ['production-orders'] as const,
  detail: (productionOrderId: number | null) =>
    ['production-orders', 'detail', productionOrderId] as const,
};

export const toProductionOrderFact = (order: ProductionOrder): ProductionOrderFact => ({
  productionOrderId: order.productionOrderId,
  productionOrderNo: order.productionOrderNo,
  erpOrderNo: order.erpOrderNo ?? null,
  parentProductionOrderId: order.parentProductionOrderId ?? null,
  bomLevel: Math.max(0, Math.trunc(order.bomLevel ?? 0)),
  businessUnitId: order.businessUnitId ?? null,
  plantId: order.plantId ?? null,
  itemId: order.itemId,
  orderQty: order.orderQty,
  ...(typeof order.confirmedPlanQty === 'number' && Number.isFinite(order.confirmedPlanQty)
    ? { confirmedPlanQty: order.confirmedPlanQty }
    : {}),
  ...(typeof order.draftPlanQty === 'number' && Number.isFinite(order.draftPlanQty)
    ? { draftPlanQty: order.draftPlanQty }
    : {}),
  ...(typeof order.remainingQty === 'number' && Number.isFinite(order.remainingQty)
    ? { remainingQty: order.remainingQty }
    : {}),
  uomId: order.uomId,
  dueDate: order.dueDate ?? null,
  statusCode: order.statusCode,
  remarks: order.remarks ?? null,
  expandedWorkOrderCount: order.expandedWorkOrderCount ?? null,
  plannedWorkOrderCount: order.plannedWorkOrderCount ?? null,
  autoPlan: order.autoPlan ?? null,
  worklistState: order.worklistState ?? null,
  worklistReasons: order.worklistReasons ?? [],
  releasePendingWorkOrderCount: order.releasePendingWorkOrderCount ?? null,
  liveWorkOrderCount: order.liveWorkOrderCount ?? null,
});

/** 선택한 P/O만 정확한 계약 경로에서 읽고 목록과 같은 사실 형태로 쓴다. */
export const useProductionOrderDetail = (
  productionOrderId: number | null,
): UseQueryResult<ProductionOrderFact> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: productionOrderKeys.detail(productionOrderId),
    enabled: productionOrderId !== null,
    queryFn: () => {
      if (productionOrderId === null) {
        throw new Error('생산 P/O를 고르기 전에는 상세를 조회하지 않습니다.');
      }

      return runRequest(() =>
        client.GET('/planning/production-orders/{productionOrderId}', {
          params: { path: { productionOrderId } },
        }),
      ).then(toProductionOrderFact);
    },
  });
};
