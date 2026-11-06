import type {
  NewProductionPlanDefaults,
  ProductionPlanEditorStateRow,
} from '../../production-plan/editor-state';
import type { ProductionOrderFact } from '../types';
import type { PlanLine } from './plan-step';

export const recommendedPlanDate = (start: string | null | undefined, today: string) =>
  start && /^\d{4}-\d{2}-\d{2}$/.test(start) && Number.isFinite(Date.parse(start)) && start >= today
    ? start
    : today;

export const manualPlanDefaults = (
  order: Pick<ProductionOrderFact, 'orderQty' | 'confirmedPlanQty' | 'plannedStartDate'>,
  rows: readonly ProductionPlanEditorStateRow[],
  lines: readonly PlanLine[],
  revisions: Pick<NewProductionPlanDefaults, 'bomId' | 'routingId'>,
  today: string,
): NewProductionPlanDefaults => {
  const confirmed = Math.max(
    order.confirmedPlanQty ?? 0,
    rows
      .filter((row) => row.confirmed)
      .reduce((sum, row) => sum + (Number(row.draft.plannedQty) || 0), 0),
  );
  const draft = rows
    .filter((row) => !row.confirmed)
    .reduce((sum, row) => sum + (Number(row.draft.plannedQty) || 0), 0);
  const previousLine = rows.at(-1)?.draft.plannedLineId;
  return {
    ...revisions,
    planDate: recommendedPlanDate(order.plannedStartDate, today),
    plannedQty: String(Number(Math.max(0, order.orderQty - confirmed - draft).toFixed(6))),
    plannedLineId: lines.some((line) => String(line.id) === previousLine)
      ? previousLine
      : lines.length === 1
        ? String(lines[0]!.id)
        : '',
  };
};
