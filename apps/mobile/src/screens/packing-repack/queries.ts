import { useQueries, useQuery, type UseQueryResult } from '@tanstack/react-query';
import type { components } from '@omf-mes/api-client';

import { useApiClient } from '../../patterns/api-context';
import type { ScannedHandlingUnit } from '../../patterns/handling-units';
import { runRequest } from '../../patterns/request';
import type { AllocationCheck } from './repack';

/** 배분이 하나라도 있으면 막힌다. 세어 볼 것이 아니라 있는지만 보면 된다. */
const PROBE_SIZE = 1;

const verdictOf = (result: { isPending: boolean; data?: boolean } | undefined): AllocationCheck => {
  if (result === undefined || result.isPending) {
    return 'checking';
  }

  return result.data === undefined ? 'unknown' : result.data ? 'allocated' : 'clear';
};

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
          (handlingUnitId, index) => [handlingUnitId, verdictOf(results[index])] as const,
        ),
      ),
  });
};

export type RepackEvent = components['schemas']['HandlingUnitRepackEvent'];

/**
 * 이 포장을 무엇이 언제 어떻게 바꿨는가.
 *
 * 되돌리기가 없는 화면이라 지난 재구성을 되짚을 길이 화면 안에 있어야 한다 - 없으면 수량이
 * 왜 다른지를 물건을 세어 맞춰야 한다.
 *
 * 사람이 열었을 때만 묻는다. 스캔마다 부르면 쓰지 않는 조회가 스캔 응답 뒤에 붙는다.
 */
export const useRepackEvents = (
  handlingUnitId: number | null,
  enabled: boolean,
): UseQueryResult<RepackEvent[]> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: ['repack-events', handlingUnitId] as const,
    enabled: enabled && handlingUnitId !== null,
    queryFn: async () => {
      if (handlingUnitId === null) {
        throw new Error('포장을 스캔하기 전에는 이력을 조회하지 않습니다.');
      }

      const data = await runRequest(() =>
        client.GET('/inventory/handling-units/{handlingUnitId}/repack-events', {
          params: { path: { handlingUnitId } },
        }),
      );

      return data.items;
    },
  });
};
