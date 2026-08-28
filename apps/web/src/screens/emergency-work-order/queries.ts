import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { useApiClient } from '../../patterns/api-context';
import { runRequest } from '../../patterns/request';
import type {
  BomListResponse,
  ItemListResponse,
  RoutingListResponse,
  RoutingOperationListResponse,
} from './types';

/** 이 화면이 소유하는 캐시 키. 다른 화면 슬라이스의 키 모듈을 참조하지 않는다. */
export const emergencyWorkOrderKeys = {
  all: ['emergency-work-order'] as const,
  itemSearch: (keyword: string) => ['emergency-work-order', 'item-search', keyword] as const,
  boms: (itemId: number | null) => ['emergency-work-order', 'boms', itemId] as const,
  routings: (itemId: number | null) => ['emergency-work-order', 'routings', itemId] as const,
  routingOperations: (routingId: number | null) =>
    ['emergency-work-order', 'routing-operations', routingId] as const,
};

/**
 * 검색 한 번에 받아 둘 최대 건수.
 *
 * ⚠ **잘렸다는 사실을 화면이 말해야 한다.** 응답의 전체 건수가 이 수보다 크면 사용자가 보는
 * 목록은 답의 일부인데, 말하지 않으면 **「찾는 품목이 없다」로 읽는다.** 그 안내를 붙이는
 * 것은 이 목록을 그리는 자리의 몫이고 여기서는 건수만 정한다.
 */
export const ITEM_SEARCH_SIZE = 20;

/**
 * 품목 검색.
 *
 * ⛔ **`hasRouting`으로 미리 거르지 않는다.** 계약에 그 조건이 있어 Routing 없는 품목을
 * 목록에서 지울 수 있지만, 지우면 **찾던 품목이 아예 안 나온다.** 사용자는 「없는 품목」과
 * 「Routing 이 없어 발행할 수 없는 품목」을 구분할 수 없게 된다. 감추지 않고 **고르게 한 뒤
 * 사유와 함께 막는다**(G-1·G-2).
 *
 * 검색어가 비면 조회하지 않는다 — 전 품목을 받아 오는 것은 이 화면의 일이 아니다.
 */
export const useItemSearch = (keyword: string): UseQueryResult<ItemListResponse> => {
  const { client } = useApiClient();
  const trimmed = keyword.trim();

  return useQuery({
    queryKey: emergencyWorkOrderKeys.itemSearch(trimmed),
    enabled: trimmed !== '',
    queryFn: () =>
      runRequest(() =>
        client.GET('/mdm/items', {
          params: { query: { q: trimmed, size: ITEM_SEARCH_SIZE } },
        }),
      ),
  });
};

/**
 * ⭐ **「지금 새 작업지시에 걸 수 있는 것만」을 서버에 묻는다.**
 *
 * ⛔ **화면이 상태 문자열로 거르지 않는다**(G-8). 쓸 수 있는지는 상태·유효기간이 얽힌 판정이고,
 * 그 규칙은 서버 것이다 — 화면이 흉내 내면 값이 정해질 때 **조용히 틀린다.** 이 파라미터를
 * 보내지 않으면 종전대로 전부 오므로, 폐기된 개정으로 발행되는 길이 열린 채로 남는다.
 *
 * 기준정보 관리 화면들은 이것을 쓰지 않는다 — 그쪽은 폐기된 것까지 보여야 하는 자리다.
 */
const USABLE_ONLY = true;

/**
 * 고른 품목의 BOM.
 *
 * 발행에 BOM 식별자를 싣지는 않는다 — 계약의 생성 본문에 그 자리가 없고, 전개는 서버가 한다.
 * 화면이 이것을 부르는 이유는 **전개될 것이 있는지 미리 보이기 위해서**다(스펙 §3 「자동 전개」).
 */
export const useItemBoms = (itemId: number | null): UseQueryResult<BomListResponse> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: emergencyWorkOrderKeys.boms(itemId),
    enabled: itemId !== null,
    queryFn: () => {
      if (itemId === null) throw new Error('품목을 고르기 전에는 BOM 을 조회하지 않습니다.');

      return runRequest(() =>
        client.GET('/planning/boms', {
          params: { query: { parentItemId: itemId, usableOnly: USABLE_ONLY } },
        }),
      );
    },
  });
};

/**
 * 고른 품목의 Routing 개정 목록.
 *
 * ⚠ **최신 것만 받지 않는다.** 쓸 수 있는 개정이 여럿이면 어느 것으로 발행할지 **사람이
 * 고른다**(스펙 완료 조건) — 화면이 「최신」을 골라 주면 고른 적 없는 개정으로 지시가 나간다.
 */
export const useItemRoutings = (itemId: number | null): UseQueryResult<RoutingListResponse> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: emergencyWorkOrderKeys.routings(itemId),
    enabled: itemId !== null,
    queryFn: () => {
      if (itemId === null) throw new Error('품목을 고르기 전에는 Routing 을 조회하지 않습니다.');

      return runRequest(() =>
        client.GET('/planning/routings', {
          params: { query: { itemId, usableOnly: USABLE_ONLY } },
        }),
      );
    },
  });
};

/**
 * 고른 Routing 개정의 공정 목록.
 *
 * ⭐ **발행 본문의 `routingOperationId`가 여기서 나온다.** 계약의 생성 본문은 Routing 이 아니라
 * **공정 라인 하나**를 필수로 받는다 — 개정을 골랐다고 끝이 아니라 그 안의 줄까지 정해진다.
 */
export const useRoutingOperations = (
  routingId: number | null,
): UseQueryResult<RoutingOperationListResponse> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: emergencyWorkOrderKeys.routingOperations(routingId),
    enabled: routingId !== null,
    queryFn: () => {
      if (routingId === null) {
        throw new Error('Routing 개정을 고르기 전에는 공정을 조회하지 않습니다.');
      }

      return runRequest(() =>
        client.GET('/planning/routings/{routingId}/operations', {
          params: { path: { routingId } },
        }),
      );
    },
  });
};
