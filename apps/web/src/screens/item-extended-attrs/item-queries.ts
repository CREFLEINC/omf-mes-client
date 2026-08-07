import type { components } from '@omf-mes/api-client';
import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { useApiClient } from '../../patterns/api-context';
import { runRequest } from '../../patterns/request';
import { toItemListQuery } from './filters';
import type { Item, ItemFilters, PageMeta } from './types';

type ItemDetailResponse = components['schemas']['ItemDetailResponse'];

/**
 * 품목의 조회와 캐시 키. 무효화 범위를 한 곳에서 읽을 수 있게 모아 둔다.
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 키 모듈을 참조하지 않는다.
 *
 * ## 낙관적 잠금 — 이 화면의 쓰기 여섯 중 이 자원만 상세 경로를 쓴다
 *
 * | 쓰기 | `If-Match` | `etagPath` |
 * | --- | :-: | --- |
 * | `PUT /mdm/items/{itemId}` | **필수** | `` `/mdm/items/${itemId}` `` ← 이 파일의 `itemDetailPath` |
 * | `PUT …/bu-item-maps` · `…/uom-conversions` · `…/external-codes` | 없음 | **`null`** |
 * | `POST /planning/boms/{bomId}:set-default` | 없음 | **`null`** |
 * | `PUT …/components/{bomComponentId}` | **필수** | **행 단위 상세 경로**(목록 조회에는 `ETag`가 없다) |
 *
 * `null`이어야 하는 자리에 상세 경로를 주면 토큰을 찾지 못해 `useMasterWrite`가
 * **요청을 보내지 않고 멈춘다** — 「저장을 눌러도 아무 일이 없다」가 된다.
 */

export interface ItemListResponse {
  items: Item[];
  page: PageMeta;
}

/**
 * 품목의 캐시 키.
 *
 * `all`을 무효화하면 목록·상세가 함께 다시 조회된다 — 저장 응답에도 `ETag`가 오지만
 * 다른 필드가 서버에서 바뀌었을 수 있어 상세를 다시 받는다.
 */
export const itemKeys = {
  all: ['item-extended-attrs-items'] as const,
  list: (filters: ItemFilters, page: number) =>
    ['item-extended-attrs-items', 'list', filters, page] as const,
  detail: (itemId: number) => ['item-extended-attrs-items', 'detail', itemId] as const,
};

/**
 * 품목 목록. 조건은 서버로 보낸다 — 클라이언트에서 거르면 서버가 자른 뒤의 결과만 걸러진다.
 *
 * 계약에 필수 쿼리가 없어 화면에 들어오는 즉시 조회한다(선택을 기다리지 않는다).
 * 쿼리 구성 규칙(빈 값·꺼진 확인칸·첫 쪽을 싣지 않는다)은 `filters.ts`가 갖는다.
 *
 * **`POST /mdm/items`를 부르는 자리가 이 화면 어디에도 없다** — 계약에 그 오퍼레이션이 없고,
 * 품목은 외부 정본이라 여기서 만드는 자료가 아니다.
 */
export const useItemList = (
  filters: ItemFilters,
  page: number,
): UseQueryResult<ItemListResponse> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: itemKeys.list(filters, page),
    queryFn: () =>
      runRequest(() =>
        client.GET('/mdm/items', { params: { query: toItemListQuery(filters, page) } }),
      ),
  });
};

/**
 * ETag가 보관된 경로. 확장 속성 저장의 `If-Match`는 **언제나 이 경로**에서 꺼낸다.
 * 보관 키가 요청 경로라 다른 경로로 꺼내면 항상 비어 있다.
 */
export const itemDetailPath = (itemId: number): string => `/mdm/items/${String(itemId)}`;

/**
 * 품목 상세. 낙관적 잠금 토큰(`ETag`)과 확장 속성의 현재 값이 이 응답으로 온다 —
 * 목록 행만으로는 저장을 시작할 수 없다.
 *
 * **`editability`를 읽지 않는다.** 계약은 「항상 `RECEIVED_FROM_ERP`」라 적었으나 목 서버는
 * `reason:'EDITABLE'`을 준다. 원본 구획에 **쓰기 경로를 아예 두지 않는다**는 사실이
 * 응답 필드보다 강한 근거다(결정 1).
 */
export const useItemDetail = (itemId: number | null): UseQueryResult<ItemDetailResponse> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: itemKeys.detail(itemId ?? 0),
    enabled: itemId !== null,
    queryFn: () => {
      if (itemId === null) {
        throw new Error('품목을 고르기 전에는 상세를 조회하지 않습니다.');
      }

      return runRequest(() => client.GET('/mdm/items/{itemId}', { params: { path: { itemId } } }));
    },
  });
};
