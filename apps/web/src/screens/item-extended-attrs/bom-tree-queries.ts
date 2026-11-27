import type { components } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';
import { useQueries, useQuery } from '@tanstack/react-query';

import { useApiClient } from '../../patterns/api-context';
import type { BomTreeSource } from '../../patterns/bom-tree';
import { plantIdQuery } from '../../patterns/master-data-plant';
import { runRequest, toApiError } from '../../patterns/request';
import { bomKeys } from './bom-queries';
import { itemKeys } from './item-queries';

type Item = components['schemas']['Item'];

const t = messages.itemExtendedAttrs.bomTab;

/**
 * BOM 탭의 읽기 — 모품목 목록 · 하이라키(`patterns/bom-tree.ts`) · 줄마다의 품목 이름.
 * 경로 리터럴은 이 파일에만 둔다 — `openapi-fetch`가 경로를 리터럴 타입으로 요구한다.
 */

/**
 * 하이라키의 조회 키 — 구성품 저장 · 기본 지정 뒤 이 키로 다시 받는다(`bomKeys.all` 아래).
 * 목록은 공장마다 다르다 — 같은 모품목도 사업부를 바꾸면 그 공장 BOM 만 받는다.
 */
export const bomTreeKeys = {
  list: (itemId: number, plantId: string) =>
    [...bomKeys.all, 'tree-list', itemId, plantId] as const,
  components: (bomId: number) => [...bomKeys.all, 'tree-components', bomId] as const,
};

/**
 * 하이라키의 읽기. BOM 목록은 위 줄 사업부의 공장 BOM 과 공장이 빈(공통) BOM 만 받는다(서버 #1156) — 자품목의
 * BOM 도 같은 공장 것으로 편다. `plantId` 가 비면 공장을 가리지 않는다.
 */
export const itemBomTree = (plantId: string): BomTreeSource => ({
  listKey: (itemId) => bomTreeKeys.list(itemId, plantId),
  componentsKey: bomTreeKeys.components,
  fetchList: async ({ client }, parentItemId) => {
    const data = await runRequest(() =>
      client.GET('/planning/boms', {
        params: { query: { parentItemId, ...plantIdQuery(plantId) } },
      }),
    );
    return data.items;
  },
  fetchComponents: async ({ client }, bomId) => {
    const data = await runRequest(() =>
      client.GET('/planning/boms/{bomId}/components', { params: { path: { bomId } } }),
    );
    return data.items;
  },
});

/** 모품목의 BOM 헤더 전체 — 하이라키가 같은 조회 키로 뿌리 품목의 목록을 다시 부르지 않는다. */
export const useBomTreeList = (parentItemId: number, plantId: string) => {
  const api = useApiClient();
  return useQuery({
    queryKey: bomTreeKeys.list(parentItemId, plantId),
    queryFn: () => itemBomTree(plantId).fetchList(api, parentItemId),
  });
};

/** 모품목 목록의 조건 — 품목코드 · 품목명 검색어와 유형(제품 · 반제품). */
export interface ParentItemQuery {
  q?: string;
  itemTypeCode: string;
  page?: number;
  /** 고른 쪽 크기(10 · 20 · 50 · #360) — 없으면 종전대로 50. */
  size?: number;
  /**
   * BOM 이 있는 품목만(서버 #848). 켜짐일 때만 싣는다 — 끄면 BOM 이 없는 품목까지 전부다.
   * `plantId` 와 함께면 그 공장 BOM 이나 공장이 빈 BOM 을 가진 모품목만이다(서버 #1156).
   */
  hasBom?: true;
  /** 위 줄 사업부의 공장 품목만(서버 #1156 — 품목의 공장은 BOM 으로 정한다). */
  plantId?: number;
}

export const PARENT_PAGE_SIZE = 50;

/**
 * 왼쪽 모품목 목록 — 「BOM 조회 (ERP)」와 같은 조건이다(사용자 지시 2026-10-28). 사용 중지된 품목도 낸다 —
 * 그 품목의 BOM 구성품도 확장 열을 단다.
 */
export const useParentItems = (query: ParentItemQuery, enabled = true) => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: [...itemKeys.all, 'parents', query] as const,
    enabled,
    queryFn: () =>
      runRequest(() =>
        client.GET('/mdm/items', {
          params: {
            query: {
              ...query,
              itemTypeCode: [query.itemTypeCode],
              includeInactive: true,
              size: query.size ?? PARENT_PAGE_SIZE,
            },
          },
        }),
      ),
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
