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
 * ⭐ 대시보드만 주기 자동 갱신(사용자 결정 2026-10-16, omf-all-around#115) — 설비 상태를
 * 실시간으로 보이기 위함. 조회 화면 공통 규약(「자동 갱신을 두지 않는다 — 사람이 「갱신」을
 * 누른다」)의 **이 화면 한정 예외**다. 주기는 `DASHBOARD_REFRESH_INTERVAL_MS` 하나로 정하고,
 * 탭이 숨겨진 동안은 재조회하지 않는다(TanStack 기본 `refetchIntervalInBackground: false`).
 * 창 포커스 재조회는 여전히 걸지 않으며, 다른 조회 화면과 앱 전역 기본값(`app/providers.tsx`)은
 * 그대로 둔다.
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

/** 대시보드 요약의 자동 재조회 주기 — 1분(omf-all-around#115). */
export const DASHBOARD_REFRESH_INTERVAL_MS = 60_000;

/**
 * 서버 집계를 부른다(omf-all-around#112 · 서버 구현은 #118).
 *
 * ⭐ 한동안 서버에 이 경로가 없어 부르지 않고 501로 거부했었다(#1063). 서버가 구현하므로
 * 원래의 호출로 되돌린다. 서버가 아직 배포 전이면 실패 배너가 서버의 응답 그대로를 보인다.
 */
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
    refetchInterval: DASHBOARD_REFRESH_INTERVAL_MS,
  });
};
