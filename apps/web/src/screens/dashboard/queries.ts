import type {
  ApiClient,
  DashboardQualityLotStatus,
  DashboardQualityLots,
} from '@omf-mes/api-client';
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
  qualityLots: (
    status: DashboardQualityLotStatus,
    query: DashboardFilterQuery,
    inspectionType: 'IQC' | 'PQC' | 'OQC' | null,
  ) => ['dashboard', 'quality-lots', status, query, inspectionType] as const,
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
export const useDashboardSummary = (
  query: DashboardFilterQuery,
  { live = true }: { live?: boolean } = {},
): UseQueryResult<DashboardView> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: dashboardKeys.summary(query),
    queryFn: () => fetchSummary(client, query),
    /* 지난 기간(끝이 오늘 전)은 값이 바뀌지 않아 자동 갱신을 걸지 않는다(사용자 확정 2026-10-16). */
    refetchInterval: live ? DASHBOARD_REFRESH_INTERVAL_MS : false,
    // 다른 화면에서 판정·처리를 확정하고 돌아오면 바로 반영돼야 한다 — 앱 기본 신선도(30초) 안이어도 다시 읽는다(#124).
    staleTime: 0,
  });
};

/**
 * 품질 종합 「현재 현황」 상태별 LOT 목록(⭐ 사용자 결정 2026-10-19 「서버 추가 + 팝업」) — 상태를 눌렀을 때만 부른다
 * (`status` 가 `null` 이면 부르지 않는다). 조건은 대시보드와 같은 기간 · 공장을 넘긴다 — 기간은 서버가
 * 검사 보류에만 쓰고 나머지 셋은 「지금」 기준이다. 자동 갱신은 걸지 않는다(창이 열린 동안 목록이 바뀌지 않게).
 */
export const useDashboardQualityLots = (
  status: DashboardQualityLotStatus | null,
  query: DashboardFilterQuery,
  /** 검사 보류를 한 검사 유형으로 좁힌다(IQC 탭). `null` 이면 전체. */
  inspectionType: 'IQC' | 'PQC' | 'OQC' | null = null,
): UseQueryResult<DashboardQualityLots> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: dashboardKeys.qualityLots(status ?? 'INSPECTION_HELD', query, inspectionType),
    queryFn: () =>
      runRequest(() =>
        client.GET('/app/dashboard-quality-lots', {
          params: {
            query: {
              status: status ?? 'INSPECTION_HELD',
              ...query,
              ...(inspectionType === null ? {} : { inspectionType }),
            },
          },
        }),
      ),
    enabled: status !== null,
    // 위 요약과 같은 까닭 — 다른 화면에서 처리하고 돌아와 다시 열면 지금 목록을 읽는다(#124).
    staleTime: 0,
  });
};
