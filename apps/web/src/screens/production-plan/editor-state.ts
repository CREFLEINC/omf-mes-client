import type { components } from '@omf-mes/api-client';

import type { ProductionPlanEditorRow } from './editor-pane';
import {
  buildProductionPlanCreate,
  buildProductionPlanUpdate,
  validateProductionPlanDraft,
  type ProductionPlanCreateContext,
  type ProductionPlanDraft,
  type ProductionPlanDraftErrors,
  type ProductionPlanDraftField,
  type ProductionPlanUpdateBaseline,
} from './editor-model';
import type { ProductionPlanFact } from './types';

type ProductionPlanCreate = components['schemas']['ProductionPlanCreate'];
type ProductionPlanUpdate = components['schemas']['ProductionPlanUpdate'];

export interface ProductionPlanEditorStateRow extends ProductionPlanEditorRow {
  productionPlanId: number | null;
  baseline: ProductionPlanUpdateBaseline | null;
  isDirty: boolean;
}

export interface NewProductionPlanDefaults {
  planDate: string;
  plannedQty: string;
  bomId: string;
  routingId: string;
  plannedLineId?: string;
}

export type ProductionPlanRowCommand =
  | { kind: 'create'; body: ProductionPlanCreate }
  | { kind: 'update'; productionPlanId: number; body: ProductionPlanUpdate }
  | { kind: 'none' };

export type ProductionPlanRowPreparation =
  | { ok: true; command: ProductionPlanRowCommand }
  | { ok: false; errors: ProductionPlanDraftErrors };

export const draftFromProductionPlan = (plan: ProductionPlanFact): ProductionPlanDraft => ({
  planDate: plan.planDate,
  plannedQty: String(plan.plannedQty),
  bomId: String(plan.bomId),
  routingId: String(plan.routingId),
  plannedLineId: plan.plannedLineId === null ? '' : String(plan.plannedLineId),
  remarks: plan.remarks ?? '',
});

const baselineFromProductionPlan = (plan: ProductionPlanFact): ProductionPlanUpdateBaseline => ({
  planDate: plan.planDate,
  plannedQty: plan.plannedQty,
  bomId: plan.bomId,
  routingId: plan.routingId,
  plannedLineId: plan.plannedLineId,
  remarks: plan.remarks,
});

const rowFromProductionPlan = (
  plan: ProductionPlanFact,
  displayNo: number,
): ProductionPlanEditorStateRow => ({
  key: `plan-${String(plan.productionPlanId)}`,
  displayNo,
  productionPlanId: plan.productionPlanId,
  planNo: plan.planNo,
  statusCode: plan.statusCode,
  confirmed: plan.confirmedAt !== null,
  isPending: false,
  isDirty: false,
  draft: draftFromProductionPlan(plan),
  baseline: baselineFromProductionPlan(plan),
  errors: {},
});

export const reconcileProductionPlanRows = (
  current: ProductionPlanEditorStateRow[],
  plans: readonly ProductionPlanFact[],
): ProductionPlanEditorStateRow[] => {
  const previousById = new Map(
    current.flatMap((row) =>
      row.productionPlanId === null ? [] : ([[row.productionPlanId, row]] as const),
    ),
  );
  const reserved = new Set(current.map((row) => row.displayNo));
  let candidate = 1;
  const nextDisplayNo = () => {
    while (reserved.has(candidate)) candidate += 1;
    reserved.add(candidate);
    return candidate;
  };
  const serverRows = plans.map((plan) => {
    const previous = previousById.get(plan.productionPlanId);
    const displayNo = previous?.displayNo ?? nextDisplayNo();
    if (
      previous !== undefined &&
      (previous.isDirty || previous.isPending) &&
      plan.confirmedAt === null
    ) {
      return { ...previous, planNo: plan.planNo, statusCode: plan.statusCode };
    }
    return rowFromProductionPlan(plan, displayNo);
  });
  return [...serverRows, ...current.filter((row) => row.productionPlanId === null)];
};

export const appendProductionPlanRow = (
  current: ProductionPlanEditorStateRow[],
  key: string,
  defaults: NewProductionPlanDefaults,
): ProductionPlanEditorStateRow[] => [
  ...current,
  {
    key,
    displayNo: Math.max(0, ...current.map((row) => row.displayNo)) + 1,
    productionPlanId: null,
    planNo: null,
    statusCode: '신규',
    confirmed: false,
    isPending: false,
    isDirty: true,
    draft: {
      planDate: defaults.planDate,
      plannedQty: defaults.plannedQty,
      bomId: defaults.bomId,
      routingId: defaults.routingId,
      plannedLineId: defaults.plannedLineId ?? '',
      remarks: '',
    },
    baseline: null,
    errors: {},
  },
];

export const changeProductionPlanRow = (
  current: ProductionPlanEditorStateRow[],
  key: string,
  field: ProductionPlanDraftField,
  value: string,
): ProductionPlanEditorStateRow[] =>
  current.map((row) => {
    if (row.key !== key) return row;
    const errors = { ...row.errors };
    delete errors[field];
    const draft = { ...row.draft, [field]: value };
    const update = row.baseline === null ? null : buildProductionPlanUpdate(draft, row.baseline);
    const isDirty = update === null || !update.ok || Object.keys(update.body).length > 0;
    return { ...row, draft, errors, isDirty };
  });

export const markProductionPlanRowPending = (
  current: ProductionPlanEditorStateRow[],
  key: string,
  isPending: boolean,
): ProductionPlanEditorStateRow[] =>
  current.map((row) => (row.key === key ? { ...row, isPending } : row));

export const setProductionPlanRowErrors = (
  current: ProductionPlanEditorStateRow[],
  key: string,
  errors: ProductionPlanDraftErrors,
): ProductionPlanEditorStateRow[] =>
  current.map((row) => (row.key === key ? { ...row, errors } : row));

export const removeProductionPlanRow = (
  current: ProductionPlanEditorStateRow[],
  key: string,
): ProductionPlanEditorStateRow[] => current.filter((row) => row.key !== key);

export const settleProductionPlanRow = (
  current: ProductionPlanEditorStateRow[],
  key: string,
  plan: ProductionPlanFact,
): ProductionPlanEditorStateRow[] =>
  current.map((row) => (row.key === key ? rowFromProductionPlan(plan, row.displayNo) : row));

export const prepareProductionPlanRow = (
  row: ProductionPlanEditorStateRow,
  context: ProductionPlanCreateContext,
): ProductionPlanRowPreparation => {
  const errors = validateProductionPlanDraft(row.draft);
  if (Object.keys(errors).length > 0) return { ok: false, errors };
  if (row.productionPlanId === null) {
    const result = buildProductionPlanCreate(row.draft, context);
    return result.ok ? { ok: true, command: { kind: 'create', body: result.body } } : result;
  }
  if (row.baseline === null) throw new Error('기존 생산계획 행에는 기준값이 필요합니다.');
  const result = buildProductionPlanUpdate(row.draft, row.baseline);
  if (!result.ok) return result;
  return {
    ok: true,
    command:
      Object.keys(result.body).length === 0
        ? { kind: 'none' }
        : { kind: 'update', productionPlanId: row.productionPlanId, body: result.body },
  };
};
