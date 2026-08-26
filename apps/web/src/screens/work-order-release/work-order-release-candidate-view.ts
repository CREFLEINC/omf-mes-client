import { describeItem } from '../production-order/screen-model';
import type { ProductionOrderItemName } from '../production-order/item-lookups';
import {
  describeReference,
  resolveReference,
  type ReferenceSource,
} from '../production-order/reference-lookups';
import type { WorkOrderReleaseCandidateRow } from './work-order-release-candidate-list-pane';
import type { WorkOrderReleaseCandidateSnapshot } from './work-order-release-screen-model';
import type { WorkOrderReleaseFact } from './queries';

interface WorkOrderReleaseCandidateQuerySnapshotSource {
  enabled: boolean;
  isFetching: boolean;
  isError: boolean;
  candidateIds: readonly number[] | undefined;
}

export const toWorkOrderReleaseCandidateSnapshot = ({
  enabled,
  isFetching,
  isError,
  candidateIds,
}: WorkOrderReleaseCandidateQuerySnapshotSource): WorkOrderReleaseCandidateSnapshot => {
  if (!enabled) return { kind: 'ABSENT' };
  if (isFetching) return { kind: 'PENDING' };
  if (isError) return { kind: 'FAILED' };
  if (candidateIds === undefined) return { kind: 'ABSENT' };
  return { kind: 'SETTLED', candidateIds };
};

export const toWorkOrderReleaseCandidateRows = (
  candidates: readonly WorkOrderReleaseFact[],
  itemNames: readonly ProductionOrderItemName[],
  uoms: ReferenceSource,
): WorkOrderReleaseCandidateRow[] => {
  const namesById = new Map(itemNames.map((item) => [item.itemId, item]));

  return candidates.map((candidate) => ({
    workOrderId: candidate.workOrderId,
    workOrderNo: candidate.workOrderNo,
    itemLabel: describeItem(candidate.itemId, namesById),
    quantityLabel: `${String(candidate.orderQty)} ${describeReference(
      resolveReference(uoms, candidate.uomId),
    )}`,
  }));
};
