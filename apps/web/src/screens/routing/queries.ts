import type { components } from '@omf-mes/api-client';
import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { useApiClient } from '../../patterns/api-context';
import { runRequest } from '../../patterns/request';
import type { ItemFilters } from './types';

type PageMeta = components['schemas']['PageMeta'];
type Item = components['schemas']['Item'];

export interface ItemListResponse {
  items: Item[];
  page: PageMeta;
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
