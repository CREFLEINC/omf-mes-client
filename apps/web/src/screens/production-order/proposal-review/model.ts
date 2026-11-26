import { isPastPlanningDate, pastPlanningDateMessage } from '../process/planning-date-policy';
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
  defaultFgLocationId: '생산품 입고 창고',
  defaultScrapLocationId: '스크랩 위치',
} as const;
export type ResourceField = keyof typeof resourceLabels;
export interface ReviewOperation {
  expectedDurationSec?: number | null;
  number?: string;
  routingOperationId?: number;
  plannedTimeSourceCode?: 'SYSTEM' | 'USER';
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
  defaultFgLocationSource?: 'ERP_STORAGE_LOCATION' | 'LINE_DEFAULT' | 'NONE';
}
export type PlanReviewField = 'date' | 'quantity' | 'line' | 'routing';
export interface ReviewPlan {
  serverPlanKey?: string;
  productionPlanId?: number;
  savedVersionNo?: number;
  splitFromKey?: string;
  fgWarehouseOverride?: { warehouseId: number; erpMismatchAcknowledged: true };
  appliedWarehouse?: ReferenceRow | null;
  remarks?: string;
  planDateSourceCode?: 'SYSTEM' | 'USER';
  planDateCalendar?: import('@omf-mes/api-client').PlanningComponents['schemas']['PlanningCalendarDay'];
  planDateAdjustment?: import('@omf-mes/api-client').PlanProposal['plans'][number]['planDateAdjustment'];
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
  validated?: boolean;
  serverErrors?: string[];
  basisChanges?: string[];
  corrections?: string[];
  existingDrafts?: import('@omf-mes/api-client').ProposalComponents['schemas']['ProductionPlanProposalExistingDraft'][];
  existingDraftAction?: 'CONTINUE' | 'REPLACE';
  outcome?: 'CONFIRMED' | 'ALREADY_PROCESSED';
  resultPlans?: import('@omf-mes/api-client').ProposalConfirmation['plans'];
  autoWorkOrder?: import('@omf-mes/api-client').PlanProposal['autoWorkOrder'];
  basis?: import('@omf-mes/api-client').PlanProposal['basis'];
  serverWarnings?: string[];
  id: string;
  number: string;
  itemCode: string;
  itemId?: number;
  itemName: string;
  plant: string;
  erpPlanStartDate?: string;
  erpStorage?: {
    erpStorageLocationCode: string | null;
    warehouse: ReferenceRow | null;
    location: ReferenceRow | null;
    reasonCode: string | null;
    locationRole?: 'WAREHOUSE_WHOLE' | 'PUTAWAY_STAGING';
  };
  orderQty: number;
  confirmedQty: number;
  draftQty: number;
  remainingQty: number;
  uom: string;
  plans: ReviewPlan[];
  issues: string[];
  changed?: boolean;
  live?: boolean;
  plantId?: number;
  serverKind?:
    'NEW_PLAN' | 'REVIEW_DRAFT' | 'KEEP_CONFIRMED' | 'NOT_PROPOSABLE' | 'AUTO_WORK_ORDER';
  serverStatus?: string;
  serverIssues?: string[];
}
export const storageFailureLabels: Record<string, string> = {
  FG_WAREHOUSE_UNMAPPED: '생산품 입고 창고 연결 필요',
  FG_WAREHOUSE_INACTIVE: '생산품 입고 창고 사용 상태 확인 필요',
  FG_WAREHOUSE_OTHER_PLANT: '생산품 입고 창고 공장 확인 필요',
  FG_WAREHOUSE_NOT_ALLOWED: '생산품 입고 창고 유형 확인 필요',
};
export const applyReceiptStorage = (row: ReviewProposal): ReviewProposal => {
  const storage = row.erpStorage;
  if (!storage?.erpStorageLocationCode) return row;
  const location = !storage.reasonCode && storage.warehouse ? storage.location : null;
  return {
    ...row,
    plans: row.plans.map((plan) =>
      plan.source === '기존 확정 계획'
        ? plan
        : {
            ...plan,
            operations: plan.operations.map((op) => ({
              ...op,
              defaultFgLocationSource: (
                plan.fgWarehouseOverride ? op.resources.defaultFgLocationId : location
              )
                ? 'ERP_STORAGE_LOCATION'
                : 'NONE',
              resources: {
                ...op.resources,
                defaultFgLocationId: plan.fgWarehouseOverride
                  ? op.resources.defaultFgLocationId
                  : location,
              },
            })),
          },
    ),
  };
};
export const proposedQuantity = (row: ReviewProposal): number =>
  row.plans
    .filter((plan) => plan.source !== '기존 확정 계획')
    .reduce((sum, plan) => sum + (Number(plan.quantity) || 0), 0);
export const proposalErrors = (row: ReviewProposal): string[] => {
  if (row.outcome) return ['확정 완료'];
  const editable = row.plans.filter((plan) => plan.source !== '기존 확정 계획');
  const errors = [...row.issues, ...(row.serverErrors ?? []), ...(row.basisChanges ?? [])];
  if (row.serverKind === 'AUTO_WORK_ORDER')
    errors.push('자동 처리 ERP W/O는 선택 확정하지 않습니다');
  if (row.existingDrafts?.length && !row.existingDraftAction)
    errors.push('작성중 계획 처리 방법을 선택하세요');
  if (row.live && !row.validated) errors.push('보완한 제안의 서버 재검증 필요');
  if (row.live && !row.validated && row.serverStatus === 'NEEDS_INPUT')
    errors.push(...(row.serverIssues?.length ? row.serverIssues : ['서버 점검 보완 필요']));
  const storage = row.erpStorage;
  if (storage?.erpStorageLocationCode) {
    if (storage.reasonCode)
      errors.push(storageFailureLabels[storage.reasonCode] ?? '생산품 입고 창고 확인 필요');
    else if (
      !storage.warehouse ||
      (!storage.location && editable.some((plan) => !plan.fgWarehouseOverride))
    )
      errors.push('생산품 입고 창고의 자동 입고 위치 확인 필요');
  }
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
    else if (isPastPlanningDate(plan.date)) errors.push(pastPlanningDateMessage());
    if (!plan.operations.length) errors.push('Routing 공정을 확인하세요');
    plan.operations.forEach((op) =>
      op.required
        .filter((field) => field !== 'defaultWipLocationId' && field !== 'defaultScrapLocationId')
        .forEach((field) => {
          if (
            !op.resources[field] &&
            !(field === 'defaultFgLocationId' && storage?.erpStorageLocationCode)
          )
            errors.push(`${op.name}: ${resourceLabels[field]} 미지정`);
        }),
    );
  });
  return [...new Set(errors)];
};
export const reviewStatus = (row: ReviewProposal) =>
  row.outcome
    ? '확정 완료'
    : row.serverKind === 'AUTO_WORK_ORDER'
      ? '자동 처리'
      : (row.serverKind === 'KEEP_CONFIRMED' && row.serverStatus === 'NO_CHANGE') ||
          (row.plans.length > 0 && row.plans.every((plan) => plan.source === '기존 확정 계획'))
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
