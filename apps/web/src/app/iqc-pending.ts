import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';
import { useLocation } from 'react-router';

import { useApiClient } from '../patterns/api-context';
import { runRequest } from '../patterns/request';

/** IQC 화면(W-01-01). 이 화면을 볼 수 있을 때만 수를 묻고 보인다(US4-3). */
export const IQC_PATH = '/logistics/iqc-inspection';

/** 다시 세는 간격 — 백그라운드 탭에서는 멈춘다(react-query 기본, 대시보드 선례). */
export const IQC_PENDING_INTERVAL_MS = 60_000;

export const iqcPendingKeys = { count: ['iqc-pending-count'] as const };

/**
 * 대기·진행 중 IQC 의뢰 수(피처 002, US4-1) — IQC 화면 목록과 같은 조건의 `page.total`. 서버 변경 없음.
 *
 * - 화면을 옮길 때마다, 그리고 60초마다 다시 센다(US4-4).
 * - 실패·아직이면 `undefined` — 배지·점을 그리지 않는다(FR-018). 실패한 동안은 앞선 수도 보이지 않는다.
 */
export const useIqcPendingCount = (enabled: boolean): number | undefined => {
  const { client } = useApiClient();
  const { pathname } = useLocation();
  const query = useQuery({
    queryKey: iqcPendingKeys.count,
    enabled,
    refetchInterval: IQC_PENDING_INTERVAL_MS,
    queryFn: async () =>
      (
        await runRequest(() =>
          client.GET('/quality/inspection-requests', {
            params: { query: { inspectionTypeCode: 'IQC', pendingOnly: true, size: 1 } },
          }),
        )
      ).page.total,
  });
  const { refetch } = query;

  useEffect(() => {
    if (enabled) void refetch();
  }, [enabled, pathname, refetch]);

  return query.isError ? undefined : query.data;
};
