import {
  type InfiniteData,
  useInfiniteQuery,
  useQueries,
  useQuery,
  type UseInfiniteQueryResult,
  type UseQueryResult,
} from '@tanstack/react-query';
import { messages } from '@omf-mes/i18n';

import { useApiClient } from './api-context';
import { masterName } from './master-name';
import type { ReferenceResolver } from './reference';
import { runRequest } from './request';

export const masterKeys = {
  item: (itemId: number | null) => ['master-item', itemId] as const,
  itemSearch: (term: string) => ['master-item-search', term] as const,
  uoms: () => ['master-uoms'] as const,
  suppliers: () => ['master-suppliers'] as const,
  partner: (partnerId: number | null) => ['master-partner', partnerId] as const,
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

/**
 * 단위 코드를 푼다. 못 찾았으면 없다고 말한다.
 *
 * 빈 글자를 끼우면 수량 뒤가 그냥 비어, 40 이 마흔 개인지 마흔 킬로그램인지 가릴 수 없다 -
 * 한 목록에 EA 와 KG 가 섞여 선다.
 *
 * 품목과 달리 상태를 여럿으로 가르지 않는다. 이 자리에 들어갈 수 있는 것은 수량 뒤에 붙는
 * 짧은 말뿐이고, 단위는 목록 한 번으로 받아 실패하면 화면 전체가 같은 상태다.
 */
export const uomLabelOf = (
  uoms: Map<number, string> | undefined,
  uomId: number | null | undefined,
): string => {
  /*
   * 단위가 없는 것과 못 받은 것은 다르다. 설비 점검의 정성 항목처럼 단위 개념이 아예 없는
   * 자리에 없다고 적으면, 정상인 항목이 자료가 빠진 것으로 읽힌다.
   */
  if (uomId === null || uomId === undefined) {
    return '';
  }

  return uoms?.get(uomId) ?? messages.common.reference.uomUnknown;
};

/**
 * 품목 코드를 상태와 함께 푼다.
 *
 * `useItemLabels` 는 받은 것만 담은 지도라, 못 받은 번호와 아직 받는 중인 번호가 똑같이
 * 빠진다. 부르는 쪽이 그것을 빈 글자로 적으면 사람은 품목이 원래 없는 줄로 읽는다 - 연결이
 * 끊겼을 뿐이고, 돌아오면 저절로 채워진다.
 *
 * 열쇠를 `useItemLabels` 와 같이 두어 한 화면이 둘을 함께 써도 서버를 두 번 부르지 않는다.
 *
 * 무엇을 보일지는 부르는 쪽이 고른다. 기본은 코드다 - 실물 라벨에 찍히는 것이 코드라 눈으로
 * 대조하는 자리가 그것을 쓴다. 목록처럼 무슨 자재인지 먼저 알아야 하는 자리는 이름을 함께
 * 보인다.
 */
export const useItemCodes = (
  items: readonly number[],
  format: (item: ItemSummary) => string = (item) => item.itemCode,
): ReferenceResolver => {
  const { client } = useApiClient();
  const itemIds = [...new Set(items)];

  const results = useQueries({
    queries: itemIds.map((itemId) => ({
      queryKey: masterKeys.item(itemId),
      queryFn: () => fetchItem(client, itemId),
    })),
  });

  const byId = new Map(itemIds.map((itemId, index) => [itemId, results[index]] as const));

  return (id) => {
    if (id === null || id === undefined) {
      return { kind: 'empty' };
    }

    const result = byId.get(id);

    if (result === undefined) {
      return { kind: 'unknown' };
    }

    if (result.isError) {
      return { kind: 'failed' };
    }

    return result.data === undefined
      ? { kind: 'loading' }
      : { kind: 'named', label: format(result.data) };
  };
};

export interface ItemOption extends ItemSummary {
  itemId: number;
  /* 수량에 붙는 단위. 계획에 없던 재고를 더할 때 화면이 정하지 않고 품목이 정한 것을 쓴다. */
  baseUomId: number;
}

/** 한 쪽에 보일 만큼만 받는다. 더 보려면 더 부르고, 좁히려면 찾는 말을 적는다. */
export const ITEM_SEARCH_LIMIT = 50;

interface ItemSearchPage {
  items: ItemOption[];
  /** 이 쪽의 번호. 계약의 쪽 번호는 1 부터다. */
  page: number;
  /** 조건에 맞는 전체 건수. 남은 수를 사람에게 보이려면 이것이 있어야 한다. */
  total: number;
}

export interface ItemSearchResult {
  /** 지금까지 받은 쪽을 이어 붙인 것. */
  items: ItemOption[];
  /** 조건에 맞는 전체 건수. 받은 수를 빼면 남은 수다. */
  total: number;
}

/*
 * 받은 쪽을 하나로 이어 준다. 남은 수를 세려면 전체 건수도 함께 나와야 한다.
 *
 * 부품 밖에 둔다 - 안에 적으면 렌더마다 새 함수라 조회가 이것을 다시 돌린다. 목록이 100줄을
 * 넘는 자리라 글자를 칠 때마다 그 전부를 다시 이어 붙이게 된다.
 */
const toItemSearchResult = (data: InfiniteData<ItemSearchPage>): ItemSearchResult => ({
  items: data.pages.flatMap((each) => each.items),
  total: data.pages[0]?.total ?? 0,
});

/**
 * 고를 품목을 찾는다. 작업자가 직접 고르는 자리에만 쓴다.
 *
 * 보이는 줄의 품목을 묻는 것과 다르다 - 고르기 전에는 마스터 전체가 후보다. 전부 받아
 * 늘어놓을 수 있는 양이 아니라서(마스터가 9,000건인 곳이 있다) 한 쪽씩 받는다.
 *
 * 찾는 말이 없어도 첫 쪽은 받는다. 적기 전에 아무것도 보이지 않으면 무엇을 적어야 하는지
 * 알 수 없다. 뒤에 더 있다는 것은 부르는 쪽이 남은 수로 말한다.
 *
 * 찾는 말이 열쇠라 말이 바뀌면 쪽도 처음부터 다시 센다 - 앞 말로 받아 둔 쪽이 새 말의
 * 결과에 이어 붙지 않는다.
 */
export const useItemSearch = (term: string): UseInfiniteQueryResult<ItemSearchResult> => {
  const { client } = useApiClient();
  const q = term.trim();

  return useInfiniteQuery({
    queryKey: masterKeys.itemSearch(q),
    initialPageParam: 1,
    /*
     * 찾는 말이 바뀌면 앞 말로 펼쳐 둔 쪽을 버린다.
     *
     * 남겨 두면 말을 지웠을 때 앞서 더 받아 둔 것이 그대로 돌아온다 - 사람은 목록을 처음부터
     * 다시 보려고 지웠는데 150건이 펼쳐진 채로 서 있고, 더 받을 자리는 그 끝에 있다.
     */
    gcTime: 0,
    queryFn: async ({ pageParam }): Promise<ItemSearchPage> => {
      const data = await runRequest(() =>
        client.GET('/mdm/items', {
          params: {
            query: { ...(q === '' ? {} : { q }), page: pageParam, size: ITEM_SEARCH_LIMIT },
          },
        }),
      );

      return {
        items: data.items.map((item) => ({
          itemId: item.itemId,
          itemCode: item.itemCode,
          itemName: item.itemName,
          fifoPolicyCode: item.fifoPolicyCode,
          storageConditionCode: item.storageConditionCode,
          baseUomId: item.baseUomId,
        })),
        page: data.page.page,
        total: data.page.total,
      };
    },
    /*
     * 받은 수로 센다. 쪽 번호에 1 을 더하는 것만으로는 서버가 빈 쪽을 답할 때 끝을 모른다.
     * 받은 것이 없으면 거기서 멈춘다 - 전체 수가 틀려도 끝없이 부르지 않는다.
     */
    getNextPageParam: (last, pages) => {
      const loaded = pages.reduce((count, each) => count + each.items.length, 0);

      return last.items.length > 0 && loaded < last.total ? last.page + 1 : undefined;
    },
    select: toItemSearchResult,
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

export interface PartnerSummary {
  partnerCode: string;
  partnerName: string;
}

/**
 * 거래처 한 곳.
 *
 * 자재 LOT 번호의 공급사 칸은 거래처코드 원본이다. 입하가 가리키는 공급사의 코드와 견주려고
 * 부른다. 목록에서 찾지 않는다 - 한 쪽에 담긴 만큼만 받아, 밖의 공급사가 없는 것으로 읽힌다.
 */
export const usePartner = (partnerId: number | null): UseQueryResult<PartnerSummary> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: masterKeys.partner(partnerId),
    enabled: partnerId !== null,
    queryFn: async () => {
      if (partnerId === null) {
        throw new Error('공급사를 모르면 거래처를 조회하지 않습니다.');
      }

      const data = await runRequest(() =>
        client.GET('/mdm/partners/{partnerId}', { params: { path: { partnerId } } }),
      );

      return { partnerCode: data.partnerCode, partnerName: data.partnerName };
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
