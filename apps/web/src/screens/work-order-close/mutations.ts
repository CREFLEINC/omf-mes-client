import type { components } from '@omf-mes/api-client';

import { useApiClient } from '../../patterns/api-context';
import { useMasterWrite, type MasterWriteResult } from '../../patterns/master';
import {
  toWorkOrderCloseFact,
  workOrderCloseDetailPath,
  workOrderCloseKeys,
  type WorkOrderCloseFact,
} from './queries';

type WorkOrder = components['schemas']['WorkOrder'];
type WorkOrderClose = components['schemas']['WorkOrderClose'];

const WORK_ORDER_CLOSE_FIELDS = ['remainderDispositionCode', 'reasonCode', 'erpSendItems'] as const;

export interface WorkOrderCloseMutationOptions {
  workOrderId: number;
  onSuccess: (data: WorkOrderCloseFact) => void;
}

export const useWorkOrderCloseMutation = (
  options: WorkOrderCloseMutationOptions,
): MasterWriteResult<WorkOrderClose> => {
  const { client } = useApiClient();

  return useMasterWrite<WorkOrderClose, WorkOrder>({
    request: (body, headers) =>
      client.POST('/production/work-orders/{workOrderId}:close', {
        params: {
          path: { workOrderId: options.workOrderId },
          header: {
            'Idempotency-Key': headers['Idempotency-Key'],
            'If-Match': headers['If-Match'] ?? '',
          },
        },
        body,
      }),
    etagPath: workOrderCloseDetailPath(options.workOrderId),
    invalidateKeys: [workOrderCloseKeys.all],
    knownFields: WORK_ORDER_CLOSE_FIELDS,
    keyLifetime: 'until-applied',
    onSuccess: (data) => {
      options.onSuccess(toWorkOrderCloseFact(data));
    },
  });
};
