import type { components } from '@omf-mes/api-client';

type ProductionPlanCreate = components['schemas']['ProductionPlanCreate'];
type ProductionPlanUpdate = components['schemas']['ProductionPlanUpdate'];

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const MACHINE_PRECISION_MULTIPLIER = 8;

export interface ProductionPlanDraft {
  planDate: string;
  plannedQty: string;
  bomId: string;
  routingId: string;
  plannedLineId: string;
  remarks: string;
}

export type ProductionPlanDraftField = keyof ProductionPlanDraft;
export type ProductionPlanDraftErrorCode =
  'REQUIRED' | 'INVALID_DATE' | 'INVALID_QUANTITY' | 'INVALID_SELECTION';
export type ProductionPlanDraftError = ProductionPlanDraftErrorCode | { message: string };
export type ProductionPlanDraftErrors = Partial<
  Record<ProductionPlanDraftField, ProductionPlanDraftError>
>;

export interface ProductionPlanCreateContext {
  productionOrderId: number;
  uomId: number;
}

export type ProductionPlanCreateResult =
  { ok: true; body: ProductionPlanCreate } | { ok: false; errors: ProductionPlanDraftErrors };

export interface ProductionPlanUpdateBaseline {
  planDate: string;
  plannedQty: number;
  bomId: number;
  routingId: number;
  plannedLineId: number | null;
  remarks: string | null;
}

export type ProductionPlanUpdateResult =
  { ok: true; body: ProductionPlanUpdate } | { ok: false; errors: ProductionPlanDraftErrors };

export interface ProductionPlanQuantitySummary {
  planCount: number;
  totalPlannedQty: number;
  remainingQty: number;
  relation: 'empty' | 'under' | 'matched' | 'over';
}

const isBlank = (value: string): boolean => value.trim() === '';

const isPositiveSafeInteger = (value: number): boolean => Number.isSafeInteger(value) && value > 0;

const toPositiveSelectionId = (value: string): number | null => {
  const parsed = Number(value);
  return isPositiveSafeInteger(parsed) ? parsed : null;
};

const isCalendarDate = (value: string): boolean => {
  const match = DATE_PATTERN.exec(value);
  if (match === null) return false;

  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
};

const assertPositiveSafeInteger = (value: number, field: string): void => {
  if (!isPositiveSafeInteger(value)) {
    throw new Error(`${field} must be a positive safe integer.`);
  }
};

const compensatedSum = (quantities: readonly number[]): number => {
  let sum = 0;
  let correction = 0;

  for (const quantity of quantities) {
    const adjusted = quantity - correction;
    const next = sum + adjusted;
    correction = next - sum - adjusted;
    sum = next;
  }

  return sum;
};

export const validateProductionPlanDraft = (
  draft: ProductionPlanDraft,
): ProductionPlanDraftErrors => {
  const errors: ProductionPlanDraftErrors = {};
  const planDate = draft.planDate.trim();
  const plannedQty = draft.plannedQty.trim();

  if (planDate === '') {
    errors.planDate = 'REQUIRED';
  } else if (!isCalendarDate(planDate)) {
    errors.planDate = 'INVALID_DATE';
  }

  if (plannedQty === '') {
    errors.plannedQty = 'REQUIRED';
  } else if (!Number.isFinite(Number(plannedQty)) || Number(plannedQty) <= 0) {
    errors.plannedQty = 'INVALID_QUANTITY';
  }

  for (const field of ['bomId', 'routingId'] as const) {
    if (isBlank(draft[field])) {
      errors[field] = 'REQUIRED';
    } else if (toPositiveSelectionId(draft[field].trim()) === null) {
      errors[field] = 'INVALID_SELECTION';
    }
  }

  if (!isBlank(draft.plannedLineId) && toPositiveSelectionId(draft.plannedLineId.trim()) === null) {
    errors.plannedLineId = 'INVALID_SELECTION';
  }

  return errors;
};

