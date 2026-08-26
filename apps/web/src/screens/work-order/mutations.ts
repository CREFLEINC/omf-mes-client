import type { components } from '@omf-mes/api-client';

import { useApiClient } from '../../patterns/api-context';
import { useMasterWrite, type MasterWriteResult } from '../../patterns/master';
import { toWorkOrderFact, workOrderDetailPath, workOrderKeys, type WorkOrderFact } from './queries';

type WorkOrder = components['schemas']['WorkOrder'];
type WorkOrderUpdate = components['schemas']['WorkOrderUpdate'];

const WORK_ORDER_ASSIGNMENT_FIELDS = [
  'priorityNo',
  'plannedStartAt',
  'plannedEndAt',
  'plannedEquipmentId',
  'plannedMoldId',
  'plannedShiftId',
  'productionLineId',
  'responsibleWorkerId',
] as const;

export interface UpdateWorkOrderOptions {
  workOrderId: number;
  onSuccess: (data: WorkOrderFact) => void;
}

export const useUpdateWorkOrder = (
  options: UpdateWorkOrderOptions,
): MasterWriteResult<WorkOrderUpdate> => {
  const { client } = useApiClient();

  return useMasterWrite<WorkOrderUpdate, WorkOrder>({
    request: (body, headers) =>
      client.PUT('/production/work-orders/{workOrderId}', {
        params: {
          path: { workOrderId: options.workOrderId },
          header: {
            'Idempotency-Key': headers['Idempotency-Key'],
            'If-Match': headers['If-Match'] ?? '',
          },
        },
        body,
      }),
    etagPath: workOrderDetailPath(options.workOrderId),
    invalidateKeys: [workOrderKeys.all],
    knownFields: WORK_ORDER_ASSIGNMENT_FIELDS,
    onSuccess: (data) => {
      options.onSuccess(toWorkOrderFact(data));
    },
  });
};
