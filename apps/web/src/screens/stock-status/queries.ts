import type { ApiClient } from '@omf-mes/api-client';
import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { useApiClient } from '../../patterns/api-context';
import { runRequest } from '../../patterns/request';
import type { BalanceFilterQuery } from './filters';
import type { SortQuery } from './sort';
import { toBalanceView, type BalanceListResult } from './types';
import type { GroupByQuery } from './view-axis';

/**
 * 이 화면의 읽기 — 잔액 목록 하나다(작업 1).
 *
 * 경로 리터럴은 이 파일에만 둔다 — `openapi-fetch`가 경로를 리터럴 타입으로 요구해
 * 문자열 변수로 넘기면 타입 검사가 풀린다.
 *
 * **쓰기 오퍼레이션을 부르지 않는다.** 계약에는 `PUT /trace/lots/{lotId}`처럼 쓰는 경로가
 * 있으나 이 화면은 재고 현황 조회이지 편집 화면이 아니다 — `client.POST`·`PUT`·`PATCH`·
 * `DELETE`를 쓰는 자리가 이 슬라이스 어디에도 없다.
 *
 * **자동 갱신을 두지 않는다.** 대시보드가 아니다(이슈 #21 §5) — `refetchInterval`을 붙이면
 * 조회 시점 스냅샷이라는 이 화면의 전제가 깨지고, 사용자가 보고 있는 값이 소리 없이 바뀐다.
 * 갱신은 새로고침 버튼이 하고 기준 시각이 그 사실을 밝힌다.
 */

type Client = ApiClient['client'];

/**
 * 잔액 조회의 쿼리 전체. **채운 조건만 키가 실린다** —
 * 요청 URL이 조건을 그대로 드러내야 무엇으로 조회했는지 읽을 수 있다.
 *
 * `size`는 싣지 않는다. 서버 기본값(50)을 그대로 쓰고 쪽 크기를 화면이 정하지 않는다.
 *
 * `warehouseId`는 **이 타입에서 필수**다. 계약에서는 선택이지만(현장 단말이 LOT만 들고
 * 들어오는 경로가 같은 API를 쓴다) **이 화면이 창고를 필수로 두므로** 타입으로 못 박는다 —
 * 창고 없는 요청을 만들 수 있는 자리를 없애면 그 경로가 화면에서 열리지 않는다.
 */
export type BalanceListQuery = GroupByQuery &
  Omit<BalanceFilterQuery, 'warehouseId'> &
  SortQuery & {
    warehouseId: number;
    /** 첫 쪽이면 싣지 않는다 — 서버 기본값이 1이다. */
    page?: number;
  };

export const balanceKeys = {
  all: ['inventory-balances'] as const,
  list: (query: BalanceListQuery | null) => ['inventory-balances', 'list', query] as const,
};

const fetchBalances = async (
  client: Client,
  query: BalanceListQuery,
): Promise<BalanceListResult> => {
  const data = await runRequest(() => client.GET('/inventory/balances', { params: { query } }));

  return { items: data.items.map(toBalanceView), page: data.page };
};

/**
 * 재고 잔액 목록.
 *
 * **창고를 고르기 전에는 부르지 않는다**(`query`가 `null`이다 — 계획 결정 5).
 * 계약은 「창고·품목·LOT 중 적어도 하나」를 요구하고 셋 다 비면 400인데, 이 화면은
 * 그보다 좁게 **창고를 필수로 둔다.** 근거 셋:
 *
 * 1. 전 창고 조회는 무겁다(화면 스펙 §5-7).
 * 2. `/mdm/locations`가 `warehouseId`를 **필수**로 요구해 창고 없이는 위치 이름을 풀 수 없다 —
 *    위치별 보기가 성립하지 않는다.
 * 3. 「셋 중 하나」 규칙을 화면이 지키는 가장 단순한 형태다. 품목·LOT만으로 들어오는 경로를
 *    이 화면이 열면 「무엇을 채워야 조회되는가」가 조건마다 달라진다.
 *
 * **창고 필수는 이 화면의 규칙이지 계약의 규칙이 아니다.** 이 문장이 없으면 다음 화면이
 * 계약을 잘못 읽는다 — 현장 단말(M-01-04)은 LOT만 들고 같은 API로 들어온다.
 */
export const useBalanceList = (
  query: BalanceListQuery | null,
): UseQueryResult<BalanceListResult> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: balanceKeys.list(query),
    enabled: query !== null,
    queryFn: () => {
      if (query === null) {
        throw new Error('창고를 고르기 전에는 잔액을 조회하지 않습니다.');
      }

      return fetchBalances(client, query);
    },
  });
};
