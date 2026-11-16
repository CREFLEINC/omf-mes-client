import type { ReferenceRow } from '../../../patterns/reference-picker';
import { shiftPlanDate } from '../process/plan-view-model';

// Presentation state stays separate from the generated API contract until an adapter supplies it.
export const resourceLabels = {
  productionLineId: '생산 라인',
  plannedEquipmentId: '설비',
  plannedMoldId: '금형',
  responsibleWorkerId: '작업자',
  plannedShiftId: '교대',
  defaultWipLocationId: 'WIP 위치',
  defaultFgLocationId: '완제품 위치',
  defaultScrapLocationId: '스크랩 위치',
} as const;
export type ResourceField = keyof typeof resourceLabels;
export interface ReviewOperation {
  number?: string;
  key: string;
  sequence: number;
  name: string;
  processCode: string;
  quantity: number;
  predecessors: string[];
  start: string;
  end: string;
  resources: Record<ResourceField, ReferenceRow | null>;
  required: ResourceField[];
}
export type PlanReviewField = 'date' | 'quantity' | 'line' | 'routing';
export interface ReviewPlan {
  key: string;
  number?: string;
  source: '신규 제안' | '작성중 계획' | '기존 확정 계획';
  date: string;
  quantity: string;
  bom: string;
  bomId?: number;
  routingId?: number;
  bomComponents?: { itemCode: string; itemName: string; quantity: number; uom: string }[];
  routing: string;
  operations: ReviewOperation[];
  recalculationRequired?: boolean;
  reviewFields?: PlanReviewField[];
  routingOptions?: { value: ReferenceRow; operations: ReviewOperation[] }[];
}
export interface ReviewProposal {
  id: string;
  number: string;
  itemCode: string;
  itemId?: number;
  itemName: string;
  plant: string;
  erpPlanStartDate?: string;
  orderQty: number;
  confirmedQty: number;
  draftQty: number;
  remainingQty: number;
  uom: string;
  plans: ReviewPlan[];
  issues: string[];
  changed?: boolean;
}
export const proposedQuantity = (row: ReviewProposal): number =>
  row.plans
    .filter((plan) => plan.source !== '기존 확정 계획')
    .reduce((sum, plan) => sum + (Number(plan.quantity) || 0), 0);
export const proposalErrors = (row: ReviewProposal): string[] => {
  const editable = row.plans.filter((plan) => plan.source !== '기존 확정 계획');
  const errors = [...row.issues];
  if (!editable.length) errors.push('확정할 제안이 없습니다');
  if (proposedQuantity(row) > row.orderQty - row.confirmedQty)
    errors.push('제안 수량이 미확정 잔량을 초과합니다');
  editable.forEach((plan) => {
    if (plan.recalculationRequired) errors.push('공정 재검증 필요');
    if (!plan.bom) errors.push('ERP 기본 BOM을 확인하세요');
    if (!plan.routing) errors.push('Routing을 지정하세요');
    if (
      !plan.quantity.trim() ||
      !Number.isFinite(Number(plan.quantity)) ||
      Number(plan.quantity) <= 0
    )
      errors.push('생산량은 0보다 커야 합니다');
    if (!shiftPlanDate(plan.date, 0)) errors.push('계획일을 확인하세요');
    if (!plan.operations.length) errors.push('Routing 공정을 확인하세요');
    plan.operations.forEach((op) =>
      op.required.forEach((field) => {
        if (!op.resources[field]) errors.push(`${op.name}: ${resourceLabels[field]} 미지정`);
      }),
    );
  });
  return [...new Set(errors)];
};
export const reviewStatus = (row: ReviewProposal) =>
  row.plans.length > 0 && row.plans.every((plan) => plan.source === '기존 확정 계획')
    ? '변경 없음'
    : proposalErrors(row).length
      ? '검토 필요'
      : '확정 가능';
export const proposalAction = (row: ReviewProposal) =>
  reviewStatus(row) === '변경 없음'
    ? '기존 확정 계획 유지'
    : row.plans.some((plan) => plan.source === '작성중 계획')
      ? '기존 계획 확정'
      : '신규 계획 생성 후 확정';

export const completionFields = (row: ReviewProposal, plan: ReviewPlan): PlanReviewField[] => {
  if (plan.source === '기존 확정 계획') return [];
  const fields = new Set(plan.reviewFields ?? []);
  if (!shiftPlanDate(plan.date, 0)) fields.add('date');
  if (
    !plan.quantity.trim() ||
    !Number.isFinite(Number(plan.quantity)) ||
    Number(plan.quantity) <= 0 ||
    proposedQuantity(row) > row.orderQty - row.confirmedQty
  )
    fields.add('quantity');
  if (!plan.routing) fields.add('routing');
  if (plan.operations.some((operation) => !operation.resources.productionLineId))
    fields.add('line');
  return [...fields];
};
