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
export interface ReviewPlan {
  key: string;
  number?: string;
  source: '신규 제안' | '작성중 계획' | '기존 확정 계획';
  date: string;
  quantity: string;
  bom: string;
  routing: string;
  operations: ReviewOperation[];
  recalculationRequired?: boolean;
  routingOptions?: { value: ReferenceRow; operations: ReviewOperation[] }[];
}
export interface ReviewProposal {
  id: string;
  number: string;
  itemCode: string;
  itemName: string;
  plant: string;
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
  proposalErrors(row).length ? '보완 필요' : '검토 가능';
