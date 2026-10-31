import { Chip } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useQueries } from '@tanstack/react-query';

import { useApiClient } from './api-context';
import { HubActions, useHubActionsTarget } from './hub-actions';
import { runRequest } from './request';

const t = messages.common.inspectionHub;

/**
 * 건수 칩 조회의 앞머리 — 저장 · 확정으로 의뢰 상태가 바뀌면 화면이 이 키를 무효화해 칩을 다시 센다(#197).
 * 비워 두면 30초 동안 저장 전 건수가 남는다.
 */
export const INSPECTION_HUB_COUNTS_KEY = ['inspection-hub-counts'] as const;

/** 칩으로 세우는 검사 의뢰 상태. 화면마다 고른다 — IQC 는 대기 큐라 완료가 없다. */
export type InspectionHubStatus = 'REQUESTED' | 'IN_PROGRESS' | 'COMPLETED';

const LABELS: Record<InspectionHubStatus, string> = {
  REQUESTED: t.requested,
  IN_PROGRESS: t.inProgress,
  COMPLETED: t.completed,
};

/** 주소·상태에서 읽은 값이 칩 상태인가 — 모르는 값은 거르지 않는다. */
export const toInspectionHubStatus = (
  raw: string | null,
  statuses: readonly InspectionHubStatus[],
): InspectionHubStatus | null => statuses.find((status) => status === raw) ?? null;

export interface InspectionHubCountsProps {
  inspectionTypeCode: string;
  statuses: readonly InspectionHubStatus[];
  /** 지금 거르는 상태. 비면 거르지 않는다. */
  active: InspectionHubStatus | null;
  onChange: (next: InspectionHubStatus | null) => void;
  /** 이 공장 LOT 의 의뢰만 센다 — 부품 공장 IQC 화면(omf-all-around#211). 비면 전체다. */
  plantId?: number;
}

/**
 * 검사 조회·판정 탭 줄 오른쪽의 상태 칩 — 「대기 N · 진행 N · 완료 N」(입하 예정 조회의 단계 칩과 같은 자리 · omf-all-around#185).
 * 누르면 목록이 그 상태만 남고, 다시 누르면 풀린다 — 조건 줄의 조건과 함께 걸린다.
 * 건수는 화면의 다른 조건과 무관한 그 검사 유형의 전체 건수다. 셀 수 없는 상태도 칩은 세운다(숫자만 비운다).
 * 탭 묶음 밖(탭 막대가 없는 계정 · 화면만 그린 시험)에서는 자리가 없어 아무것도 그리지 않는다.
 */
export const InspectionHubCounts = ({
  inspectionTypeCode,
  statuses,
  active,
  onChange,
  plantId,
}: InspectionHubCountsProps) => {
  const { client } = useApiClient();
  const target = useHubActionsTarget();
  /* 칩을 세울 자리(탭 막대)가 없으면 세지도 않는다 — 쓰지 않을 조회를 내지 않는다. */
  const counts = useQueries({
    queries: statuses.map((statusCode) => ({
      queryKey: [...INSPECTION_HUB_COUNTS_KEY, inspectionTypeCode, statusCode, plantId ?? null],
      /* 한 줄만 받아 쪽 정보의 전체 건수를 쓴다 — 목록을 다 받지 않는다. */
      queryFn: () =>
        runRequest(() =>
          client.GET('/quality/inspection-requests', {
            params: {
              query: {
                inspectionTypeCode,
                statusCode,
                ...(plantId === undefined ? {} : { plantId }),
                page: 1,
                size: 1,
              },
            },
          }),
        ).then((response) => response.page.total),
      staleTime: 30_000,
      enabled: target !== null,
    })),
  });

  if (target === null) return null;

  return (
    <HubActions target={target}>
      <div className="inspection-hub-counts" role="group" aria-label={t.label}>
        {statuses.map((status, index) => {
          const label = LABELS[status];
          const isActive = active === status;
          const count = counts[index]?.data;

          return (
            <Chip
              key={status}
              variant="filter"
              size="sm"
              selected={isActive}
              aria-pressed={isActive}
              aria-label={isActive ? t.filterOff(label) : t.filterOn(label)}
              data-status={status}
              onSelectedChange={(selected) => {
                onChange(selected ? status : null);
              }}
            >
              {count === undefined ? label : t.count(label, count)}
            </Chip>
          );
        })}
      </div>
    </HubActions>
  );
};
