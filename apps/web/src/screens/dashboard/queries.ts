import type { ApiClient } from '@omf-mes/api-client';
import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { useApiClient } from '../../patterns/api-context';
import { runRequest } from '../../patterns/request';
import type { DashboardFilterQuery } from './filters';
import { toDashboardView, type DashboardView } from './types';

/**
 * 이 화면의 읽기 — **오퍼레이션이 하나뿐이다.**
 *
 * ⭐ 카드마다 소유 화면이 따로 있고 이 경로는 **숫자만** 모은다. 카드를 채우려고 도메인 경로를
 * 하나씩 더 부르지 않는다 — 그렇게 하면 첫 화면이 요청 예닐곱 개를 지고 열리고, 그중 하나가
 * 실패할 때마다 대시보드가 부분적으로 깨진 모습이 된다.
 *
 * ⛔ **자동 갱신을 두지 않는다.** 주기 재조회(`refetchInterval`)도 창 포커스 재조회도 걸지
 * 않는다 — 사람이 「갱신」을 누른다(조회 화면 공통 규약). 앱 전역 기본값도 창 포커스 재조회를
 * 꺼 두었다(`app/providers.tsx`).
 *
 * 경로 리터럴은 이 파일에만 둔다 — `openapi-fetch`가 경로를 리터럴 타입으로 요구해 문자열
 * 변수로 넘기면 타입 검사가 풀린다.
 *
 * **쓰기 오퍼레이션이 없다.** 이 화면은 조회 전용이다.
 */

type Client = ApiClient['client'];

export const dashboardKeys = {
  all: ['dashboard'] as const,
  summary: (query: DashboardFilterQuery) => ['dashboard', 'summary', query] as const,
};

const fetchSummary = async (
  client: Client,
  query: DashboardFilterQuery,
): Promise<DashboardView> => {
  const data = await runRequest(() => client.GET('/app/dashboard-summary', { params: { query } }));

  return toDashboardView(data);
};

/**
 * 통합 집계.
 *
 * **조건이 비어 있어도 부른다** — 기준 날짜가 없으면 서버가 오늘로 정하고, 공장이 없으면
 * 전체다. 필수 조건이 없는 화면이라 「조건이 설 때까지 기다리는」 갈래 자체가 없다.
 */
export const useDashboardSummary = (query: DashboardFilterQuery): UseQueryResult<DashboardView> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: dashboardKeys.summary(query),
    queryFn: () => fetchSummary(client, query),
  });
};
