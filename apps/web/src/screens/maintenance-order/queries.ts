import type { ApiClient, components } from '@omf-mes/api-client';
import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { useApiClient } from '../../patterns/api-context';
import { requireIfMatch, useMasterWrite, type MasterWriteResult } from '../../patterns/master';
import { runRequest } from '../../patterns/request';
import {
  toBreakdownCandidate,
  toInspectionCandidate,
  toOrderView,
  type BreakdownCandidateView,
  type InspectionCandidateView,
  type OrderListResult,
} from './types';

/**
 * 이 화면의 오퍼레이션 — 후보 목록 둘, 발행된 지시 목록 하나, 쓰기 둘.
 *
 * ⛔ **일괄 발행 경로가 없다.** 계약이 「한 번에 한 건을 만든다」로 못 박았고, 여러 대상을 고른
 * 화면은 대상 수만큼 부르라고 했다 — **부분 실패를 화면이 다룰 수 있어야 하기 때문**이다.
 * 다만 **이 화면은 트리거 여럿을 지시 하나로 묶으므로 한 번만 부른다.** 여러 번 부르는 쪽은
 * 툴 예방보전 화면이다(카디널리티가 반대다).
 *
 * ⭐ **후보 목록 둘 다 「지시가 나가지 않은 것」으로 좁힌다.** 좁히지 않으면 이미 지시가 나간
 * 고장을 또 묶게 되고, 같은 사건에 지시 둘이 생긴다.
 *
 * 경로 리터럴은 이 파일에만 둔다 — `openapi-fetch`가 경로를 리터럴 타입으로 요구해 문자열
 * 변수로 넘기면 타입 검사가 풀린다.
 */

type Client = ApiClient['client'];
type MaintenanceOrder = components['schemas']['MaintenanceOrder'];
type MaintenanceOrderCreate = components['schemas']['MaintenanceOrderCreate'];

export interface OrderListQuery {
  statusCode?: string;
  plannedFrom?: string;
  plannedTo?: string;
  page?: number;
}

export const orderKeys = {
  all: ['maintenance-order'] as const,
  breakdowns: ['maintenance-order', 'breakdown-candidates'] as const,
  inspections: ['maintenance-order', 'inspection-candidates'] as const,
  list: (query: OrderListQuery) => ['maintenance-order', 'list', query] as const,
};

/** 상세 경로. **잠금 토큰이 이 경로에 보관된다** — 취소 경로로 꺼내면 늘 비어 있다. */
export const orderDetailPath = (maintenanceOrderId: number): string =>
  `/maintenance/orders/${String(maintenanceOrderId)}`;

/**
 * 고장 후보 — **아직 지시가 나가지 않은 미처리 건**이다.
 *
 * ⭐ 두 조건은 **다른 축**이다(계약이 밝혔다): `openOnly`는 고장 자신이 완료됐는가이고,
 * `withoutMaintenanceOrder`는 지시가 나갔는가다. 지시가 나간 고장도 완료 전이면 앞쪽에 걸린다.
 */
export const useBreakdownCandidates = (): UseQueryResult<BreakdownCandidateView[]> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: orderKeys.breakdowns,
    queryFn: () =>
      runRequest(() =>
        client.GET('/maintenance/breakdowns', {
          params: { query: { openOnly: true, withoutMaintenanceOrder: true } },
        }),
      ).then((data) => data.items.map(toBreakdownCandidate)),
  });
};

/** 점검 불합격 후보 — 아직 지시가 나가지 않은 불합격 점검이다. */
export const useInspectionCandidates = (): UseQueryResult<InspectionCandidateView[]> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: orderKeys.inspections,
    queryFn: () =>
      runRequest(() =>
        client.GET('/maintenance/inspections', {
          params: { query: { overallResultCode: 'FAIL', withoutMaintenanceOrder: true } },
        }),
      ).then((data) => data.items.map(toInspectionCandidate)),
  });
};

export const useOrderList = (query: OrderListQuery): UseQueryResult<OrderListResult> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: orderKeys.list(query),
    queryFn: () =>
      runRequest(() => client.GET('/maintenance/orders', { params: { query } })).then((data) => ({
        items: data.items.map(toOrderView),
        page: data.page ?? {
          page: query.page ?? 1,
          size: data.items.length,
          total: data.items.length,
        },
      })),
  });
};

