import type { components } from '@omf-mes/api-client';
import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { useApiClient } from '../../patterns/api-context';
import { runRequest } from '../../patterns/request';
import type { ItemFilters } from './types';

type PageMeta = components['schemas']['PageMeta'];
type Item = components['schemas']['Item'];
type Routing = components['schemas']['Routing'];

export interface ItemListResponse {
  items: Item[];
  page: PageMeta;
}

/** Rev 목록에는 페이지네이션이 없다 — 품목당 판 수가 소수라 계약이 두지 않았다. */
export interface RoutingListResponse {
  items: Routing[];
}

/**
 * 이 화면이 쓰는 캐시 키. 무효화 범위를 한 곳에서 읽을 수 있게 모아 둔다.
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 키 모듈을 참조하지 않는다.
 */
export const itemKeys = {
  all: ['routing-items'] as const,
  list: (filters: ItemFilters) => ['routing-items', 'list', filters] as const,
};

/**
 * 품목 목록. 조건은 서버로 보낸다 — 클라이언트에서 거르면 서버가 자른 뒤의 결과만 걸러진다.
 *
 * `hasRouting`은 **켜졌을 때만** 싣는다. `true`를 보내면 「Routing을 보유한 품목만」이 되어
 * 확인칸의 뜻(미보유만)과 정반대의 결과가 나온다.
 */
export const useItemList = (filters: ItemFilters): UseQueryResult<ItemListResponse> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: itemKeys.list(filters),
    queryFn: () =>
      runRequest(() =>
        client.GET('/mdm/items', {
          params: {
            query: {
              ...(filters.q === '' ? {} : { q: filters.q }),
              ...(filters.onlyWithoutRouting ? { hasRouting: false } : {}),
            },
          },
        }),
      ),
  });
};

/** 받은 건수가 전체보다 적으면 목록이 잘린 것이다. 이 화면이 갖는다 — 짧아도 공유하지 않는다. */
export const isTruncated = (page: PageMeta, shown: number): boolean => page.total > shown;

/**
 * Routing(Rev)의 캐시 키. all을 무효화하면 목록·상세·라인이 함께 다시 조회된다 —
 * 상태 전이와 첫 등록 응답에는 ETag가 없어서, 성공 후 재조회로 잠금 토큰을 확보해야 한다.
 */
export const routingKeys = {
  all: ['routings'] as const,
  list: (itemId: number) => ['routings', 'list', itemId] as const,
};

/**
 * ETag가 보관된 경로. 쓰기의 If-Match는 **언제나 이 경로**에서 꺼낸다.
 * 보관 키가 요청 경로라 `...:confirm` 같은 액션 경로로 꺼내면 항상 비어 있다.
 */
export const routingDetailPath = (routingId: number): string =>
  `/planning/routings/${String(routingId)}`;

/** Rev 목록. 계약이 itemId를 필수로 두므로 품목을 고르기 전에는 조회하지 않는다. */
export const useRoutingList = (itemId: number | null): UseQueryResult<RoutingListResponse> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: routingKeys.list(itemId ?? 0),
    enabled: itemId !== null,
    queryFn: () => {
      if (itemId === null) {
        throw new Error('품목을 고르기 전에는 Rev 목록을 조회하지 않습니다.');
      }

      return runRequest(() => client.GET('/planning/routings', { params: { query: { itemId } } }));
    },
  });
};
