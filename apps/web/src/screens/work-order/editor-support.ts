import type { LookupEntry, LookupSource } from '../../patterns/lookup-display';
import type { WorkOrderAssignmentDraft } from './assignment-model';
import type { WorkOrderFact } from './queries';

const SERVER_TO_DRAFT_FIELD: Partial<Record<string, keyof WorkOrderAssignmentDraft>> = {
  productionLineId: 'productionLineId',
  responsibleWorkerId: 'responsibleWorkerId',
  plannedEquipmentId: 'plannedEquipmentId',
  plannedMoldId: 'plannedMoldId',
  plannedShiftId: 'plannedShiftId',
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

export const isExactWorkOrderDetail = (
  requestedId: number,
  data: WorkOrderFact | undefined,
): data is WorkOrderFact => data?.workOrderId === requestedId;

export const canApplyWorkOrderReload = (
  requestedId: number,
  result: { isSuccess: boolean; data?: WorkOrderFact },
): boolean => result.isSuccess && isExactWorkOrderDetail(requestedId, result.data);
