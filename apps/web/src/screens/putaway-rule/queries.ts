import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { useApiClient } from '../../patterns/api-context';
import { runRequest } from '../../patterns/request';
import { toRuleListQuery, toUncoveredQuery } from './filters';
import type { PageMeta, PutawayRule, RuleFilters, UncoveredItem } from './types';

/**
 * 적치 규칙의 조회와 캐시 키. 무효화 범위를 한 곳에서 읽을 수 있게 모아 둔다.
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 키 모듈을 참조하지 않는다.
 *
 * **이 회차에는 쓰기가 없다.** 잠금 토큰 경로 함수·조준 조회는 그것을 쓰는 회차가 함께
 * 가져온다 — 지금 두면 쓰이지 않는 통로가 되고, 죽은 통로는 다음 사본으로 전파된다
 * (사본 체크리스트 7번).
 */

export interface RuleListResponse {
  items: PutawayRule[];
  page: PageMeta;
}

export interface UncoveredListResponse {
  items: UncoveredItem[];
  page: PageMeta;
}

export const putawayRuleKeys = {
  /**
   * 이 슬라이스의 조회 전부를 덮는 뿌리 키. **모든 쓰기가 성공 뒤 이 하나를 무효화한다** —
   * 규칙을 고치면 규칙 없는 품목 수도 함께 달라지므로 무효화 범위가 갈리면 안 된다.
   */
  all: ['putaway-rules'] as const,
  list: (filters: RuleFilters, page: number) => ['putaway-rules', 'list', filters, page] as const,
  uncovered: (warehouseId: number, page: number) =>
    ['putaway-rules', 'uncovered', warehouseId, page] as const,
};

/**
 * 적치 규칙 목록.
 *
 * **창고를 고르기 전에는 열리지 않는다.** 계약은 `warehouseId`를 선택으로 두었으나 창고 없이
 * 부르면 전 창고의 규칙이 섞여 오고, 그 목록은 어느 창고의 사실도 아니다 —
 * 이 화면의 나머지(위치 이름·규칙 없는 품목 수)가 전부 창고 하나를 전제로 선다.
 *
 * 조건은 서버로 보낸다 — 클라이언트에서 거르면 서버가 자른 뒤의 결과만 걸러진다.
 * 쿼리 구성 규칙(빈 조건을 싣지 않고 **`includeInactive`는 늘 명시해 싣는 것**)은
 * `filters.ts`가 갖는다.
 */
export const useRuleList = (
  filters: RuleFilters,
  page: number,
): UseQueryResult<RuleListResponse> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: putawayRuleKeys.list(filters, page),
    enabled: filters.warehouseId !== '',
    queryFn: () => {
      if (filters.warehouseId === '') {
        throw new Error('창고를 고르기 전에는 적치 규칙을 조회하지 않습니다.');
      }

      return runRequest(() =>
        client.GET('/logistics/putaway-rules', {
          params: { query: toRuleListQuery(filters, page) },
        }),
      );
    },
  });
};

/**
 * 규칙 없는 품목 — 그 창고에 입고 이력이 있는데 활성 규칙이 하나도 없는 품목이다.
 *
 * ⭐ **목록과 함께 선다.** 등록된 규칙만 보이면 「비어 있다」는 사실이 화면 어디에도 드러나지
 * 않고, 그 상태에서는 현장이 위치 검증 없이 통과한다(공유계약 G-12).
 *
 * **건수는 펼치기 전에도 보여야 하므로 창고를 고르는 순간 부른다.** 펼침은 이미 받은 목록을
 * 드러낼 뿐이며, 펼칠 때 부르면 건수가 보이는 순간과 목록이 도착하는 순간이 갈린다.
 *
 * 계약이 `warehouseId`를 **필수 쿼리**로 요구한다 — 세는 범위가 정해지지 않으면 요청 자체가
 * 성립하지 않는다.
 */
export const useUncoveredItems = (
  warehouseId: number | null,
  page: number,
): UseQueryResult<UncoveredListResponse> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: putawayRuleKeys.uncovered(warehouseId ?? 0, page),
    enabled: warehouseId !== null,
    queryFn: () => {
      if (warehouseId === null) {
        throw new Error('창고를 고르기 전에는 규칙 없는 품목을 조회하지 않습니다.');
      }

      return runRequest(() =>
        client.GET('/logistics/putaway-rules/uncovered-items', {
          params: { query: toUncoveredQuery(warehouseId, page) },
        }),
      );
    },
  });
};
