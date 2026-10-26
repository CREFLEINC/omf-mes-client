import { messages } from '@omf-mes/i18n';
import { useQuery } from '@tanstack/react-query';

import { useApiClient } from './api-context';
import { HubActions, useHubActionsTarget } from './hub-actions';
import { runRequest } from './request';

const t = messages.common.inspectionHub;

/** 건수를 셀 상태 — 「대기」·「진행」(목록의 「대기·진행만 보기」와 같은 두 상태). */
const STATUSES = [
  { code: 'REQUESTED', label: t.requested },
  { code: 'IN_PROGRESS', label: t.inProgress },
] as const;

const useStatusCount = (inspectionTypeCode: string, statusCode: string) => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: ['inspection-hub-counts', inspectionTypeCode, statusCode],
    /* 한 줄만 받아 쪽 정보의 전체 건수를 쓴다 — 목록을 다 받지 않는다. */
    queryFn: () =>
      runRequest(() =>
        client.GET('/quality/inspection-requests', {
          params: { query: { inspectionTypeCode, statusCode, page: 1, size: 1 } },
        }),
      ).then((response) => response.page.total),
    staleTime: 30_000,
  });
};

/**
 * 검사 조회·판정 탭 줄 오른쪽의 건수 칩 — 「대기 N · 진행 N」(입하 예정 조회의 단계 칩과 같은 자리 · omf-all-around#185).
 * 표시 전용이다 — 누르면 거르는 동작은 두지 않는다(기능 추가 없음). 셀 수 없는 상태는 칩을 세우지 않는다.
 * 탭 묶음 밖(탭 막대가 없는 계정 · 화면만 그린 시험)에서는 자리가 없어 아무것도 그리지 않는다.
 */
export const InspectionHubCounts = ({ inspectionTypeCode }: { inspectionTypeCode: string }) => {
  const target = useHubActionsTarget();
  const requested = useStatusCount(inspectionTypeCode, STATUSES[0].code);
  const inProgress = useStatusCount(inspectionTypeCode, STATUSES[1].code);
  const counts = [
    { key: STATUSES[0].code, label: STATUSES[0].label, count: requested.data },
    { key: STATUSES[1].code, label: STATUSES[1].label, count: inProgress.data },
  ].filter((entry): entry is typeof entry & { count: number } => entry.count !== undefined);

  if (target === null || counts.length === 0) return null;

  return (
    <HubActions target={target}>
      <div className="inspection-hub-counts" role="group" aria-label={t.label}>
        {counts.map((entry) => (
          <span key={entry.key} className="inspection-hub-count" data-status={entry.key}>
            {entry.label(entry.count)}
          </span>
        ))}
      </div>
    </HubActions>
  );
};