export const buildProductionPlanCreate = (
  draft: ProductionPlanDraft,
  context: ProductionPlanCreateContext,
): ProductionPlanCreateResult => {
  const errors = validateProductionPlanDraft(draft);
  if (Object.keys(errors).length > 0) return { ok: false, errors };

  assertPositiveSafeInteger(context.productionOrderId, 'productionOrderId');
  assertPositiveSafeInteger(context.uomId, 'uomId');

  const plannedLineId = draft.plannedLineId.trim();
  const remarks = draft.remarks;

  return {
    ok: true,
    body: {
      productionOrderId: context.productionOrderId,
      planDate: draft.planDate.trim(),
      plannedQty: Number(draft.plannedQty.trim()),
      uomId: context.uomId,
      bomId: Number(draft.bomId.trim()),
      routingId: Number(draft.routingId.trim()),
      ...(plannedLineId === '' ? {} : { plannedLineId: Number(plannedLineId) }),
      ...(isBlank(remarks) ? {} : { remarks }),
    },
  };
};

export const buildProductionPlanUpdate = (
  draft: ProductionPlanDraft,
  baseline: ProductionPlanUpdateBaseline,
): ProductionPlanUpdateResult => {
  const errors = validateProductionPlanDraft(draft);
  if (Object.keys(errors).length > 0) return { ok: false, errors };

  const next = {
    planDate: draft.planDate.trim(),
    plannedQty: Number(draft.plannedQty.trim()),
    bomId: Number(draft.bomId.trim()),
    routingId: Number(draft.routingId.trim()),
    plannedLineId: draft.plannedLineId.trim() === '' ? null : Number(draft.plannedLineId.trim()),
    remarks: isBlank(draft.remarks) ? null : draft.remarks,
  };
  const body: ProductionPlanUpdate = {};

  if (next.planDate !== baseline.planDate) body.planDate = next.planDate;
  if (next.plannedQty !== baseline.plannedQty) body.plannedQty = next.plannedQty;
  if (next.bomId !== baseline.bomId) body.bomId = next.bomId;
  if (next.routingId !== baseline.routingId) body.routingId = next.routingId;
  if (next.plannedLineId !== baseline.plannedLineId) body.plannedLineId = next.plannedLineId;
  if (next.remarks !== baseline.remarks) body.remarks = next.remarks;

  return { ok: true, body };
};

export const summarizeProductionPlanQuantities = (
  orderQty: number,
  plannedQuantities: readonly number[],
): ProductionPlanQuantitySummary => {
  if (!Number.isFinite(orderQty) || orderQty < 0) {
    throw new Error('orderQty must be a finite non-negative number.');
  }
  if (plannedQuantities.some((quantity) => !Number.isFinite(quantity) || quantity < 0)) {
    throw new Error('planned quantities must be finite non-negative numbers.');
  }

  const totalPlannedQty = compensatedSum(plannedQuantities);
  if (!Number.isFinite(totalPlannedQty)) {
    throw new Error('planned quantity total must be finite.');
  }

  const remainingQty = orderQty - totalPlannedQty;
  const precision =
    Number.EPSILON *
    Math.max(1, Math.abs(orderQty), Math.abs(totalPlannedQty)) *
    MACHINE_PRECISION_MULTIPLIER;
  const isMatched = Math.abs(remainingQty) <= precision;

  if (plannedQuantities.length === 0) {
    return { planCount: 0, totalPlannedQty, remainingQty: orderQty, relation: 'empty' };
  }
  if (isMatched) {
    return {
      planCount: plannedQuantities.length,
      totalPlannedQty,
      remainingQty: 0,
      relation: 'matched',
    };
  }

  return {
    planCount: plannedQuantities.length,
    totalPlannedQty,
    remainingQty,
    relation: remainingQty > 0 ? 'under' : 'over',
  };
};
