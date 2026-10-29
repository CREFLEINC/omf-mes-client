import type { components } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';
import { useQueries, useQuery } from '@tanstack/react-query';

import { useApiClient } from '../../patterns/api-context';
import type { BomTreeSource } from '../../patterns/bom-tree';
import { runRequest, toApiError } from '../../patterns/request';
import { bomKeys } from './bom-queries';
import { itemKeys } from './item-queries';

type Item = components['schemas']['Item'];

const t = messages.itemExtendedAttrs.bomTab;

/**
 * BOM 탭의 읽기 — 모품목 목록 · 하이라키(`patterns/bom-tree.ts`) · 줄마다의 품목 이름.
 * 경로 리터럴은 이 파일에만 둔다 — `openapi-fetch`가 경로를 리터럴 타입으로 요구한다.
 */

/** 하이라키의 조회 키 — 구성품 저장 · 기본 지정 뒤 이 키로 다시 받는다(`bomKeys.all` 아래). */
export const bomTreeKeys = {
  list: (itemId: number) => [...bomKeys.all, 'tree-list', itemId] as const,
  components: (bomId: number) => [...bomKeys.all, 'tree-components', bomId] as const,
};

export const ITEM_BOM_TREE: BomTreeSource = {
  listKey: bomTreeKeys.list,
  componentsKey: bomTreeKeys.components,
  fetchList: async ({ client }, parentItemId) => {
    const data = await runRequest(() =>
      client.GET('/planning/boms', { params: { query: { parentItemId } } }),
    );
    return data.items;
  },
  fetchComponents: async ({ client }, bomId) => {
    const data = await runRequest(() =>
      client.GET('/planning/boms/{bomId}/components', { params: { path: { bomId } } }),
    );
    return data.items;
  },
};

/** 모품목의 BOM 헤더 전체 — 하이라키가 같은 조회 키로 뿌리 품목의 목록을 다시 부르지 않는다. */
export const useBomTreeList = (parentItemId: number) => {
  const api = useApiClient();
  return useQuery({
    queryKey: bomTreeKeys.list(parentItemId),
    queryFn: () => ITEM_BOM_TREE.fetchList(api, parentItemId),
  });
};

/** 모품목 목록의 조건 — 품목코드 · 품목명 검색어와 유형(제품 · 반제품). */
export interface ParentItemQuery {
  q?: string;
  itemTypeCode: string;
  page?: number;
  /** BOM 이 있는 품목만(서버 #848 · 장부 P-130). 켜짐일 때만 싣는다 — 그 밖의 값은 400 이다. */
  hasBom?: true;
}

export const PARENT_PAGE_SIZE = 50;

/**
 * 왼쪽 모품목 목록 — 「BOM 조회 (ERP)」와 같은 조건이다(사용자 지시 2026-10-28). 사용 중지된 품목도 낸다 —
 * 그 품목의 BOM 구성품도 확장 열을 단다.
 */
export const useParentItems = (query: ParentItemQuery) => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: [...itemKeys.all, 'parents', query] as const,
    queryFn: () => {
      /*
       * `hasBom` 은 서버에 들어왔지만(#848 · 장부 P-130) 계약 사본에는 아직 없다 — 리터럴로 넘기면 타입이 막아 변수로
       * 넘긴다. 계약에 실리면 이 우회를 걷는다.
       */
      const params = { ...query, includeInactive: true, size: PARENT_PAGE_SIZE };
      return runRequest(() => client.GET('/mdm/items', { params: { query: params } }));
    },
  });
};

/** 품목 하나를 부르는 값 — 코드(굵게)와 이름을 따로 낸다. 받기 전 · 못 받음이면 코드가 없고 이름 자리에 그 사정을 낸다. */
export interface ItemSummary {
  code: string | null;
  name: string;
  /** 받은 품목 전체(모품목 사실 칸이 쓴다). */
  item: Item | null;
}

const isNotFound = (error: unknown): boolean => {
  const apiError = toApiError(error);
  return apiError.kind === 'http' && apiError.status === 404;
};

/**
 * 트리 줄의 품목 — 마스터가 수천 건이라 목록을 받지 않고 **번호로 하나씩** 푼다. 품목 탭의 상세와 같은 조회 키라
 * 이미 본 품목은 다시 받지 않는다. 「불러오는 중」·「불러오지 못함」·「알 수 없음」을 가른다.
 */
export const useItemSummaries = (itemIds: readonly number[]): ((itemId: number) => ItemSummary) => {
  const { client } = useApiClient();
  const uniqueIds = [...new Set(itemIds)];
  const results = useQueries({
    queries: uniqueIds.map((itemId) => ({
      queryKey: itemKeys.detail(itemId),
      queryFn: () =>
        runRequest(() => client.GET('/mdm/items/{itemId}', { params: { path: { itemId } } })),
    })),
  });
  const summaries = new Map<number, ItemSummary>(
    uniqueIds.map((itemId, index) => {
      const result = results[index];
      if (result === undefined || result.isPending) {
        return [itemId, { code: null, name: t.values.loadingName, item: null }];
      }
      if (result.data !== undefined) {
        const { item } = result.data;
        return [itemId, { code: item.itemCode, name: item.itemName, item }];
      }
      const name = isNotFound(result.error) ? t.values.unknown : t.values.failedName;
      return [itemId, { code: null, name, item: null }];
    }),
  );
  return (itemId) => summaries.get(itemId) ?? { code: null, name: t.values.unknown, item: null };
};
