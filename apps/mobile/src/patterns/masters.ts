import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { useApiClient } from './api-context';
import { runRequest } from './request';

export const masterKeys = {
  item: (itemId: number | null) => ['master-item', itemId] as const,
  items: () => ['master-items'] as const,
  uoms: () => ['master-uoms'] as const,
};

export interface ItemSummary {
  itemCode: string;
  itemName: string;
  /** 선출 정책. 품목마다 다르고 전사 고정이 아니다. */
  fifoPolicyCode: string;
}

/** 계약의 LOT 응답에 품목 이름이 없어 되짚어 부른다. 스캔한 것이 맞는지 사람이 볼 값이다. */
export const useItem = (itemId: number | null): UseQueryResult<ItemSummary> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: masterKeys.item(itemId),
    enabled: itemId !== null,
    queryFn: async () => {
      if (itemId === null) {
        throw new Error('LOT을 찾기 전에는 품목을 조회하지 않습니다.');
      }

      const data = await runRequest(() =>
        client.GET('/mdm/items/{itemId}', { params: { path: { itemId } } }),
      );

      return {
        itemCode: data.item.itemCode,
        itemName: data.item.itemName,
        fifoPolicyCode: data.item.fifoPolicyCode,
      };
    },
  });
};

/** 단위는 단건 조회가 없어 목록으로 받는다. 미사용 단위를 쓰는 과거 기록도 이름이 나오게 한다. */
export const useUomCodes = (enabled: boolean): UseQueryResult<Map<number, string>> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: masterKeys.uoms(),
    enabled,
    queryFn: async () => {
      const data = await runRequest(() =>
        client.GET('/mdm/uoms', { params: { query: { includeInactive: true } } }),
      );

      return new Map(data.items.map((uom) => [uom.uomId, uom.uomCode]));
    },
  });
};

/**
 * 품목 이름표. 목록에 여러 품목이 섞여 나올 때 쓴다.
 *
 * 목록 응답이 품목 식별자만 주는 자리가 많다. 그 번호를 그대로 보이면 작업자가 실물 라벨과
 * 대조할 수 없다 - 라벨에는 품목 코드가 찍혀 있지 대리키가 찍혀 있지 않다.
 */
export const useItemLabels = (enabled: boolean): UseQueryResult<Map<number, ItemSummary>> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: masterKeys.items(),
    enabled,
    queryFn: async () => {
      const data = await runRequest(() =>
        client.GET('/mdm/items', { params: { query: { size: 200 } } }),
      );

      return new Map(
        data.items.map((item) => [
          item.itemId,
          {
            itemCode: item.itemCode,
            itemName: item.itemName,
            fifoPolicyCode: item.fifoPolicyCode,
          },
        ]),
      );
    },
  });
};
