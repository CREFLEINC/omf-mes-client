import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import type { paths } from '@omf-mes/api-client';

import { useApiClient } from '../../patterns/api-context';
import { runRequest } from '../../patterns/request';
import { toRouteListQuery } from './filters';
import type { ApprovalRoute, ApprovalRouteStep, PageMeta, RouteFilters } from './types';

type ApprovalRouteQuery = NonNullable<paths['/app/approval-routes']['get']['parameters']['query']>;
type ApprovalTypeCode = NonNullable<ApprovalRouteQuery['approvalTypeCode']>;

/**
 * 결재선의 조회와 캐시 키. 무효화 범위를 한 곳에서 읽을 수 있게 모아 둔다.
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 키 모듈을 참조하지 않는다.
 *
 * **쓰기는 `screen.tsx`가 갖는다.** 네 쓰기가 한 벌의 잠금 토큰을 나눠 쓰므로(계획 결정 12)
 * 그 규약 표는 쓰기들이 나란히 선 자리에 있어야 읽힌다 — 표와 코드가 떨어지면 표가 코드보다
 * 오래 살아 없어진 설계를 서술하게 된다. 여기에는 **그 쓰기들이 쓰는 경로와 키**만 둔다.
 */

export interface RouteListResponse {
  items: ApprovalRoute[];
  page: PageMeta;
}

export interface StepListResponse {
  items: ApprovalRouteStep[];
}

export const routeKeys = {
  /**
   * 이 슬라이스의 조회 전부를 덮는 뿌리 키. **모든 쓰기가 성공 뒤 이 하나를 무효화한다** —
   * 규칙이 「모든 쓰기 뒤 결재선 상세를 무효화한다」 하나이므로 무효화 범위도 한 자리에 둔다.
   * 조준 조회도 이 아래에 있어 저장 뒤 판정이 낡은 채로 남지 않는다.
   */
  all: ['approval-routes'] as const,
  list: (filters: RouteFilters, page: number) =>
    ['approval-routes', 'list', filters, page] as const,
  detail: (approvalRouteId: number) => ['approval-routes', 'detail', approvalRouteId] as const,
  steps: (approvalRouteId: number) => ['approval-routes', 'steps', approvalRouteId] as const,
  duplicateProbe: (approvalTypeCode: string) =>
    ['approval-routes', 'duplicate-probe', approvalTypeCode] as const,
};

/**
 * 잠금 토큰을 꺼내는 자리 — **늘 결재선 상세 경로다.**
 *
 * 토큰 보관소는 **응답이 온 URL 경로**를 열쇠로 쓴다(`packages/api-client/src/client.ts`).
 * 그래서 액션 경로(`…:deactivate`)로 꺼내면 언제나 비어 있고, 그때 훅은 요청을 보내지 않고
 * 멈춘다 — 「저장을 눌러도 아무 일이 없다」가 그 증상이다(전례 W-CO-02).
 */
export const routeDetailPath = (approvalRouteId: number): string =>
  `/app/approval-routes/${String(approvalRouteId)}`;

/**
 * 조준 조회가 한 번에 받아 오는 최대 건수.
 *
 * **목록 조회와 달리 크기를 명시한다.** 서버 기본값(보통 20)에 기대면 같은 승인 유형의
 * 결재선이 그보다 많을 때 조용히 잘리는데, 판정하는 자리에서 잘림은 「없다」로 읽힌다.
 * 여기서 명시하면 잘렸는지를 `page.total`과 견줘 알 수 있다(`judgeDuplicate`의 `truncated`).
 */
export const DUPLICATE_PROBE_SIZE = 100;

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
        client.GET('/app/approval-routes', {
          params: { query: toRouteListQuery(filters, page) as ApprovalRouteQuery },
        }),
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
export const useRouteDetail = (approvalRouteId: number | null): UseQueryResult<ApprovalRoute> => {
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
export const useRouteSteps = (approvalRouteId: number | null): UseQueryResult<StepListResponse> => {
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

/**
 * 활성 중복 **조준 조회**.
 *
 * 승인 유형으로만 좁혀 부르고 **사업부는 클라이언트가 맞춘다**(`duplicate-check.ts`) —
 * 쿼리로는 「전 사업부 공통」(`null`)을 표현할 수 없기 때문이다.
 *
 * **필요할 때만 부른다.** 읽기만 하는 사용자에게까지 요청이 나가면 결재선을 하나 고를 때마다
 * 목록 경로로 두 번 나가는 화면이 된다. 판정이 필요한 자리는 셋뿐이다 —
 * 등록(유형을 골랐다) · 수정(고친 것이 있다) · 다시 사용(그 결재선이 꺼져 있다).
 *
 * 판정하지 못하는 갈래(불러오는 중·실패·잘림)는 **막지 않는다.** 계약이 같은 조건을 400으로
 * 다시 검사하므로, 조회 하나가 실패했다고 마스터 관리 전체가 멈추면 안 된다.
 */
export const useDuplicateProbe = (
  approvalTypeCode: string,
  enabled: boolean,
): UseQueryResult<RouteListResponse> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: routeKeys.duplicateProbe(approvalTypeCode),
    enabled: enabled && approvalTypeCode !== '',
    queryFn: () =>
      runRequest(() =>
        client.GET('/app/approval-routes', {
          params: {
            query: {
              approvalTypeCode: approvalTypeCode as ApprovalTypeCode,
              /* 판정 대상은 **사용 중인** 결재선뿐이다. 계약에 기본값이 없어 늘 명시해 싣는다. */
              activeOnly: true,
              size: DUPLICATE_PROBE_SIZE,
            },
          },
        }),
      ),
  });
};
