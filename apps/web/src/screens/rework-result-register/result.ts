import type { DispositionList, ProductionResultCreate, WorkOrder } from './types';

export const REWORK_WORK_ORDER_TYPE_CODE = 'REWORK';
// Temporary pending the design decision tracked by omf-mes#393.
export const RESULT_SOURCE_CODE = 'MANUAL';

export type QuantityKey = 'goodQty' | 'defectQty' | 'holdQty' | 'scrapQty';
export type QuantityDrafts = Record<QuantityKey, string>;

export const EMPTY_QUANTITIES: QuantityDrafts = {
  goodQty: '',
  defectQty: '',
  holdQty: '',
  scrapQty: '',
};

export const readQuantity = (value: string): number => {
  if (value.trim() === '') return 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
};

export const quantityTotal = (drafts: QuantityDrafts): number =>
  Object.values(drafts).reduce((sum, value) => sum + readQuantity(value), 0);

export type QuantityVerdict = 'empty' | 'partial' | 'complete' | 'exceeded';

export const quantityVerdict = (total: number, target: number): QuantityVerdict => {
  if (total <= 0) return 'empty';
  if (total > target) return 'exceeded';
  if (total < target) return 'partial';
  return 'complete';
};

export const reworkDispositionProgress = (items: DispositionList['items']) =>
  items
    .filter((item) => item.dispositionTypeCode === REWORK_WORK_ORDER_TYPE_CODE)
    .reduce(
      (progress, item) => ({
        target: progress.target + item.decisionQty,
        completed: progress.completed + item.followUpQty,
        remaining: progress.remaining + Math.max(0, item.decisionQty - item.followUpQty),
      }),
      { target: 0, completed: 0, remaining: 0 },
    );

const pad = (value: number, length: number): string => String(value).padStart(length, '0');

export const toOffsetDateTime = (at: Date): string => {
  const minutes = -at.getTimezoneOffset();
  const sign = minutes < 0 ? '-' : '+';
  const absolute = Math.abs(minutes);
  return `${at.getFullYear()}-${pad(at.getMonth() + 1, 2)}-${pad(at.getDate(), 2)}T${pad(at.getHours(), 2)}:${pad(at.getMinutes(), 2)}:${pad(at.getSeconds(), 2)}${sign}${pad(Math.floor(absolute / 60), 2)}:${pad(absolute % 60, 2)}`;
};

export const toProductionResult = (
  workOrder: WorkOrder,
  drafts: QuantityDrafts,
  occurredAt: Date,
): ProductionResultCreate => ({
  workOrderId: workOrder.workOrderId,
  goodQty: readQuantity(drafts.goodQty),
  defectQty: readQuantity(drafts.defectQty),
  holdQty: readQuantity(drafts.holdQty),
  scrapQty: readQuantity(drafts.scrapQty),
  reworkQty: 0,
  uomId: workOrder.uomId,
  resultSourceCode: RESULT_SOURCE_CODE,
  occurredAt: toOffsetDateTime(occurredAt),
});
