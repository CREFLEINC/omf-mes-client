import type { components } from '@omf-mes/api-client';
import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { useApiClient } from '../../patterns/api-context';
import { runRequest } from '../../patterns/request';

type Client = ReturnType<typeof useApiClient>['client'];

export type InventoryBalance = components['schemas']['InventoryBalance'];
export type LotHold = components['schemas']['LotHold'];

/** 스캔값이 가리키는 LOT. 찾지 못하면 null이며, 조회 실패와는 다른 결과다. */
export type ScannedLot = { lotId: number; lotNo: string; itemId: number } | null;

export const materialLocationKeys = {
  lot: (code: string | null) => ['material-location-lot', code] as const,
  balances: (lotId: number | null) => ['material-location-balances', lotId] as const,
  holds: (lotId: number | null) => ['material-location-holds', lotId] as const,
};

const findLot = async (client: Client, code: string): Promise<ScannedLot> => {
  /*
   * 정확 일치로 묻는다. 부분 검색은 LOT 번호와 외부 식별자를 함께 훑어 여러 줄이 오고,
   * 그러면 찾는 줄이 첫 페이지 밖으로 밀릴 수 있다. 밀린 것은 없는 것과 구별되지 않는다.
   */
  const data = await runRequest(() =>
    client.GET('/trace/lots', { params: { query: { lotNo: code } } }),
  );

  /*
   * 돌아온 줄도 확인한다. 정확 일치가 지켜지지 않으면 첫 줄은 다른 LOT 이고, 그때 화면은
   * 남의 위치와 수량을 이 LOT 의 것으로 보인다. 없다고 하는 편이 낫다.
   */
  const found = data.items.find((lot) => lot.lotNo === code);

  return found === undefined
    ? null
    : { lotId: found.lotId, lotNo: found.lotNo, itemId: found.itemId };
};

/**
 * 스캔값으로 LOT을 찾는다. 찾지 못한 것과 조회가 실패한 것을 훅이 갈라 준다 —
 * 전자는 데이터가 돌아온 정상 결과(null)이고 후자는 오류 상태다.
 */
export const useScannedLot = (code: string | null): UseQueryResult<ScannedLot> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: materialLocationKeys.lot(code),
    enabled: code !== null,
    queryFn: () => {
      if (code === null) {
        throw new Error('스캔하기 전에는 LOT을 조회하지 않습니다.');
      }

      return findLot(client, code);
    },
  });
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
