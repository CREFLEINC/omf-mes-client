import type { ApiClient, components, paths } from '@omf-mes/api-client';
import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { useApiClient } from '../../patterns/api-context';
import { runRequest } from '../../patterns/request';
type Client = ApiClient['client'];
type WorkOrder = components['schemas']['WorkOrder'];
type WorkOrderListResponse = Omit<
  paths['/production/work-orders']['get']['responses']['200']['content']['application/json'],
  'items'
> & { items: WorkOrder[] };

/** 홈 작업 현황을 다시 세는 주기 — 남은 작업 수(60초)와 같다. */
export const HOME_STATUS_INTERVAL_MS = 60_000;

export interface HomeWorkStatus {
  inProgress: number;
  waiting: number;
  /** 계획 시작이 가장 이른 대기(배포됨) 작업지시. 없으면 `null`. */
  next: WorkOrder | null;
}

const countOf = (
  client: Client,
  equipmentId: number | null,
  statusCode: 'IN_PROGRESS' | 'RELEASED',
): Promise<WorkOrderListResponse> =>
  runRequest(() =>
    client.GET('/production/work-orders', {
      params: {
        query: {
          /* POP 단말은 `open=true` 로만 목록을 읽는다(서버 단말 읽기 규칙) — 작업 지시 목록과 같은 조건이다. */
          open: true,
          statusCode,
          /* 작업 지시 목록(P-02-01)의 기본 목록과 같은 설비 축 — 설비 미정 W/O 도 이 설비에서 시작할 수 있다. */
          ...(equipmentId === null
            ? {}
            : { plannedEquipmentId: equipmentId, includeUnplannedEquipment: true }),
          sort: 'plannedStartAt,asc',
          page: 1,
          /* 수는 `page.total` 이 말한다 — 줄은 「다음 작업」 하나만 필요하다. */
          size: 1,
        },
      },
    }),
  ) as Promise<WorkOrderListResponse>;

/**
 * 홈 「오늘 작업 현황」(#291 확정 시안) — 진행 중 · 대기 수와 다음 작업.
 *
 * ⭐ 서버가 세어 준 수(`page.total`)만 쓴다 — 화면이 목록을 받아 세면 쪽 단위라 실제보다 적다.
 * ⚠ 시안의 「완료」 칸은 두지 않는다 — POP 단말은 끝난 작업지시를 읽을 수 없다(`open=true` 만 허용).
 *    보이려면 서버 단말 읽기 규칙이 먼저 바뀌어야 한다.
 * ⭐ 설비가 없는 단말은 「전체 설비」로 센다(작업 지시 목록의 「전체 설비」와 같은 축) — 화면이 그렇다고 적는다.
 * ⚠ 등록 정보를 받기 전(`enabled=false`)에는 묻지 않는다 — 설비를 몰라 전체로 세는 일을 막는다.
 */
export const useHomeWorkStatus = (
  equipmentId: number | null,
  enabled: boolean,
): UseQueryResult<HomeWorkStatus> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: ['pop-home', 'work-status', equipmentId],
    enabled,
    refetchInterval: HOME_STATUS_INTERVAL_MS,
    queryFn: async () => {
      const [inProgress, waiting] = await Promise.all([
        countOf(client, equipmentId, 'IN_PROGRESS'),
        countOf(client, equipmentId, 'RELEASED'),
      ]);
      return {
        inProgress: inProgress.page.total,
        waiting: waiting.page.total,
        next: waiting.items[0] ?? null,
      };
    },
  });
};
