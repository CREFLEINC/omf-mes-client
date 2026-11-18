import {
  createIdempotencyKey,
  createProposalReadClient,
  type ProposalRevalidateBody,
  type ProposalRevalidation,
  type ProposalConfirmation,
} from '@omf-mes/api-client';
import { runRequest, ApiRequestError } from '../../../patterns/request';
import { PLANT_UTC_OFFSET, formatPlantDateTime } from '../../../patterns/plant-time';
import { apiErrorText } from '../release-runner';
import type { ReviewProposal } from './model';
import { type LiveCatalog, toLiveProposal } from './live-data';

type Client = ReturnType<typeof createProposalReadClient>;
const instant = (value: string) => {
  const local = value.replace(' ', 'T');
  return /(?:Z|[+-]\d\d:\d\d)$/.test(local)
    ? local
    : `${local}${local.length === 16 ? ':00' : ''}${PLANT_UTC_OFFSET}`;
};
export function proposalBody(row: ReviewProposal): ProposalRevalidateBody {
  if (!row.basis) throw new Error('제안을 다시 조회하세요.');
  const plans = row.plans.filter((plan) => plan.source !== '기존 확정 계획');
  let next = 0;
  const keys = new Map(
    plans.map((plan) => [
      plan.key,
      plan.source === '작성중 계획' && plan.productionPlanId
        ? `plan-${plan.productionPlanId}`
        : `new-${++next}`,
    ]),
  );
  return {
    basis: row.basis,
    ...(row.existingDraftAction ? { existingDraftAction: row.existingDraftAction } : {}),
    ...(row.existingDraftAction === 'REPLACE'
      ? {
          replacedDrafts: (row.existingDrafts ?? []).map((draft) => ({
            productionPlanId: draft.productionPlanId,
            versionNo: draft.versionNo,
          })),
        }
      : {}),
    plans: plans.map((plan) => ({
      proposalPlanKey: keys.get(plan.key)!,
      ...(plan.source === '작성중 계획' ? { savedVersionNo: plan.savedVersionNo } : {}),
      ...(plan.splitFromKey && keys.has(plan.splitFromKey) && plan.splitFromKey !== plan.key
        ? { splitFromPlanKey: keys.get(plan.splitFromKey)! }
        : {}),
      planDate: plan.date,
      planDateSourceCode: plan.planDateSourceCode ?? 'SYSTEM',
      plannedQty: Number(plan.quantity),
      bomId: plan.bomId ?? 0,
      routingId: plan.routingId ?? 0,
      plannedLineId: plan.operations[0]?.resources.productionLineId?.id ?? null,
      ...(plan.fgWarehouseOverride ? { fgWarehouseOverride: plan.fgWarehouseOverride } : {}),
      ...(plan.remarks ? { remarks: plan.remarks } : {}),
      workOrders: plan.operations.map((op) => ({
        routingOperationId: op.routingOperationId ?? Number(op.key),
        productionLineId: op.resources.productionLineId?.id ?? null,
        plannedEquipmentId: op.resources.plannedEquipmentId?.id ?? null,
        plannedMoldId: op.resources.plannedMoldId?.id ?? null,
        responsibleWorkerId: op.resources.responsibleWorkerId?.id ?? null,
        plannedShiftId: op.resources.plannedShiftId?.id ?? null,
        plannedTimeSourceCode: op.plannedTimeSourceCode ?? 'SYSTEM',
        ...(op.start ? { plannedStartAt: instant(op.start) } : {}),
        ...(op.end ? { plannedEndAt: instant(op.end) } : {}),
        defaultFgLocationId: op.resources.defaultFgLocationId?.id ?? null,
      })),
    })),
  };
}
const fieldLabel = (field: string | undefined) => {
  if (!field) return '';
  const plan = /plans\[(\d+)\]/.exec(field);
  const op = /workOrders\[(\d+)\]/.exec(field);
  const labels: Record<string, string> = {
    plannedQty: '생산량',
    planDate: '계획일',
    planDateSourceCode: '계획일',
    plannedStartAt: '계획 시작',
    plannedEndAt: '계획 종료',
    productionLineId: '생산 라인',
    defaultFgLocationId: '생산품 입고 창고',
    plannedEquipmentId: '설비',
    plannedMoldId: '금형',
    routingId: 'Routing',
    bomId: 'BOM',
    existingDraftAction: '작성중 계획',
    savedVersionNo: '작성중 계획',
    plans: '계획',
  };
  return [
    plan ? `계획 ${Number(plan[1]) + 1}` : '',
    op ? `공정 ${Number(op[1]) + 1}` : '',
    labels[field.split('.').at(-1) ?? ''] ?? '',
  ]
    .filter(Boolean)
    .join(' / ');
};
export const validationMessage = (error: { field?: string; message: string }) =>
  [fieldLabel(error.field), error.message].filter(Boolean).join(': ');
