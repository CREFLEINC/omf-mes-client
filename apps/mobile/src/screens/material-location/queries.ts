import type { components } from '@omf-mes/api-client';
import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { useApiClient } from '../../patterns/api-context';
import { runRequest } from '../../patterns/request';

type Client = ReturnType<typeof useApiClient>['client'];

export type InventoryBalance = components['schemas']['InventoryBalance'];
export type LotHold = components['schemas']['LotHold'];

export const materialLocationKeys = {
  balances: (lotId: number | null) => ['material-location-balances', lotId] as const,
  holds: (lotId: number | null) => ['material-location-holds', lotId] as const,
};

const fetchBalances = async (client: Client, lotId: number): Promise<InventoryBalance[]> => {
  const data = await runRequest(() =>
    client.GET('/inventory/balances', {
      // 창고를 모른 채 들어오는 경로다. 위치별로 갈라야 한 LOT이 여러 자리에 있는 것이 보이고,
      // 잔액 0인 줄까지 받아야 소진된 자리를 표시할 수 있다.
      params: { query: { lotId, groupBy: 'LOCATION', includeZero: true } },
    }),
  );

  return data.items;
};

export const useLotBalances = (lotId: number | null): UseQueryResult<InventoryBalance[]> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: materialLocationKeys.balances(lotId),
    enabled: lotId !== null,
    queryFn: () => {
      if (lotId === null) {
        throw new Error('LOT을 찾기 전에는 잔액을 조회하지 않습니다.');
      }

      return fetchBalances(client, lotId);
    },
  });
};

const fetchHolds = async (client: Client, lotId: number): Promise<LotHold[]> => {
  const data = await runRequest(() =>
    client.GET('/trace/lots/{lotId}/holds', {
      // 해제된 보류까지 보이면 지금 묶여 있는 것으로 읽힌다.
      params: { path: { lotId }, query: { activeOnly: true } },
    }),
  );

  return data.items;
};

export const useLotHolds = (lotId: number | null): UseQueryResult<LotHold[]> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: materialLocationKeys.holds(lotId),
    enabled: lotId !== null,
    queryFn: () => {
      if (lotId === null) {
        throw new Error('LOT을 찾기 전에는 보류를 조회하지 않습니다.');
      }

      return fetchHolds(client, lotId);
    },
  });
};
