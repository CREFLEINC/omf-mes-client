import type { ApiClient } from '@omf-mes/api-client';
import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { useApiClient } from '../../patterns/api-context';
import { runRequest } from '../../patterns/request';
import type { BalanceFilterQuery } from './filters';
import type { SortQuery } from './sort';
import {
  toBalanceView,
  toLotDetailView,
  type BalanceListResult,
  type LotDetailView,
} from './types';
import type { GroupByQuery } from './view-axis';

/**
 * 이 화면의 읽기 — 잔액 목록과 고른 LOT의 상세 둘이다.
 *
 * 경로 리터럴은 이 파일에만 둔다 — `openapi-fetch`가 경로를 리터럴 타입으로 요구해
 * 문자열 변수로 넘기면 타입 검사가 풀린다.
 *
 * **쓰기 오퍼레이션을 부르지 않는다.** `client.POST`·`PUT`·`PATCH`·`DELETE`를 쓰는 자리가
 * 이 슬라이스 어디에도 없다.
 *
 * **`GET /quality/lot-statuses`를 부르지 않는다.** 목록·필터·요약 전부 `/inventory/balances`
 * 하나로 충분하다 — 계획이 명시적으로 금지했다.
 *
 * **자동 갱신 간격을 두지 않는다.** 대시보드가 아니다 — 조회 시점 스냅샷이라는 전제가
 * 깨진다. 갱신은 새로고침 버튼이 하고 기준 시각이 그 사실을 밝힌다.
 */

type Client = ApiClient['client'];

/**
 * 잔액 조회의 쿼리 전체. **채운 조건만 키가 실린다.**
 *
 * `warehouseId`는 이 타입에서 필수다 — 계약에서는 선택이지만 이 화면이 창고를 필수로 두므로
 * 타입으로 못 박는다.
 */
export type BalanceListQuery = GroupByQuery &
  BalanceFilterQuery &
  SortQuery & {
    warehouseId: number;
    /** 첫 쪽이면 싣지 않는다 — 서버 기본값이 1이다. */
    page?: number;
  };

export const balanceKeys = {
  list: (query: BalanceListQuery | null) =>
    ['product-stock-status-balances', 'list', query] as const,
};

const fetchBalances = async (
  client: Client,
  query: BalanceListQuery,
): Promise<BalanceListResult> => {
  const data = await runRequest(() => client.GET('/inventory/balances', { params: { query } }));

  return { items: data.items.map(toBalanceView), page: data.page };
};

/**
 * 완제품 재고 잔액 목록.
 *
 * **창고를 고르기 전에는 부르지 않는다**(`query`가 `null`이다). 계약은 「창고·품목·LOT 중
 * 적어도 하나」를 요구하지만, 이 화면은 그보다 좁게 **창고를 필수로 둔다** — 전 창고 조회는
 * 무겁고, 이 화면의 조회 조건은 늘 한 창고를 본다.
 *
 * **창고 필수는 이 화면의 규칙이지 계약의 규칙이 아니다.**
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

export const lotKeys = {
  detail: (lotId: number | null) => ['product-stock-status-lot-detail', lotId] as const,
};

const fetchLotDetail = async (client: Client, lotId: number): Promise<LotDetailView> => {
  const data = await runRequest(() =>
    client.GET('/trace/lots/{lotId}', { params: { path: { lotId } } }),
  );

  return toLotDetailView(data);
};

/**
 * 고른 LOT의 상세 — 이 화면은 `holds[]`만 쓴다(`types.ts`).
 *
 * **고르기 전에는 부르지 않는다**(`lotId`가 `null`이다). 상세는 목록에서 한 줄을 고른
 * 결과이지 화면에 들어온 것만으로 생기는 조회가 아니다.
 *
 * **응답의 `ETag`를 읽지 않는다.** 이 화면은 조회 전용이라 쓸 자리가 없다.
 */
export const useLotDetail = (lotId: number | null): UseQueryResult<LotDetailView> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: lotKeys.detail(lotId),
    enabled: lotId !== null,
    queryFn: () => {
      if (lotId === null) {
        throw new Error('LOT을 고르기 전에는 상세를 조회하지 않습니다.');
      }

      return fetchLotDetail(client, lotId);
    },
  });
};