/**
 * 지시 하나의 상세.
 *
 * ⭐ **취소하려면 먼저 이것을 불러야 한다.** 잠금 토큰이 **상세 경로**에 보관되므로, 상세를
 * 부르지 않고 취소를 누르면 토큰이 없어 요청이 아예 나가지 않는다(`useMasterWrite`가 막고
 * 「최신 정보를 불러오는 중입니다」를 낸다). 그래서 취소 확인 창을 열 때 이 조회가 함께 돈다.
 */
export const useOrderDetail = (
  maintenanceOrderId: number | null,
): UseQueryResult<MaintenanceOrder> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: ['maintenance-order', 'detail', maintenanceOrderId ?? 0] as const,
    enabled: maintenanceOrderId !== null,
    queryFn: () => {
      if (maintenanceOrderId === null) {
        throw new Error('취소할 지시를 고르기 전에는 상세를 조회하지 않습니다.');
      }

      return runRequest(() =>
        client.GET('/maintenance/orders/{maintenanceOrderId}', {
          params: { path: { maintenanceOrderId } },
        }),
      );
    },
  });
};

/** 화면이 소유한 입력칸 이름 — 오류를 그릴 자리가 있는 것만 넣는다. */
const KNOWN_FIELDS = ['targetId', 'plannedDate', 'assigneeUserId', 'baseDate'] as const;

/**
 * 지시 발행.
 *
 * ⭐ 멱등 키 수명이 **`until-applied`**다. 발행된 지시는 취소로만 되돌릴 수 있고 그마저 실적이
 * 0건일 때뿐이라, 통신이 끊긴 뒤 다시 눌렀을 때 **지시가 둘 생기는 것**을 막아야 한다.
 * 본문이 있어 「값이 바뀌면 새 키」가 성립하므로 고쳐서 다시 보내는 길은 막히지 않는다.
 *
 * ⚠ **낙관적 잠금이 없다**(`etagPath: null`) — 새로 만드는 쓰기라 잠글 대상이 없고, 계약도
 * 이 오퍼레이션에 `If-Match`를 두지 않았다.
 */
export const useOrderCreate = (
  onSuccess: () => void,
): MasterWriteResult<MaintenanceOrderCreate> => {
  const { client } = useApiClient();

  return useMasterWrite<MaintenanceOrderCreate, MaintenanceOrder>({
    request: (body, headers) =>
      client.POST('/maintenance/orders', {
        params: { header: { 'Idempotency-Key': headers['Idempotency-Key'] } },
        body,
      }),
    etagPath: null,
    invalidateKeys: [orderKeys.all],
    knownFields: KNOWN_FIELDS,
    keyLifetime: 'until-applied',
    onSuccess,
  });
};

/**
 * 지시 취소 — **실적이 하나도 없을 때만** 된다(서버 판정).
 *
 * ⚠ 멱등 키 수명이 **기본**이다. 본문이 빈 액션이라 `until-applied`를 쓰면 「값이 바뀌면 새 키」가
 * 성립하지 않아, 실적을 지우고 다시 눌러도 같은 키가 나가고 앞선 거부가 되돌아온다.
 */
export const useOrderCancel = (
  maintenanceOrderId: number | null,
  onSuccess: () => void,
): MasterWriteResult<void> => {
  const { client } = useApiClient();

  return useMasterWrite<void, MaintenanceOrder>({
    request: (_variables, headers) =>
      client.POST('/maintenance/orders/{maintenanceOrderId}:cancel', {
        params: {
          path: { maintenanceOrderId: maintenanceOrderId ?? 0 },
          header: {
            'Idempotency-Key': headers['Idempotency-Key'],
            'If-Match': requireIfMatch(headers),
          },
        },
      }),
    etagPath: maintenanceOrderId === null ? null : orderDetailPath(maintenanceOrderId),
    invalidateKeys: [orderKeys.all],
    knownFields: [],
    onSuccess,
  });
};
