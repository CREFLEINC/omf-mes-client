import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { useApiClient } from '../../patterns/api-context';
import { fetchAllPages } from '../../patterns/fetch-all-pages';
import { runRequest } from '../../patterns/request';
import {
  toSessionViews,
  toWorkerResults,
  type SessionView,
  type WorkerResultRow,
} from './crew-model';
import type { ProgressListQuery } from './filters';
import type { WorkOrder, WorkOrderListResponse } from './types';

/** 이 화면이 소유하는 캐시 키. 다른 화면 슬라이스의 키 모듈을 참조하지 않는다. */
export const workOrderProgressKeys = {
  all: ['work-order-progress'] as const,
  list: (query: ProgressListQuery | null) =>
    ['work-order-progress', 'list', query === null ? null : { ...query }] as const,
  detail: (workOrderId: number | null) => ['work-order-progress', 'detail', workOrderId] as const,
  crew: (workOrderId: number | null) => ['work-order-progress', 'crew', workOrderId] as const,
};

/**
 * 진행현황 목록.
 *
 * ⛔ **기간이 막히면 조회를 열지 않는다** — 막았는데 요청은 나가는 상태를 만들지 않는다.
 * 조건을 만드는 쪽(`toProgressListQuery`)이 `null`을 주므로 여기서는 그것만 보면 된다.
 *
 * ⛔ **자동 갱신을 두지 않는다**(L-6). 관리자 조회 화면에 폴링을 두면 서버 부하가 사용자 수만큼
 * 곱해진다 — 갱신은 **사람이 새로고침을 누를 때만** 일어난다. 그래서 `refetchInterval`도
 * 창 포커스 재조회도 켜지 않는다.
 */
export const useWorkOrderProgressList = (
  query: ProgressListQuery | null,
): UseQueryResult<WorkOrderListResponse> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: workOrderProgressKeys.list(query),
    enabled: query !== null,
    queryFn: () => {
      if (query === null) throw new Error('기간이 막힌 채로는 목록을 조회하지 않습니다.');

      return runRequest(() => client.GET('/production/work-orders', { params: { query } }));
    },
  });
};

/**
 * 고른 W/O 의 상세. 목록의 줄을 눌렀을 때 연다.
 *
 * 목록 응답에 이미 대부분이 실려 오지만 상세를 따로 부르는 이유는, **목록은 페이지가 바뀌면
 * 사라지는 값**이고 상세는 고른 것 하나를 붙들고 있어야 하기 때문이다.
 */
export const useWorkOrderDetail = (workOrderId: number | null): UseQueryResult<WorkOrder> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: workOrderProgressKeys.detail(workOrderId),
    enabled: workOrderId !== null,
    queryFn: () => {
      if (workOrderId === null) throw new Error('고르기 전에는 상세를 조회하지 않습니다.');

      return runRequest(() =>
        client.GET('/production/work-orders/{workOrderId}', {
          params: { path: { workOrderId } },
        }),
      );
    },
  });
};

export interface WorkOrderCrew {
  sessions: SessionView[];
  workerResults: WorkerResultRow[];
  /** 다 받지 못한 것 — 무엇이 빠졌는지 말하려고 갈라 둔다 */
  sessionsTruncated: boolean;
  resultsTruncated: boolean;
}

/**
 * 고른 W/O 의 작업 세션·참여자와 작업자별 실적.
 *
 * ⚠ 세션 목록은 열린 것과 끝난 것을, 참여자는 남은 사람과 떠난 사람을 따로 내려 준다 — 둘 다
 *   받아 합친다. 세션마다 참여자 조회가 따로 나가므로 창을 열 때만 부른다.
 */
export const useWorkOrderCrew = (workOrderId: number | null): UseQueryResult<WorkOrderCrew> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: workOrderProgressKeys.crew(workOrderId),
    enabled: workOrderId !== null,
    queryFn: async () => {
      if (workOrderId === null) throw new Error('고르기 전에는 세션을 조회하지 않습니다.');

      const sessionsOf = (open: boolean) =>
        fetchAllPages((page, size) =>
          runRequest(() =>
            client.GET('/production/work-sessions', {
              params: { query: { workOrderId, open, page, size } },
            }),
          ),
        );
      const [openSessions, closedSessions, results] = await Promise.all([
        sessionsOf(true),
        sessionsOf(false),
        fetchAllPages((page, size) =>
          runRequest(() =>
            client.GET('/production/production-results', {
              params: { query: { workOrderId, page, size } },
            }),
          ),
        ),
      ]);
      const sessions = [...openSessions.items, ...closedSessions.items];
      const workersOf = (workSessionId: number, active: boolean) =>
        runRequest(() =>
          client.GET('/production/work-sessions/{workSessionId}/workers', {
            params: { path: { workSessionId }, query: { active } },
          }),
        );
      const workers = await Promise.all(
        sessions.map(async (session) => {
          const [present, left] = await Promise.all([
            workersOf(session.workSessionId, true),
            workersOf(session.workSessionId, false),
          ]);
          return [session.workSessionId, [...present, ...left]] as const;
        }),
      );
      const views = toSessionViews(sessions, new Map(workers));
      const workerResults = toWorkerResults(
        results.items,
        views.flatMap((view) => view.participants),
      );

      /* 배분이 없던 실적은 이름을 모를 수 있다 — 작업자 상세로 풀고, 못 풀면 「알 수 없음」으로 둔다. */
      const named = await Promise.all(
        workerResults.map(async (row) => {
          if (row.workerName !== null) return row;
          try {
            const { worker } = await runRequest(() =>
              client.GET('/mdm/workers/{workerId}', {
                params: { path: { workerId: row.workerId } },
              }),
            );
            return { ...row, workerNo: worker.workerNo, workerName: worker.workerName };
          } catch {
            return row;
          }
        }),
      );

      return {
        sessions: views,
        workerResults: named,
        sessionsTruncated: openSessions.truncated || closedSessions.truncated,
        resultsTruncated: results.truncated,
      };
    },
  });
};
