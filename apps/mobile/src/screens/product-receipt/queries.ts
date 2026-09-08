import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { useApiClient } from '../../patterns/api-context';
import { runRequest } from '../../patterns/request';
import type { HandlingUnit, HandlingUnitContent, Lot, Warehouse } from './receipt';

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
