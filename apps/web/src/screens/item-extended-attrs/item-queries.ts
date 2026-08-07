import type { components } from '@omf-mes/api-client';
import { useQueries, useQuery, type UseQueryResult } from '@tanstack/react-query';

import { useApiClient } from '../../patterns/api-context';
import { runRequest } from '../../patterns/request';
import { toItemListQuery } from './filters';
import type { LookupResult } from './lookups';
import type { Item, ItemFilters, LookupEntry, PageMeta } from './types';

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
  /**
   * 상세의 키. **행 단위 이름 조회가 이 키를 함께 쓴다**(결정 12) —
   * 같은 품목이 여러 행·여러 표에 나와도 한 번만 받게 하려는 것이다.
   */
  detail: (itemId: number) => ['item-extended-attrs-items', 'detail', itemId] as const,
  /** 품목 고르기의 검색. 좌 목록과 조건 축이 달라 키를 나눈다 */
  search: (keyword: string) => ['item-extended-attrs-items', 'search', keyword] as const,
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

/** 품목 하나를 사람이 읽는 한 줄로. 번호를 화면에 내지 않기 위한 형태다. */
const toItemEntry = (item: Item): LookupEntry => ({
  value: String(item.itemId),
  label: `${item.itemCode} · ${item.itemName}`,
  isActive: item.isActive,
});

const EMPTY_ENTRIES: LookupEntry[] = [];

/**
 * 검색으로 고르는 품목 목록(결정 8).
 *
 * **검색어가 비면 조회하지 않는다**(M31). 품목은 수천 건일 수 있어 전 목록을 받는 것이
 * 화면에도 서버에도 의미가 없고, 빈 검색어로 받은 앞 N건은 「고를 만한 후보」가 아니다.
 *
 * 상위 N건만 받고 잘렸다는 사실을 화면이 밝힌다 — 밝히지 않으면 사용자가
 * 「이 품목은 없다」로 잘못 읽고 검색을 그만둔다.
 */
const ITEM_SEARCH_SIZE = 20;

export const useItemSearch = (keyword: string): LookupResult => {
  const { client } = useApiClient();
  const trimmed = keyword.trim();

  const query = useQuery({
    queryKey: itemKeys.search(trimmed),
    enabled: trimmed !== '',
    queryFn: () =>
      runRequest(() =>
        client.GET('/mdm/items', {
          params: { query: { q: trimmed, size: ITEM_SEARCH_SIZE } },
        }),
      ),
  });

  const data = query.data;

  return {
    entries: data?.items.map(toItemEntry) ?? EMPTY_ENTRIES,
    truncated: data !== undefined && data.page.total > data.items.length,
    isError: query.isError,
    // 검색어를 넣기 전에는 「불러오는 중」이 아니다 — 조회 자체가 없다.
    isLoading: trimmed !== '' && query.isPending,
  };
};

/**
 * 번호 목록을 이름으로 옮긴다 — 표의 「대상 품목」·「구성품」이 쓴다(결정 12).
 *
 * **계약에 번호 목록으로 품목을 한꺼번에 받는 오퍼레이션이 없다**(실측). 행마다 상세를 부르되
 * `useItemDetail`과 **같은 캐시 키**를 써서 같은 품목이 여러 행에 나와도 한 번만 받는다.
 * 요청 수가 행 수에 비례하는 것은 계약의 목록 응답에 쪽 나눔이 없다는 사실로 감수한다.
 *
 * 실패한 행만 이름을 잃는다 — 「알 수 없음」은 그 행에서 난다.
 * **전부 실패했을 때만** `isError`가 참이다. 한 행이 실패했다고 표 위에 안내를 올리면
 * 나머지 행이 멀쩡히 보이는데도 목록 전체가 실패한 것처럼 읽힌다.
 */
export const useItemNames = (itemIds: readonly number[]): LookupResult => {
  const { client } = useApiClient();
  const uniqueIds = [...new Set(itemIds)];

  const results = useQueries({
    queries: uniqueIds.map((itemId) => ({
      queryKey: itemKeys.detail(itemId),
      queryFn: () =>
        runRequest(() => client.GET('/mdm/items/{itemId}', { params: { path: { itemId } } })),
    })),
  });

  const entries = results.flatMap((result) =>
    result.data === undefined ? [] : [toItemEntry(result.data.item)],
  );

  return {
    entries,
    // 행 단위 조회라 잘림이라는 상태가 없다 — 요청한 번호가 곧 전부다.
    truncated: false,
    isError: results.length > 0 && results.every((result) => result.isError),
    isLoading: results.some((result) => result.isPending),
  };
};
