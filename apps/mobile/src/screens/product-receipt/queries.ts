import { useQueries, useQuery, type UseQueryResult } from '@tanstack/react-query';

import { useApiClient } from '../../patterns/api-context';
import { runRequest } from '../../patterns/request';
import type {
  HandlingUnit,
  HandlingUnitContent,
  Lot,
  PutawayRule,
  StockedCheck,
  Warehouse,
} from './receipt';

const PAGE_SIZE = 200;

/** 물건이 들어갈 창고. 인식표가 지금 있는 자리와 다르다. */
export const useWarehouses = (): UseQueryResult<Warehouse[]> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: ['product-receipt-warehouses'] as const,
    queryFn: async () => {
      const data = await runRequest(() =>
        client.GET('/mdm/warehouses', { params: { query: { size: PAGE_SIZE } } }),
      );

      return data.items.filter((warehouse) => warehouse.isActive);
    },
  });
};

/**
 * 스캔한 인식표.
 *
 * 계약에 정확 일치 축이 없어 부분 검색으로 받고 화면이 정확 일치만 고른다. 목록이 쪽 단위라
 * 일치 건이 뒷쪽에 있으면 놓칠 수 있다 - 그 한계를 알고 쓴다.
 */
export const useHandlingUnitByNo = (
  handlingUnitNo: string | null,
): UseQueryResult<HandlingUnit | null> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: ['product-receipt-unit', handlingUnitNo] as const,
    enabled: handlingUnitNo !== null && handlingUnitNo !== '',
    /*
     * 공유계약 C-6 - 판정에 쓰는 값은 캐시하지 않는다. 다른 단말이 방금 입고한 인식표를 낡은
     * 응답으로 보이면 같은 LOT 을 두 번 재고로 세운다.
     */
    staleTime: 0,
    gcTime: 0,
    queryFn: async () => {
      if (handlingUnitNo === null || handlingUnitNo === '') {
        throw new Error('인식표를 스캔하기 전에는 조회하지 않습니다.');
      }

      const data = await runRequest(() =>
        client.GET('/inventory/handling-units', {
          params: { query: { q: handlingUnitNo, size: PAGE_SIZE } },
        }),
      );

      return data.items.find((unit) => unit.handlingUnitNo === handlingUnitNo) ?? null;
    },
  });
};

/** 인식표에 담긴 것. 이것이 입고 라인이 된다. */
export const useUnitContents = (
  handlingUnitId: number | null,
): UseQueryResult<HandlingUnitContent[]> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: ['product-receipt-contents', handlingUnitId] as const,
    enabled: handlingUnitId !== null,
    staleTime: 0,
    gcTime: 0,
    queryFn: async () => {
      if (handlingUnitId === null) {
        throw new Error('인식표를 고르기 전에는 담긴 것을 조회하지 않습니다.');
      }

      const data = await runRequest(() =>
        client.GET('/inventory/handling-units/{handlingUnitId}/contents', {
          params: { path: { handlingUnitId } },
        }),
      );

      return data.items;
    },
  });
};

/**
 * 담긴 LOT 들의 상세.
 *
 * 제조 일시·유효기간과 검사 상태를 여기서 얻는다. 상태는 판정에 쓰는 값이라 캐시하지 않고,
 * 오프라인에서는 물어볼 수 없어 화면이 그 사실을 적는다.
 */
export const useLots = (lotIds: number[]): UseQueryResult<Map<number, Lot>> => {
  const { client } = useApiClient();
  const key = lotIds.join(',');

  return useQuery({
    queryKey: ['product-receipt-lots', key] as const,
    enabled: lotIds.length > 0,
    staleTime: 0,
    gcTime: 0,
    queryFn: async () => {
      const details = await Promise.all(
        lotIds.map((lotId) =>
          runRequest(() => client.GET('/trace/lots/{lotId}', { params: { path: { lotId } } })),
        ),
      );

      return new Map(details.map((detail) => [detail.lot.lotId, detail.lot]));
    },
  });
};

/**
 * 이 품목이 이 창고에서 가야 할 자리를 정하는 규칙.
 *
 * 적치 지시는 입고 응답에서야 생긴다 - 스캔한 위치가 맞는지는 그 전에 알아야 하므로 규칙을
 * 직접 묻는다.
 */
export const usePutawayRules = (
  warehouseId: number | null,
  itemId: number | null,
): UseQueryResult<PutawayRule[]> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: ['product-receipt-putaway-rules', warehouseId, itemId] as const,
    enabled: warehouseId !== null && itemId !== null,
    queryFn: async () => {
      if (warehouseId === null || itemId === null) {
        throw new Error('창고와 품목을 정하기 전에는 적치 규칙을 조회하지 않습니다.');
      }

      const data = await runRequest(() =>
        client.GET('/logistics/putaway-rules', {
          params: { query: { warehouseId, itemId, size: PAGE_SIZE } },
        }),
      );

      return data.items;
    },
  });
};

/** 잔액이 하나라도 있으면 이미 선 것이다. 세어 볼 것이 아니라 있는지만 보면 된다. */
const PROBE_SIZE = 1;

const verdictOf = (result: { isPending: boolean; data?: boolean } | undefined): StockedCheck => {
  if (result === undefined || result.isPending) {
    return 'checking';
  }

  return result.data === undefined ? 'unknown' : result.data ? 'stocked' : 'clear';
};

/**
 * 이 LOT 이 이미 재고로 서 있는가.
 *
 * 큐만 보면 다른 단말이 먼저 입고한 것을 놓친다 - 이 화면이 재고를 세우는 지점이라 두 번
 * 서면 같은 제품이 두 벌이 된다.
 */
export const useStockedLots = (lotIds: number[]): Map<number, StockedCheck> => {
  const { client } = useApiClient();
  const ids = [...new Set(lotIds)];

  return useQueries({
    queries: ids.map((lotId) => ({
      queryKey: ['product-receipt-stocked', lotId] as const,
      /*
       * 공유계약 C-6 - 판정에 쓰는 값은 캐시하지 않는다. 다른 단말의 입고는 이 화면 밖에서
       * 일어나므로 조금 전에 없었다는 것이 지금 없다는 뜻이 아니다.
       */
      staleTime: 0,
      gcTime: 0,
      queryFn: async () => {
        const data = await runRequest(() =>
          client.GET('/inventory/balances', { params: { query: { lotId, size: PROBE_SIZE } } }),
        );

        return data.items.length > 0;
      },
    })),
    combine: (results) =>
      new Map(ids.map((lotId, index) => [lotId, verdictOf(results[index])] as const)),
  });
};
