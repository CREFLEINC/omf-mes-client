import type { ProductionOrderAutoPlanResult } from '@omf-mes/api-client';

import { useApiClient } from '../../patterns/api-context';
import { useMasterWrite, type MasterWriteResult } from '../../patterns/master';
import { productionPlanKeys } from '../production-plan/queries';
import { workOrderKeys } from '../work-order/queries';
import { productionOrderKeys } from './queries';

export interface AutoPlanOptions {
  onSuccess: (result: ProductionOrderAutoPlanResult) => void;
}

/**
 * ⚠ 본문이 빈 액션이라 멱등 키를 시도마다 새로 받는다(`per-attempt`) — 사용자가 기준정보를
 * 고치고 돌아와 다시 눌렀을 때 앞선 결과가 되돌아오면 영영 다시 계산되지 않는다.
 */
export const useAutoPlanMutation = (options: AutoPlanOptions): MasterWriteResult<number> => {
  const { client } = useApiClient();

  return useMasterWrite<number, ProductionOrderAutoPlanResult>({
    request: (productionOrderId, headers) =>
      client.POST('/planning/production-orders/{productionOrderId}:auto-plan', {
        params: {
          path: { productionOrderId },
          header: { 'Idempotency-Key': headers['Idempotency-Key'] },
        },
      }),
    etagPath: null,
    /* 계획·W/O 화면이 들고 있는 캐시도 이 P/O 의 계획이 바뀐 것을 봐야 한다. */
    invalidateKeys: [productionOrderKeys.all, productionPlanKeys.all, workOrderKeys.all],
    knownFields: [],
    onSuccess: options.onSuccess,
  });
};
