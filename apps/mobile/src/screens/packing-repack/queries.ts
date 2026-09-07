import { useQueries } from '@tanstack/react-query';

import { useApiClient } from '../../patterns/api-context';
import type { ScannedHandlingUnit } from '../../patterns/handling-units';
import { runRequest } from '../../patterns/request';
import type { AllocationCheck } from './repack';

/** 배분이 하나라도 있으면 막힌다. 세어 볼 것이 아니라 있는지만 보면 된다. */
const PROBE_SIZE = 1;

const verdictOf = (data: boolean | undefined): AllocationCheck =>
  data === undefined ? 'unknown' : data ? 'allocated' : 'clear';

/**
 * 원 포장이 이미 출하에 배분됐는가.
 *
 * 재구성하면 출하 쪽 배분이 가리키던 물건이 사라지고 되돌릴 길이 없다 - 새 포장은 이미
 * 만들어진 뒤라 치환이 거부돼도 원 포장이 그대로 남는다.
 */
export const useShipmentAllocations = (
  sources: ScannedHandlingUnit[],
): Map<number, AllocationCheck> => {
  const { client } = useApiClient();
  const handlingUnitIds = sources.map((source) => source.handlingUnit.handlingUnitId);

  return useQueries({
    queries: handlingUnitIds.map((handlingUnitId) => ({
      queryKey: ['repack-shipment-allocation', handlingUnitId] as const,
      /*
       * 공유계약 C-6 - 판정에 쓰는 값은 캐시하지 않는다. 배분은 이 화면 밖에서 생기므로
       * 조금 전에 없었다는 것이 지금 없다는 뜻이 아니다.
       */
      staleTime: 0,
      gcTime: 0,
      queryFn: async () => {
        const data = await runRequest(() =>
          client.GET('/logistics/shipment-lot-allocations', {
            params: { query: { handlingUnitId, size: PROBE_SIZE } },
          }),
        );

        return data.items.length > 0;
      },
    })),
    combine: (results) =>
      new Map(
        handlingUnitIds.map(
          (handlingUnitId, index) => [handlingUnitId, verdictOf(results[index]?.data)] as const,
        ),
      ),
  });
};
