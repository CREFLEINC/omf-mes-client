import { useProductionOrderDetail } from '../production-order/queries';
import { useProductionPlanDetail } from '../production-plan/queries';

export interface WorkOrderScreenContext {
  productionPlanQuery: ReturnType<typeof useProductionPlanDetail>;
  productionOrderQuery: ReturnType<typeof useProductionOrderDetail>;
  plantId: number | null;
}

export const useWorkOrderScreenContext = (
  productionPlanId: number | null,
): WorkOrderScreenContext => {
  const productionPlanQuery = useProductionPlanDetail(productionPlanId);
  const productionOrderQuery = useProductionOrderDetail(
    productionPlanQuery.data?.productionOrderId ?? null,
  );

  return {
    productionPlanQuery,
    productionOrderQuery,
    plantId: productionOrderQuery.data?.plantId ?? null,
  };
};
