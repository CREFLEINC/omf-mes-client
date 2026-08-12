import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { useApiClient } from '../../patterns/api-context';
import { runRequest } from '../../patterns/request';
import { toRouteListQuery } from './filters';
import type { ApprovalRoute, ApprovalRouteStep, PageMeta, RouteFilters } from './types';

/**
 * 결재선의 조회와 캐시 키. 무효화 범위를 한 곳에서 읽을 수 있게 모아 둔다.
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 키 모듈을 참조하지 않는다.
 *
 * **이 회차는 읽기뿐이다.** 쓰기 넷(등록·수정·사용 전환·단계 치환)과 그것들이 공유하는
 * 잠금 토큰 규약은 뒤 회차가 더한다.
 */

export interface RouteListResponse {
  items: ApprovalRoute[];
  page: PageMeta;
}

export interface StepListResponse {
  items: ApprovalRouteStep[];
}

export const routeKeys = {
  all: ['approval-routes'] as const,
  list: (filters: RouteFilters, page: number) => ['approval-routes', 'list', filters, page] as const,
  detail: (approvalRouteId: number) => ['approval-routes', 'detail', approvalRouteId] as const,
  steps: (approvalRouteId: number) => ['approval-routes', 'steps', approvalRouteId] as const,
};

/**
 * 결재선 목록. 조건은 서버로 보낸다 — 클라이언트에서 거르면 서버가 자른 뒤의 결과만 걸러진다.
 *
 * 쿼리 구성 규칙(빈 조건을 싣지 않고 **`activeOnly`는 늘 명시해 싣는 것**)은 `filters.ts`가 갖는다.
 */
export const useRouteList = (
  filters: RouteFilters,
  page: number,
): UseQueryResult<RouteListResponse> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: routeKeys.list(filters, page),
    queryFn: () =>
      runRequest(() =>
        client.GET('/app/approval-routes', { params: { query: toRouteListQuery(filters, page) } }),
      ),
  });
};

/**
 * 결재선 상세.
 *
 * **고르기 전에는 성립하지 않는다.** 번호가 없으면 요청 자체가 만들어질 수 없으므로
 * 조회가 열려 있지 않다 — 바깥에서 걸러 내는 대신 조회 자체를 잠근다.
 * 열어 두면 `/app/approval-routes/0` 같은 요청이 나가 헛돈다.
 *
 * 목록 행에도 같은 필드가 실려 오지만 상세를 따로 부른다 — 고른 결재선이 지금 보는 쪽에
 * 없을 수 있고(주소로 들어온 경우), 이어지는 회차의 잠금 토큰이 이 응답으로 온다.
 */
export const useRouteDetail = (
  approvalRouteId: number | null,
): UseQueryResult<ApprovalRoute> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: routeKeys.detail(approvalRouteId ?? 0),
    enabled: approvalRouteId !== null,
    queryFn: () => {
      if (approvalRouteId === null) {
        throw new Error('결재선을 고르기 전에는 상세를 조회하지 않습니다.');
      }

      return runRequest(() =>
        client.GET('/app/approval-routes/{approvalRouteId}', {
          params: { path: { approvalRouteId } },
        }),
      );
    },
  });
};

/**
 * 결재 단계. **쪽 나눔이 없다** — 계약이 `items`만 준다.
 *
 * 상세와 같은 조건으로 열린다. 응답이 승인자 이름을 함께 실어 오므로 이 조회 하나로
 * 단계 표가 완성된다.
 */
export const useRouteSteps = (
  approvalRouteId: number | null,
): UseQueryResult<StepListResponse> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: routeKeys.steps(approvalRouteId ?? 0),
    enabled: approvalRouteId !== null,
    queryFn: () => {
      if (approvalRouteId === null) {
        throw new Error('결재선을 고르기 전에는 결재 단계를 조회하지 않습니다.');
      }

      return runRequest(() =>
        client.GET('/app/approval-routes/{approvalRouteId}/steps', {
          params: { path: { approvalRouteId } },
        }),
      );
    },
  });
};
