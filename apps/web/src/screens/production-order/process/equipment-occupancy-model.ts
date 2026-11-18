import type { components } from '@omf-mes/api-client';
import { PLANT_UTC_OFFSET } from '../../../patterns/plant-time';

export type EquipmentAllocation = components['schemas']['WorkOrder'];
const releasedStatuses = new Set(['CANCELLED', 'CLOSED', 'COMPLETED']);

export const allocationInstant = (value: string | null | undefined): number => {
  if (!value || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(value)) return NaN;
  return Date.parse(/(?:Z|[+-]\d{2}:\d{2})$/.test(value) ? value : value + PLANT_UTC_OFFSET);
};
export const validAllocationWindow = (start: string, end: string): boolean =>
  allocationInstant(start) < allocationInstant(end);

/** 시작일 조건으로 먼저 거르면 전날 시작해 오늘까지 이어지는 배정을 놓친다. */
export const activeEquipmentAllocations = (
  rows: readonly EquipmentAllocation[],
  selfId: number,
): EquipmentAllocation[] =>
  rows.filter((row) => row.workOrderId !== selfId && !releasedStatuses.has(row.statusCode));
export const allocationOverlap = (row: EquipmentAllocation, start: string, end: string) => {
  const from = Math.max(allocationInstant(row.plannedStartAt), allocationInstant(start));
  const to = Math.min(allocationInstant(row.plannedEndAt), allocationInstant(end));
  return from < to
    ? {
        start: new Date(from).toISOString(),
        end: new Date(to).toISOString(),
        minutes: (to - from) / 60000,
      }
    : null;
};
export const allocationReview = (
  rows: readonly EquipmentAllocation[],
  start: string,
  end: string,
) => ({
  conflicts: rows.filter((row) => allocationOverlap(row, start, end) !== null),
  unknown: rows.filter(
    (row) => !validAllocationWindow(row.plannedStartAt ?? '', row.plannedEndAt ?? ''),
  ),
});
export const allocationStatus = (
  rows: readonly EquipmentAllocation[],
  start: string,
  end: string,
): string => {
  if (!validAllocationWindow(start, end)) return '계획 시간 확인 필요';
  const { conflicts, unknown } = allocationReview(rows, start, end);
  return (
    [
      conflicts.length ? `배정 시간 중복 ${conflicts.length}건` : '',
      unknown.length ? `배정 시간 미등록 ${unknown.length}건` : '',
    ]
      .filter(Boolean)
      .join(' · ') || '중복 없음'
  );
};
