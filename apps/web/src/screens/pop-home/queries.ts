import type { ApiClient, components, paths } from '@omf-mes/api-client';
import { keepPreviousData, useQuery, type UseQueryResult } from '@tanstack/react-query';

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
  /** 오늘(단말 시계의 0시 이후) 끝난(완료·마감) 작업지시 수. */
  done: number;
  /** 계획 시작이 가장 이른 대기(배포됨) 작업지시. 없으면 `null`. */
  next: WorkOrder | null;
}

/** 끝난 W/O — 완료와 마감(쉼표 나열은 목록 조회가 받는 형식이다). */
const FINISHED = 'COMPLETED,CLOSED';

/** 단말 시계로 오늘 0시(ISO). 단말은 공장 시간대로 맞춰 둔다. */
const startOfToday = (): string => {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
};

/** 현황 칸 하나(진행 중 · 대기 · 완료)가 세는 W/O 상태. */
export type HomeStatusCode = 'IN_PROGRESS' | 'RELEASED' | typeof FINISHED;

export const HOME_STATUS_CODES = {
  run: 'IN_PROGRESS',
  wait: 'RELEASED',
  done: FINISHED,
} as const satisfies Record<string, HomeStatusCode>;

/**
 * 현황 칸의 수와 그 아래 목록이 같은 조건으로 묻는다 — 목록 «전체 건수»가 칸의 수와 같다.
 * 수만 셀 때는 `size: 1`, 목록은 들어가는 만큼(`size`)과 실적(`withProgress`)을 함께 받는다.
 */
const listOf = (
  client: Client,
  equipmentId: number | null,
  statusCode: HomeStatusCode,
  page = 1,
  size = 1,
  withProgress = false,
): Promise<WorkOrderListResponse> =>
  runRequest(() =>
    client.GET('/production/work-orders', {
      params: {
        query: {
          /*
           * POP 단말은 열린 W/O(`open=true`)만 읽는다. 완료만은 «최근 갱신분»(`updatedSince` 48시간 안)으로
           * 읽는다(서버 단말 읽기 규칙 · #291) — 오늘 0시 이후 완료로 바뀐 것을 센다.
           */
          ...(statusCode === FINISHED ? { updatedSince: startOfToday() } : { open: true }),
          statusCode,
          /* 작업 지시 목록(P-02-01)의 기본 목록과 같은 설비 축 — 설비 미정 W/O 도 이 설비에서 시작할 수 있다. */
          ...(equipmentId === null
            ? {}
            : { plannedEquipmentId: equipmentId, includeUnplannedEquipment: true }),
          /*
           * 작업 지시 목록(P-02-01)과 같은 순서(우선순위)로 고른다 — 다음 작업을 누르면 그 목록에서 이 W/O 를
           * 골라 연다(#291). 순서가 다르면 다음 작업이 목록 첫 쪽에 없을 수 있다.
           */
          sort: 'priorityNo,asc',
          /* 수는 `page.total` 이 말한다 — 수만 셀 때 줄은 「다음 작업」 하나만 필요하다. */
          page,
          size,
          ...(withProgress ? { withProgress: true } : {}),
        },
      },
    }),
  ) as Promise<WorkOrderListResponse>;

/**
 * 홈 「오늘 작업 현황」(#291 확정 시안) — 진행 중 · 대기 수와 다음 작업.
 *
 * ⭐ 서버가 세어 준 수(`page.total`)만 쓴다 — 화면이 목록을 받아 세면 쪽 단위라 실제보다 적다.
 * ⭐ 완료는 「오늘 0시 이후 끝난(완료·마감) W/O」 수다 — 현장의 [작업지시 마감]은 W/O 를 바로 마감(CLOSED)으로
 *    보내므로 둘을 함께 센다. 서버가 단말에 최근 48시간 끝난 것만 열어 준다(#291).
 *    ⚠ 기준은 W/O 의 마지막 갱신 시각(`updatedSince`)이다 — 완료·마감 시각으로 거르는 조건이 목록 조회에 없다.
 *       끝난 W/O 는 거의 고쳐지지 않으므로 「오늘 끝난 것」에 가깝게 맞는다(어제 끝나고 오늘 고친 것도 들어간다).
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
      const [inProgress, waiting, done] = await Promise.all([
        listOf(client, equipmentId, 'IN_PROGRESS'),
        listOf(client, equipmentId, 'RELEASED'),
        listOf(client, equipmentId, FINISHED),
      ]);
      return {
        inProgress: inProgress.page.total,
        waiting: waiting.page.total,
        done: done.page.total,
        next: waiting.items[0] ?? null,
      };
    },
  });
};

/**
 * 「오늘 작업 현황」에서 고른 칸(진행 중 · 대기 · 완료)의 작업지시 목록(사용자 지시 2026-11-19).
 * 칸의 수와 같은 조회 조건에 쪽(`page`·`size` = 카드에 들어가는 줄 수)만 더한다.
 */
export const useHomeWorkOrders = (
  equipmentId: number | null,
  statusCode: HomeStatusCode,
  page: number,
  size: number,
  enabled: boolean,
): UseQueryResult<WorkOrderListResponse> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: ['pop-home', 'work-orders', equipmentId, statusCode, page, size],
    enabled,
    refetchInterval: HOME_STATUS_INTERVAL_MS,
    /* 쪽·줄 수를 바꿔 다시 받는 동안 앞 목록을 둔다 — 줄이 깜빡 사라지지 않게. */
    placeholderData: keepPreviousData,
    queryFn: () => listOf(client, equipmentId, statusCode, page, size, true),
  });
};
