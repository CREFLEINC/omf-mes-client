import { messages } from '@omf-mes/i18n';
import { plantToday } from '../../../patterns/plant-time';
import {
  validateProductionPlanDraft,
  type ProductionPlanDraft,
} from '../../production-plan/editor-model';
export const isPastPlanningDate = (date: string, today = plantToday()) =>
  /^\d{4}-\d{2}-\d{2}$/.test(date) && date < today;
export const pastPlanningDateMessage = () =>
  messages.erpWorkOrderFlow.process.remaining.pastPlanDate;
export const validatePlanningDraft = (draft: ProductionPlanDraft) => {
  const errors = validateProductionPlanDraft(draft);
  if (!errors.planDate && isPastPlanningDate(draft.planDate))
    errors.planDate = { message: pastPlanningDateMessage() };
  return errors;
};

interface DatedPlan {
  productionPlanId: number | null;
  confirmed: boolean;
  draft: { planDate: string };
}
interface PlanWorkOrder {
  productionPlanId: number;
  statusCode: string;
  releasedAt?: string | null;
}
export const pastUnreleasedPlans = <T extends DatedPlan>(
  rows: readonly T[],
  workOrders: readonly PlanWorkOrder[],
  today = plantToday(),
) =>
  rows.filter((row) => {
    if (!isPastPlanningDate(row.draft.planDate, today)) return false;
    if (!row.confirmed) return true;
    const linked = workOrders.filter(
      (workOrder) => workOrder.productionPlanId === row.productionPlanId,
    );
    if (!linked.length) return true;
    return linked.some(
      (workOrder) =>
        !workOrder.releasedAt &&
        !['CANCELLED', 'RELEASED', 'IN_PROGRESS', 'SUSPENDED', 'COMPLETED', 'CLOSED'].includes(
          workOrder.statusCode,
        ),
    );
  });
