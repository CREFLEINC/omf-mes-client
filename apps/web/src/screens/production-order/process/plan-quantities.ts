import type { ProductionPlanEditorStateRow } from '../../production-plan/editor-state';
export const planQuantities = (
  orderQty: number,
  serverConfirmed: number | null | undefined,
  rows: readonly ProductionPlanEditorStateRow[],
) => {
  const round = (value: number) => Number(value.toFixed(6));
  const confirmed = round(
    (
      serverConfirmed ??
      rows
        .filter((row) => row.confirmed)
        .reduce((sum, row) => sum + (Number(row.draft.plannedQty) || 0), 0)
    ),
  );
  const draft = round(
    rows
      .filter((row) => !row.confirmed)
      .reduce((sum, row) => sum + (Number(row.draft.plannedQty) || 0), 0),
  );
  const balance = round(orderQty - confirmed - draft);
  return { confirmed, draft, remaining: Math.max(0, balance), excess: Math.max(0, -balance) };
};
