import type { components } from '@omf-mes/api-client';

import { useApiClient } from '../../patterns/api-context';
import { requireIfMatch, useMasterWrite, type MasterWriteResult } from '../../patterns/master';
import {
  toWorkOrderCloseFact,
  workOrderCloseDetailPath,
  workOrderCloseKeys,
  type WorkOrderCloseFact,
} from './queries';

type WorkOrder = components['schemas']['WorkOrder'];
type WorkOrderClose = components['schemas']['WorkOrderClose'];

const WORK_ORDER_CLOSE_FIELDS = ['remainderDispositionCode', 'reasonCode', 'remarks'] as const;

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
            /* ⛔ 계약이 이 헤더를 필수로 요구한다 — 없으면 빈 값을 채우지 않고 멈춘다. */
            'If-Match': requireIfMatch(headers),
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
