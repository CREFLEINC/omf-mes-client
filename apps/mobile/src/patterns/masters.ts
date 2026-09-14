import { useQueries, useQuery, type UseQueryResult } from '@tanstack/react-query';

import { useApiClient } from './api-context';
import { masterName } from './master-name';
import { runRequest } from './request';

export const masterKeys = {
  item: (itemId: number | null) => ['master-item', itemId] as const,
  itemSearch: (term: string) => ['master-item-search', term] as const,
  uoms: () => ['master-uoms'] as const,
  suppliers: () => ['master-suppliers'] as const,
  customers: () => ['master-customers'] as const,
  defectCodes: () => ['master-defect-codes'] as const,
};

export interface ItemSummary {
  itemCode: string;
  itemName: string;
  /** 선출 정책. 품목마다 다르고 전사 고정이 아니다. */
  fifoPolicyCode: string;
  /** 보관조건. 위치의 같은 이름 값과 같은 코드계라 그대로 견준다. 비어 있을 수 있다. */
  storageConditionCode?: string | null;
}

type ItemClient = ReturnType<typeof useApiClient>['client'];

const fetchItem = async (client: ItemClient, itemId: number): Promise<ItemSummary> => {
  const data = await runRequest(() =>
    client.GET('/mdm/items/{itemId}', { params: { path: { itemId } } }),
  );

  return {
    itemCode: data.item.itemCode,
    itemName: data.item.itemName,
    fifoPolicyCode: data.item.fifoPolicyCode,
    storageConditionCode: data.item.storageConditionCode,
  };
};

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

      return fetchItem(client, itemId);
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
 *
 * 필요한 번호만 하나씩 묻는다. 목록을 한 번 받아 지도를 만들면 그 한 번에 담기는 만큼만
 * 이름을 얻고 나머지는 조용히 빈다 - 마스터가 9,000건인 곳에서 코드순 앞 200건 밖
 * 품목이 전부 이름 없이 섰다. 부르는 횟수는 화면에 실제로 뜬 줄 수만큼이다.
 *
 * 단건 조회와 같은 열쇠를 쓴다. 한 화면이 여기서 받아 둔 것을 다른 자리가 다시 부르지 않는다.
 */
export const useItemLabels = (items: readonly number[]): Map<number, ItemSummary> => {
  const { client } = useApiClient();
  const itemIds = [...new Set(items)];

  return useQueries({
    queries: itemIds.map((itemId) => ({
      queryKey: masterKeys.item(itemId),
      queryFn: () => fetchItem(client, itemId),
    })),
    combine: (results) =>
      new Map(
        results.flatMap((result, index) => {
          const itemId = itemIds[index];

          return result.data === undefined || itemId === undefined
            ? []
            : [[itemId, result.data] as const];
        }),
      ),
  });
};

export interface ItemOption extends ItemSummary {
  itemId: number;
}

/** 한 쪽에 보일 만큼만 받는다. 더 좁히는 것은 찾는 말을 적는 쪽이 빠르다. */
export const ITEM_SEARCH_LIMIT = 50;

/**
 * 고를 품목을 찾는다. 작업자가 직접 고르는 자리에만 쓴다.
 *
 * 보이는 줄의 품목을 묻는 것과 다르다 - 고르기 전에는 마스터 전체가 후보다. 전부 받아
 * 늘어놓을 수 있는 양이 아니라서(마스터가 9,000건인 곳이 있다) 한 쪽만 받는다.
 *
 * 찾는 말이 없어도 한 쪽은 받는다. 적기 전에 아무것도 보이지 않으면 무엇을 적어야 하는지
 * 알 수 없다. 잘린 목록이 전부인 것처럼 보이는 것은 부르는 쪽이 받은 수로 말해서 막는다.
 */
export const useItemSearch = (term: string): UseQueryResult<ItemOption[]> => {
  const { client } = useApiClient();
  const q = term.trim();

  return useQuery({
    queryKey: masterKeys.itemSearch(q),
    queryFn: async () => {
      const data = await runRequest(() =>
        client.GET('/mdm/items', {
          params: { query: { ...(q === '' ? {} : { q }), size: ITEM_SEARCH_LIMIT } },
        }),
      );

      return data.items.map((item) => ({
        itemId: item.itemId,
        itemCode: item.itemCode,
        itemName: item.itemName,
        fifoPolicyCode: item.fifoPolicyCode,
        storageConditionCode: item.storageConditionCode,
      }));
    },
  });
};

export interface SupplierSummary {
  partnerId: number;
  partnerName: string;
}

/**
 * 공급사 후보.
 *
 * 거래처 역할은 다섯이라 거르지 않으면 고객사가 공급사 자리에 섞인다 - 고른 사람은 알아채기
 * 어렵고, 잘못 실린 거래처로 입하가 서면 되돌릴 자리가 없다. 역할을 부르는 쪽이 정하지 않고
 * 여기서 못박는 이유가 그것이다.
 */
export const useSuppliers = (enabled: boolean): UseQueryResult<SupplierSummary[]> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: masterKeys.suppliers(),
    enabled,
    queryFn: async () => {
      const data = await runRequest(() =>
        client.GET('/mdm/partners', {
          params: { query: { roleTypeCode: 'SUPPLIER', size: 200 } },
        }),
      );

      return data.items.map((partner) => ({
        partnerId: partner.partnerId,
        partnerName: partner.partnerName,
      }));
    },
  });
};

/**
 * 고객 식별자를 이름으로 바꾼다.
 *
 * 출하 요청은 고객 식별자만 준다. 번호를 그대로 보이면 어느 고객 몫을 집는지 알 수 없다.
 */
export const useCustomerNames = (enabled: boolean): UseQueryResult<Map<number, string>> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: masterKeys.customers(),
    enabled,
    queryFn: async () => {
      const data = await runRequest(() =>
        client.GET('/mdm/partners', {
          params: { query: { roleTypeCode: 'CUSTOMER', size: 200 } },
        }),
      );

      return new Map(data.items.map((partner) => [partner.partnerId, partner.partnerName]));
    },
  });
};

export interface DefectCodeLabel {
  defectCode: string;
  defectName: string;
}

/**
 * 불량 코드 이름표.
 *
 * 불량 기록은 코드의 대리키만 준다. 그 번호를 그대로 보이면 한 LOT 에 불량이 여럿일 때
 * 무엇을 고르는지 알 수 없다 - 수량이 같은 둘이면 고를 수가 없다.
 *
 * 쓰지 않게 된 코드로 남은 과거 기록도 이름이 나오게 한다.
 */
export const useDefectCodes = (enabled: boolean): UseQueryResult<Map<number, DefectCodeLabel>> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: masterKeys.defectCodes(),
    enabled,
    queryFn: async () => {
      const data = await runRequest(() =>
        client.GET('/quality/defect-codes', {
          params: { query: { includeInactive: true, size: 200 } },
        }),
      );

      return new Map(
        data.items.map((code) => [
          code.defectCodeId,
          { defectCode: code.defectCode, defectName: masterName(code, code.defectName) },
        ]),
      );
    },
  });
};