export function applyRevalidation(
  row: ReviewProposal,
  result: ProposalRevalidation,
  catalog: LiveCatalog,
): ReviewProposal {
  const body = proposalBody(row);
  const editable = row.plans.filter((plan) => plan.source !== '기존 확정 계획');
  const reference = (id: number | null, field: string) => {
    if (id === null) return null;
    const map =
      field === 'productionLineId'
        ? catalog.lines
        : field === 'plannedEquipmentId'
          ? catalog.equipment
          : field === 'plannedMoldId'
            ? catalog.molds
            : catalog.values;
    return map.get(id) ?? { id, code: String(id), name: '명칭 확인 필요' };
  };
  return {
    ...row,
    validated: result.confirmable,
    basisChanges: result.proposalChanges.map((change) => change.message),
    serverErrors: result.errors.map(validationMessage),
    serverWarnings: result.warnings.map((warning) => validationMessage(warning)),
    corrections: result.corrections.map((correction) => correction.message),
    ...(result.proposalChanges.length ? {} : { basis: result.basis }),
    ...(result.alreadyProcessed
      ? {
          outcome: 'ALREADY_PROCESSED' as const,
          confirmedQty: row.orderQty,
          draftQty: 0,
          remainingQty: 0,
        }
      : {}),
    plans: result.alreadyProcessed
      ? []
      : row.plans.map((plan) => {
          const index = editable.findIndex((item) => item.key === plan.key);
          const checked = result.plans.find(
            (item) => item.proposalPlanKey === body.plans[index]?.proposalPlanKey,
          );
          if (!checked) return plan;
          const warehouse = catalog.warehouses
            .flatMap((group) => group.items)
            .find((item) => item.warehouseId === checked.fgWarehouse.appliedWarehouseId);
          return {
            ...plan,
            date: checked.planDate,
            quantity: String(checked.plannedQty),
            planDateCalendar: checked.planDateCalendar,
            recalculationRequired: false,
            appliedWarehouse: warehouse
              ? {
                  id: warehouse.warehouseId,
                  code: warehouse.warehouseCode,
                  name: warehouse.warehouseName,
                }
              : null,
            operations: plan.operations.map((op) => {
              const checkedOp = checked.workOrders.find(
                (item) => item.routingOperationId === (op.routingOperationId ?? Number(op.key)),
              );
              if (!checkedOp) return op;
              return {
                ...op,
                quantity: checkedOp.orderQty,
                start: formatPlantDateTime(checkedOp.plannedStartAt) ?? '',
                end: formatPlantDateTime(checkedOp.plannedEndAt) ?? '',
                plannedTimeSourceCode: checkedOp.plannedTimeSourceCode,
                predecessors: checkedOp.predecessors.map((predecessor) => {
                  const before = plan.operations.find(
                    (candidate) => candidate.routingOperationId === predecessor.routingOperationId,
                  );
                  return before
                    ? `${before.sequence} / ${before.name}`
                    : String(predecessor.routingOperationId);
                }),
                resources: {
                  ...op.resources,
                  productionLineId: reference(checkedOp.productionLineId, 'productionLineId'),
                  defaultWipLocationId: reference(
                    checkedOp.defaultWipLocationId,
                    'defaultWipLocationId',
                  ),
                  defaultFgLocationId: reference(
                    checkedOp.defaultFgLocationId,
                    'defaultFgLocationId',
                  ),
                },
              };
            }),
          };
        }),
  };
}
export function createProposalSession(client: Client, catalog: LiveCatalog) {
  // The same body keeps its key even after a lost response. Changed bodies get a new key.
  const attempts = new Map<string, string>();
  const current = new Map<string, ReviewProposal>();
  return {
    current: (id: string) => current.get(id),
    reload: async (row: ReviewProposal) => {
      const response = await runRequest(() =>
        client.GET('/planning/production-orders:plan-proposals', {
          params: { query: { productionOrderIds: [Number(row.id)] } },
        }),
      );
      const proposal = response.items.find((item) => item.productionOrderId === Number(row.id));
      if (!proposal) throw new Error('제안을 조회하지 못했습니다.');
      return toLiveProposal(proposal, catalog);
    },
    chooseDrafts: async (row: ReviewProposal, action: 'CONTINUE' | 'REPLACE') => {
      const response = await runRequest(() =>
        client.GET('/planning/production-orders:plan-proposals', {
          params: {
            query: {
              productionOrderIds: [Number(row.id)],
              ...(action === 'CONTINUE' ? { existingDraftAction: 'CONTINUE' as const } : {}),
            },
          },
        }),
      );
      const proposal = response.items.find((item) => item.productionOrderId === Number(row.id));
      if (!proposal) throw new Error('제안을 조회하지 못했습니다.');
      return { ...toLiveProposal(proposal, catalog), existingDraftAction: action };
    },
    revalidate: async (row: ReviewProposal) => {
      const result = await runRequest(() =>
        client.POST('/planning/production-orders/{productionOrderId}:revalidate-plan-proposal', {
          params: { path: { productionOrderId: Number(row.id) } },
          body: proposalBody(row),
        }),
      );
      if (result.currentProposal)
        current.set(row.id, toLiveProposal(result.currentProposal, catalog));
      return applyRevalidation(row, result, catalog);
    },
    confirm: async (row: ReviewProposal): Promise<ReviewProposal> => {
      if (!row.validated || row.basisChanges?.length)
        throw new Error('변경한 제안을 재검증하세요.');
      const body = proposalBody(row);
      const signature = JSON.stringify([row.id, body]);
      const key = attempts.get(signature) ?? createIdempotencyKey();
      attempts.set(signature, key);
      // Required confirmation fields are checked separately from the nullable revalidation body.
      const plans = body.plans.map((plan) => ({
        ...plan,
        workOrders: plan.workOrders.map((op) => {
          if (!op.productionLineId || !op.defaultFgLocationId)
            throw new Error('생산 라인과 생산품 입고 창고를 확인하세요.');
          return {
            ...op,
            productionLineId: op.productionLineId,
            defaultFgLocationId: op.defaultFgLocationId,
            defaultWipLocationId: undefined,
            defaultScrapLocationId: undefined,
          };
        }),
      }));
      const result = await client.POST(
        '/planning/production-orders/{productionOrderId}:confirm-plan-proposal',
        {
          params: {
            path: { productionOrderId: Number(row.id) },
            header: { 'Idempotency-Key': key },
          },
          body: { ...body, plans },
        },
      );
      if (result.error && 'currentProposal' in result.error && result.error.currentProposal) {
        current.set(row.id, toLiveProposal(result.error.currentProposal, catalog));
        throw new Error(
          [
            '검토 기준이 변경되었습니다.',
            ...(result.error.proposalChanges ?? []).map((change) => change.message),
          ].join(' '),
        );
      }
      const response: ProposalConfirmation = await runRequest(async () => result);
      return {
        ...row,
        outcome: response.outcome,
        resultPlans: response.plans,
        changed: false,
        validated: false,
        confirmedQty:
          response.outcome === 'CONFIRMED'
            ? row.confirmedQty + row.plans.reduce((sum, plan) => sum + Number(plan.quantity), 0)
            : row.orderQty,
        draftQty: 0,
        remainingQty: Math.max(
          0,
          row.orderQty -
            (row.confirmedQty + row.plans.reduce((sum, plan) => sum + Number(plan.quantity), 0)),
        ),
        plans: row.plans.map((plan, index) => {
          const saved = response.plans.find(
            (saved) => saved.proposalPlanKey === body.plans[index]?.proposalPlanKey,
          );
          return {
            ...plan,
            number: saved?.planNo ?? plan.number,
            source: '기존 확정 계획' as const,
            operations: plan.operations.map((op) => ({
              ...op,
              number:
                saved?.workOrders.find((item) => item.routingOperationId === op.routingOperationId)
                  ?.workOrderNo ?? op.number,
            })),
          };
        }),
      };
    },
    error: (error: unknown) =>
      error instanceof ApiRequestError && error.apiError.kind === 'validation'
        ? error.apiError.errors.map(validationMessage).join('\n')
        : error instanceof ApiRequestError
          ? apiErrorText(error.apiError)
          : error instanceof Error
            ? error.message
            : '요청 결과를 확인하지 못했습니다.',
  };
}
