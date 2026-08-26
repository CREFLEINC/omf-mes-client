import type { components } from '@omf-mes/api-client';

import { useApiClient } from '../../patterns/api-context';
import { useMasterWrite, type MasterWriteResult } from '../../patterns/master';
import { workOrderKeys } from '../work-order/queries';
import {
  toWorkOrderReleaseFact,
  workOrderReleaseDetailPath,
  workOrderReleaseKeys,
  type WorkOrderReleaseFact,
} from './queries';

type WorkOrder = components['schemas']['WorkOrder'];
type WorkOrderRelease = components['schemas']['WorkOrderRelease'];

interface ReleaseWorkOrderCommand {
  workOrderId: number;
  body: WorkOrderRelease;
}

const WORK_ORDER_RELEASE_FIELDS = ['lotSize', 'handoverNote'] as const;

export interface ReleaseWorkOrderOptions {
  workOrderId: number;
  onSuccess: (data: WorkOrderReleaseFact) => void;
}

export const useReleaseWorkOrder = (
  options: ReleaseWorkOrderOptions,
): MasterWriteResult<WorkOrderRelease> => {
  const { client } = useApiClient();

  const mutation = useMasterWrite<ReleaseWorkOrderCommand, WorkOrder>({
    request: (command, headers) =>
      client.POST('/production/work-orders/{workOrderId}:release', {
        params: {
          path: { workOrderId: command.workOrderId },
          header: {
            'Idempotency-Key': headers['Idempotency-Key'],
            'If-Match': headers['If-Match'] ?? '',
          },
        },
        body: {
          lotSize: command.body.lotSize,
          ...(command.body.handoverNote === undefined
            ? {}
            : { handoverNote: command.body.handoverNote }),
        },
      }),
    etagPath: workOrderReleaseDetailPath(options.workOrderId),
    invalidateKeys: [workOrderReleaseKeys.all, workOrderKeys.all],
    knownFields: WORK_ORDER_RELEASE_FIELDS,
    keyLifetime: 'until-applied',
    onSuccess: (data) => {
      options.onSuccess(toWorkOrderReleaseFact(data));
    },
  });

  return {
    ...mutation,
    write: (body) => mutation.write({ workOrderId: options.workOrderId, body }),
  };
};
