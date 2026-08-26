import { messages } from '@omf-mes/i18n';

import { describeItem } from '../production-order/screen-model';
import type { ProductionOrderItemName } from '../production-order/item-lookups';
import {
  describeReference,
  resolveReference,
  type ReferenceSource,
} from '../production-order/reference-lookups';
import type { WorkOrderReleaseFact } from './queries';
import type { WorkOrderReleaseSummaryView } from './work-order-release-summary-pane';

const values = messages.productionOrder.values;

export interface ReleaseSummaryQuery<T> {
  data: T | undefined;
  isError: boolean;
  isPending: boolean;
}

export interface ReleaseSummaryList<T> extends ReleaseSummaryQuery<{
  items: readonly T[];
  truncated: boolean;
}> {}

export interface WorkOrderReleaseSummarySources {
  itemNames: readonly ProductionOrderItemName[];
  uoms: ReferenceSource;
  plan: ReleaseSummaryQuery<{
    productionPlanId: number;
    productionOrderId: number;
    routingId: number;
  }>;
  productionOrder: ReleaseSummaryQuery<{ productionOrderId: number; plantId: number | null }>;
  routing: ReleaseSummaryQuery<{
    routing: { routingId: number; routingCode: string; routingVersion: number };
  }>;
  operations: ReleaseSummaryQuery<{
    items: readonly { routingOperationId: number; operationName: string }[];
  }>;
  productionLines: ReleaseSummaryList<{
    productionLineId: number;
    lineCode: string;
    lineName: string;
  }>;
  equipments: ReleaseSummaryList<{
    equipmentId: number;
    equipmentCode: string;
    equipmentName: string;
  }>;
  molds: ReleaseSummaryList<{ moldId: number; moldCode: string; moldName: string }>;
  shifts: ReleaseSummaryList<{ shiftId: number; shiftCode: string; shiftName: string }>;
}

const queryReason = (queries: readonly ReleaseSummaryQuery<unknown>[]): string | null => {
  if (queries.some((query) => query.isError)) return values.referenceFailed;
  if (queries.some((query) => query.isPending)) return values.referenceLoading;
  return null;
};

const listLabel = <T>(
  id: number | null,
  parentReason: string | null,
  list: ReleaseSummaryList<T>,
  idOf: (item: T) => number,
  labelOf: (item: T) => string,
): string | null => {
  if (id === null) return null;
  if (parentReason !== null) return parentReason;
  const ownReason = queryReason([list]);
  if (ownReason !== null) return ownReason;
  const match = list.data?.items.find((item) => idOf(item) === id);
  if (match !== undefined) return labelOf(match);
  return list.data?.truncated === true ? values.referenceTruncated : values.referenceUnknown;
};

const plannedPeriod = (detail: WorkOrderReleaseFact): string | null => {
  const values = [detail.plannedStartAt, detail.plannedEndAt].filter(
    (value): value is string => value !== null,
  );
  return values.length === 0 ? null : values.join(' ~ ');
};

export const toWorkOrderReleaseSummaryView = (
  detail: WorkOrderReleaseFact,
  sources: WorkOrderReleaseSummarySources,
): WorkOrderReleaseSummaryView => {
  const itemNames = new Map(sources.itemNames.map((item) => [item.itemId, item]));
  const uomLabel = describeReference(resolveReference(sources.uoms, detail.uomId));
  const planQueryReason = queryReason([sources.plan]);
  const plan =
    planQueryReason === null && sources.plan.data?.productionPlanId === detail.productionPlanId
      ? sources.plan.data
      : undefined;
  const planReason = planQueryReason ?? (plan === undefined ? values.referenceUnknown : null);
  const productionOrderQueryReason = queryReason([sources.productionOrder]);
  const productionOrder =
    plan !== undefined &&
    productionOrderQueryReason === null &&
    sources.productionOrder.data?.productionOrderId === plan.productionOrderId
      ? sources.productionOrder.data
      : undefined;
  const resourceReason =
    planReason ??
    productionOrderQueryReason ??
    (productionOrder === undefined ? values.referenceUnknown : null);
  const routing =
    plan !== undefined && sources.routing.data?.routing.routingId === plan.routingId
      ? sources.routing.data.routing
      : undefined;
  const operation =
    plan === undefined
      ? undefined
      : sources.operations.data?.items.find(
          (candidate) => candidate.routingOperationId === detail.routingOperationId,
        );

  return {
    workOrderNo: detail.workOrderNo,
    itemLabel: describeItem(detail.itemId, itemNames),
    quantityLabel: `${String(detail.orderQty)} ${uomLabel}`,
    operationLabel:
      planReason ??
      queryReason([sources.operations]) ??
      operation?.operationName ??
      values.referenceUnknown,
    routingRevisionLabel:
      planReason ??
      queryReason([sources.routing]) ??
      (routing === undefined
        ? values.referenceUnknown
        : `${routing.routingCode} · Rev ${String(routing.routingVersion)}`),
    productionLineLabel: listLabel(
      detail.productionLineId,
      resourceReason,
      sources.productionLines,
      (line) => line.productionLineId,
      (line) => `${line.lineCode} · ${line.lineName}`,
    ),
    equipmentLabel: listLabel(
      detail.plannedEquipmentId,
      resourceReason,
      sources.equipments,
      (equipment) => equipment.equipmentId,
      (equipment) => `${equipment.equipmentCode} · ${equipment.equipmentName}`,
    ),
    moldLabel: listLabel(
      detail.plannedMoldId,
      resourceReason,
      sources.molds,
      (mold) => mold.moldId,
      (mold) => `${mold.moldCode} · ${mold.moldName}`,
    ),
    shiftLabel: listLabel(
      detail.plannedShiftId,
      resourceReason,
      sources.shifts,
      (shift) => shift.shiftId,
      (shift) => `${shift.shiftCode} · ${shift.shiftName}`,
    ),
    plannedPeriodLabel: plannedPeriod(detail),
  };
};
