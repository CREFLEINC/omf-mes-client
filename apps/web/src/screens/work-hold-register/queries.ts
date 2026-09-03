import type { ApiClient } from '@omf-mes/api-client';
import { useQuery } from '@tanstack/react-query';

import { useApiClient } from '../../patterns/api-context';
import { runRequest } from '../../patterns/request';
import {
  isOpenSession,
  toWorkSessionEventView,
  toWorkSessionView,
  type WorkSessionEventView,
  type WorkSessionView,
} from './types';

/**
 * 이 화면의 읽기 둘.
 *
 * | 구획 | 호출 |
 * | --- | --- |
 * | 현재 세션 | `GET /production/work-sessions` · `open=true` + 이 작업지시 |
 * | 이벤트 이력 | `GET /production/work-sessions/{workSessionId}/events` |
 *
 * ⛔ **이벤트 이력을 유형으로 좁히지 않는다.** 스펙 §3 목업이 「시작 → 중단 → 재개」를 나란히
 * 그린다 — 중단만 남기면 언제 다시 돌았는지가 사라져 작업자가 지금 상태를 읽지 못한다.
 *
 * 경로 리터럴은 이 파일에만 둔다 — `openapi-fetch`가 경로를 리터럴 타입으로 요구해 문자열
 * 변수로 넘기면 타입 검사가 풀린다.
 */

type Client = ApiClient['client'];

export const workHoldKeys = {
  all: ['work-hold-register'] as const,
  openSession: (workOrderId: number) =>
    ['work-hold-register', 'open-session', workOrderId] as const,
  events: (workSessionId: number) => ['work-hold-register', 'events', workSessionId] as const,
};

const fetchOpenSession = async (
  client: Client,
  workOrderId: number,
): Promise<WorkSessionView[]> => {
  const data = await runRequest(() =>
    client.GET('/production/work-sessions', {
      /* 기본이 열린 세션이지만 명시한다 — 기본값이 바뀌면 이 화면은 닫힌 세션에 중단을 건다. */
      params: { query: { workOrderId, open: true } },
    }),
  );

  /*
   * ⚠ **받은 것을 한 번 더 거른다.** 「열린 것만」으로 물었지만 닫힌 세션이 섞여 오면 화면이
   * **없는 세션에 중단을 걸려고 한다** — 세션 사건의 `work_session_id` 는 NOT NULL 이라
   * 그 요청은 거부되고, 작업자는 왜 막혔는지 알 길이 없다.
   *
   * 열려 있는지는 **끝 시각의 부재**로 판정할 수 있으므로 화면이 스스로 확인할 수 있다 —
   * 확인할 수 있는 것을 믿고 넘기지 않는다.
   */
  return data.items.map(toWorkSessionView).filter(isOpenSession);
};

const fetchEvents = async (
  client: Client,
  workSessionId: number,
): Promise<WorkSessionEventView[]> => {
  const data = await runRequest(() =>
    client.GET('/production/work-sessions/{workSessionId}/events', {
      params: { path: { workSessionId } },
    }),
  );

  return data.map(toWorkSessionEventView);
};

export interface OpenSessionResult {
  /**
   * 열린 세션. **여럿이면 가장 늦게 시작한 것**을 쓴다 — 저장 측이 한 작업지시에 열린 세션
   * 하나를 강제하지 않아 둘 이상일 수 있고, 그중 하나를 고르는 근거가 필요하다. 작업자가
   * 지금 서 있는 것은 방금 연 세션이다.
   */
  session: WorkSessionView | null;
  isPending: boolean;
  /** 다시 읽는 중인가. 그 구간에는 **옛 값이 그대로 나온다.** */
  isFetching: boolean;
  isError: boolean;
  error: unknown;
  refetch: () => void;
}

export const useOpenSession = (workOrderId: number | null): OpenSessionResult => {
  const { client } = useApiClient();

  const query = useQuery({
    queryKey: workHoldKeys.openSession(workOrderId ?? 0),
    enabled: workOrderId !== null,
    queryFn: () => {
      if (workOrderId === null) {
        throw new Error('작업지시를 모르면 세션을 조회하지 않습니다.');
      }

      return fetchOpenSession(client, workOrderId);
    },
  });

  /*
   * ⛔ **시각을 사전순으로 비교하지 않는다.** 오프셋이 섞이면(`+09:00` 과 `Z`) 사전순과
   * 시간순이 갈리고, 그러면 「방금 연 세션」이 아닌 것에 중단이 걸린다.
   */
  const latest = [...(query.data ?? [])].sort(
    (left, right) => Date.parse(right.startedAt) - Date.parse(left.startedAt),
  )[0];

  return {
    session: latest ?? null,
    isPending: workOrderId !== null && query.isPending,
    /** 다시 읽는 중인가. **옛 값을 그대로 내주는 구간**이라 화면이 알아야 한다. */
    isFetching: query.isFetching,
    isError: query.isError,
    error: query.error,
    refetch: () => {
      void query.refetch();
    },
  };
};

export interface SessionEventsResult {
  events: WorkSessionEventView[];
  isPending: boolean;
  isError: boolean;
  error: unknown;
  refetch: () => void;
}

/**
 * 이벤트 이력.
 *
 * ⚠ **이력을 못 읽은 것이 중단을 막지 않는다** — 이력은 지금 상태를 «설명»하는 자리이고,
 * 설비가 멈춘 순간에 기록을 남기지 못할 이유가 되면 안 된다.
 */
export const useSessionEvents = (workSessionId: number | null): SessionEventsResult => {
  const { client } = useApiClient();

  const query = useQuery({
    queryKey: workHoldKeys.events(workSessionId ?? 0),
    enabled: workSessionId !== null,
    queryFn: () => {
      if (workSessionId === null) {
        throw new Error('세션을 모르면 이벤트 이력을 조회하지 않습니다.');
      }

      return fetchEvents(client, workSessionId);
    },
  });

  return {
    events: query.data ?? [],
    isPending: workSessionId !== null && query.isPending,
    isError: query.isError,
    error: query.error,
    refetch: () => {
      void query.refetch();
    },
  };
};
