import type { LookupEntry, LookupSource } from '../../patterns/lookup-display';
import type { WorkOrderAssignmentDraft } from './assignment-model';
import type { WorkOrderFact } from './queries';

const SERVER_TO_DRAFT_FIELD: Partial<Record<string, keyof WorkOrderAssignmentDraft>> = {
  productionLineId: 'productionLineId',
  responsibleWorkerId: 'responsibleWorkerId',
  plannedEquipmentId: 'plannedEquipmentId',
  plannedMoldId: 'plannedMoldId',
  plannedShiftId: 'plannedShiftId',
  defaultWipLocationId: 'defaultWipLocationId',
  defaultFgLocationId: 'defaultFgLocationId',
  defaultScrapLocationId: 'defaultScrapLocationId',
  plannedStartAt: 'plannedStartAtLocal',
  plannedEndAt: 'plannedEndAtLocal',
  priorityNo: 'priorityNo',
};

export const mergeWorkOrderAssignmentFieldErrors = (
  client: Partial<Record<keyof WorkOrderAssignmentDraft, string>>,
  server: Record<string, string>,
): Partial<Record<keyof WorkOrderAssignmentDraft, string>> => {
  const ownedServer = Object.fromEntries(
    Object.entries(server).flatMap(([field, message]) => {
      const draftField = SERVER_TO_DRAFT_FIELD[field];
      return draftField === undefined ? [] : [[draftField, message]];
    }),
  );

  return { ...ownedServer, ...client };
};

export interface ResourceLookupState<T> {
  items: readonly T[];
  plantId: number | null;
  isPending: boolean;
  isError: boolean;
}

export const toOwnedResourceLookup = <T extends { plantId: number }>(
  state: ResourceLookupState<T>,
  map: (item: T) => LookupEntry,
): LookupSource => {
  if (state.plantId === null) return { entries: [], isLoading: false, isError: false };
  const ownerMismatch = state.items.some((item) => item.plantId !== state.plantId);
  const failed = state.isError || ownerMismatch;

  return {
    entries: failed ? [] : state.items.map(map),
    isLoading: !failed && state.isPending,
    isError: failed,
  };
};

/**
 * 고른 값이 받은 목록에 없으면 따로 안 이름을 선택지 앞에 덧붙인다.
 *
 * 목록은 한 쪽만 받으므로 자동 배정·추천으로 들어온 값이 그 밖에 있을 수 있다 — 덧붙이지 않으면
 * 정상 배정이 「알 수 없음」으로 보인다. 목록이 실패했으면 덧붙이지 않는다(실패를 감추지 않는다).
 */
export const withKeptEntry = (source: LookupSource, kept: LookupEntry | undefined): LookupSource =>
  kept === undefined || source.isError || source.entries.some((item) => item.value === kept.value)
    ? source
    : { ...source, entries: [kept, ...source.entries] };

export const isExactWorkOrderDetail = (
  requestedId: number,
  data: WorkOrderFact | undefined,
): data is WorkOrderFact => data?.workOrderId === requestedId;

export const canApplyWorkOrderReload = (
  requestedId: number,
  result: { isSuccess: boolean; data?: WorkOrderFact },
): boolean => result.isSuccess && isExactWorkOrderDetail(requestedId, result.data);
