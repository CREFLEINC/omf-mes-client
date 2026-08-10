import type { ApiClient } from '@omf-mes/api-client';
import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { useApiClient } from '../../patterns/api-context';
import { runRequest } from '../../patterns/request';
import type { BusinessPeriodQuery } from './business-period';
import type { BalanceFilterQuery } from './filters';
import type { SortQuery } from './sort';
import {
  toBalanceView,
  toLotDetailView,
  toTransactionDetailView,
  toTransactionView,
  type BalanceListResult,
  type LotDetailView,
  type TransactionDetailView,
  type TransactionListResult,
  type TransactionRef,
} from './types';
import type { GroupByQuery } from './view-axis';

/**
 * 이 화면의 읽기 — 잔액 목록 · 고른 LOT의 상세 · 그 LOT의 수불 이력 · 고른 거래의 라인 넷이다.
 *
 * 경로 리터럴은 이 파일에만 둔다 — `openapi-fetch`가 경로를 리터럴 타입으로 요구해
 * 문자열 변수로 넘기면 타입 검사가 풀린다.
 *
 * **쓰기 오퍼레이션을 부르지 않는다.** 계약에는 `PUT /trace/lots/{lotId}`처럼 쓰는 경로가
 * 있으나 이 화면은 재고 현황 조회이지 편집 화면이 아니다 — `client.POST`·`PUT`·`PATCH`·
 * `DELETE`를 쓰는 자리가 이 슬라이스 어디에도 없다.
 *
 * **자동 갱신 간격을 두지 않는다.** 대시보드가 아니다(이슈 #21 §5) — 주기 재조회를 붙이면
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

/**
 * 캐시 키. **묶음 키(`all`)를 두지 않는다** — 무효화할 자리가 없기 때문이다.
 *
 * 묶음 키는 쓰기 뒤에 「이 리소스의 조회를 전부 무효화한다」고 말하기 위한 것인데
 * 이 화면은 조회 전용이라 그 자리가 하나도 없다. 두면 쓰이지 않는 export가 되고,
 * 다음 사람이 「어딘가 무효화하는 코드가 있다」고 읽는다.
 */
export const balanceKeys = {
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

export const lotKeys = {
  detail: (lotId: number | null) => ['stock-status-lot-detail', lotId] as const,
};

const fetchLotDetail = async (client: Client, lotId: number): Promise<LotDetailView> => {
  const data = await runRequest(() =>
    client.GET('/trace/lots/{lotId}', { params: { path: { lotId } } }),
  );

  return toLotDetailView(data);
};

/**
 * 고른 LOT의 상세 — 유효기한·해제되지 않은 보류·외부 식별자.
 *
 * **고르기 전에는 부르지 않는다**(`lotId`가 `null`이다). 상세는 목록에서 한 줄을 고른
 * 결과이지 화면에 들어온 것만으로 생기는 조회가 아니다.
 *
 * **응답의 `ETag`를 읽지 않는다.** 계약이 다음 쓰기의 `If-Match`에 쓰라고 내려주지만
 * 이 화면은 조회 전용이라 쓸 자리가 없다 — 들고 있으면 쓰기를 붙일 준비가 된 것처럼 읽힌다.
 *
 * 조건이 없어 잔액 조회와 달리 쿼리 타입이 없다. 대상은 경로 조각 하나(`lotId`)뿐이다.
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

/**
 * 수불 이력의 쿼리 전체.
 *
 * **영업일 범위가 이 타입에서 필수다** — 계약에서도 필수이고(빼면 `pnpm typecheck`가 잡는다),
 * 목 서버는 기간 없이 부르면 400을 준다. 기간 없는 요청을 만들 수 있는 자리를 없애면
 * 그 경로가 화면에서 열리지 않는다(`BalanceListQuery`의 `warehouseId`와 같은 갈래다).
 *
 * `lotId`도 필수다. 이 구획은 **고른 LOT의** 이력이라 좁히는 조건 없이 부를 자리가 없다 —
 * 빼면 그 창고 전체의 이력이 와서 사용자가 고른 LOT과 무관한 줄을 읽는다.
 */
export type TransactionListQuery = BusinessPeriodQuery & {
  lotId: number;
  /** 첫 쪽이면 싣지 않는다 — 서버 기본값이 1이다. */
  page?: number;
};

export const transactionKeys = {
  list: (query: TransactionListQuery | null) =>
    ['stock-status-transactions', 'list', query] as const,
  detail: (ref: TransactionRef | null) => ['stock-status-transactions', 'detail', ref] as const,
};

const fetchTransactions = async (
  client: Client,
  query: TransactionListQuery,
): Promise<TransactionListResult> => {
  const data = await runRequest(() => client.GET('/inventory/transactions', { params: { query } }));

  return { items: data.items.map(toTransactionView), page: data.page };
};

/**
 * 고른 LOT의 수불 이력.
 *
 * **영업일 범위가 없으면 부르지 않는다**(`query`가 `null`이다 — 계획 결정 14).
 * 계약이 기간을 필수로 두는 것은 원장이 영업일로 나뉘어 저장되기 때문이며,
 * **성능이 아니라 가능·불가능의 문제**다. 형식만 보고 통과시키면 400이 돌아와
 * 사용자에게는 「조회가 늘 실패한다」로만 보인다 — 그래서 없는 날짜까지
 * `business-period.ts`가 미리 가른다.
 */
export const useTransactionList = (
  query: TransactionListQuery | null,
): UseQueryResult<TransactionListResult> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: transactionKeys.list(query),
    enabled: query !== null,
    queryFn: () => {
      if (query === null) {
        throw new Error('영업일 범위가 없으면 수불 이력을 조회하지 않습니다.');
      }

      return fetchTransactions(client, query);
    },
  });
};

const fetchTransactionDetail = async (
  client: Client,
  ref: TransactionRef,
): Promise<TransactionDetailView> => {
  const data = await runRequest(() =>
    client.GET('/inventory/transactions/{businessDate}/{inventoryTransactionId}', {
      params: {
        path: { businessDate: ref.businessDate, inventoryTransactionId: ref.transactionId },
      },
    }),
  );

  return toTransactionDetailView(data);
};

/**
 * 고른 거래의 라인.
 *
 * **영업일이 경로 조각으로 함께 간다** — 계약이 영업일을 식별자의 일부로 두어(원장이
 * 영업일로 나뉜다) 번호만으로는 행을 찾을 수 없다. 그래서 `TransactionRef`가 둘을 함께
 * 나르고, 주소도 둘을 함께 담는다.
 */
export const useTransactionDetail = (
  ref: TransactionRef | null,
): UseQueryResult<TransactionDetailView> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: transactionKeys.detail(ref),
    enabled: ref !== null,
    queryFn: () => {
      if (ref === null) {
        throw new Error('거래를 고르기 전에는 라인을 조회하지 않습니다.');
      }

      return fetchTransactionDetail(client, ref);
    },
  });
};
