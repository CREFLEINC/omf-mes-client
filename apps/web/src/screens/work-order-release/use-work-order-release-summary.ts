import { useProductionOrderItemNames } from '../production-order/item-lookups';
import { useProductionOrderDetail } from '../production-order/queries';
import { useUomReferenceLookup } from '../production-order/reference-lookups';
import { useProductionPlanDetail } from '../production-plan/queries';
import { useRoutingDetail, useRoutingOperations } from '../routing/queries';
import { useWorkOrderMolds } from '../work-order/people-tool-queries';
import {
  useWorkOrderEquipments,
  useWorkOrderProductionLines,
  useWorkOrderShifts,
} from '../work-order/resource-queries';
import type { WorkOrderReleaseFact } from './queries';
import type { WorkOrderReleaseSummaryView } from './work-order-release-summary-pane';
import { toWorkOrderReleaseSummaryView } from './work-order-release-summary-view';

export const useWorkOrderReleaseSummary = (
  detail: WorkOrderReleaseFact | null,
): WorkOrderReleaseSummaryView | null => {
  const itemNames = useProductionOrderItemNames(detail === null ? [] : [detail.itemId]);
  const uoms = useUomReferenceLookup();
  const plan = useProductionPlanDetail(detail?.productionPlanId ?? null);
  const exactPlan =
    detail !== null &&
    !plan.isFetching &&
    !plan.isError &&
    plan.data?.productionPlanId === detail.productionPlanId
      ? plan.data
      : null;
  const productionOrder = useProductionOrderDetail(exactPlan?.productionOrderId ?? null);
  const exactProductionOrder =
    exactPlan !== null &&
    !productionOrder.isFetching &&
    !productionOrder.isError &&
    productionOrder.data?.productionOrderId === exactPlan.productionOrderId
      ? productionOrder.data
      : null;
  const routing = useRoutingDetail(exactPlan?.routingId ?? null);
  const operations = useRoutingOperations(exactPlan?.routingId ?? null);
  const plantId = exactProductionOrder?.plantId ?? null;
  const productionLines = useWorkOrderProductionLines(plantId, 1);
  const equipments = useWorkOrderEquipments(plantId, detail?.productionLineId ?? null, 1);
  const molds = useWorkOrderMolds(plantId, 1);
  const shifts = useWorkOrderShifts(plantId, 1);

  return detail === null
    ? null
    : toWorkOrderReleaseSummaryView(detail, {
        itemNames: itemNames.items,
        uoms,
        plan: {
          data: plan.data,
          isError: plan.isError,
          isPending: plan.isFetching,
        },
        productionOrder: {
          data: productionOrder.data,
          isError: productionOrder.isError,
          isPending: productionOrder.isFetching,
        },
        routing: {
          data: routing.data,
          isError: routing.isError,
          isPending: routing.isFetching,
        },
        operations: {
          data: operations.data,
          isError: operations.isError,
          isPending: operations.isFetching,
        },
        productionLines: {
          data: productionLines.data,
          isError: productionLines.isError,
          isPending: productionLines.isFetching,
        },
        equipments: {
          data: equipments.data,
          isError: equipments.isError,
          isPending: equipments.isFetching,
        },
        molds: {
          data: molds.data,
          isError: molds.isError,
          isPending: molds.isFetching,
        },
        shifts: {
          data: shifts.data,
          isError: shifts.isError,
          isPending: shifts.isFetching,
        },
      });
};
