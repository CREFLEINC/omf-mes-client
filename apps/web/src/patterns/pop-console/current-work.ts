import type { components } from '@omf-mes/api-client';
import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { useApiClient } from '../api-context';
import { runRequest } from '../request';

export type ConsoleWorkOrder = components['schemas']['WorkOrder'];
export type ConsoleWorkSession = components['schemas']['WorkSession'];

/**
 * 현재작업 패널이 보이는 **지금의 작업지시와 그 열린 세션**.
 *
 * ⭐ **작업지시는 주소가 소유한다**(`material-input-scan/screen-params.ts` 와 같은 규율). 골격이
 *    따로 기억해 두면 단말을 넘겨받은 다음 작업자에게 남의 작업지시가 보인다. 그래서 이 값은
 *    늘 지금 주소의 `workOrderId` 에서 다시 읽는다.
 *
 * ⭐ **누계는 서버가 낸 값이다**(`withProgress=true`). 실적은 여러 세션·단말에 흩어져 쌓이므로
 *    골격이 본 것만 더하면 늘 실제보다 적다(선례 `work-start/quantity-fulfilled`).
 *
 * ⚠ **30초마다 다시 묻는다.** 이 저장소는 자동 재조회를 꺼 두었는데(`providers`), 패널은 화면
 *   옆에 하루 종일 서 있는 자리라 묻지 않으면 작업자가 화면을 옮길 때까지 옛 숫자가 선다
 *   (목록이 스스로 갱신되지 않던 #29·#32 와 같은 불편).
 */
const REFRESH_MS = 30_000;

export const popConsoleKeys = {
  workOrder: (workOrderId: number) => ['pop', 'console', 'work-order', workOrderId] as const,
  openSession: (workOrderId: number) => ['pop', 'console', 'open-session', workOrderId] as const,
};

/**
 * 주소의 `workOrderId`. **양의 정수가 아니면 `null`** — 모르는 값으로 조회를 세우지 않는다.
 *
 * ⚠ 자릿수 검사를 먼저 한다 — `Number` 는 공백을 0 으로, `1e3` 을 1000 으로 읽는다
 *   (`running-change/screen-params` 와 같은 읽기).
 */
export const readWorkOrderIdParam = (search: string): number | null => {
  const raw = new URLSearchParams(search).get('workOrderId');

  if (raw === null || !/^\d+$/u.test(raw)) return null;

  const value = Number(raw);

  return Number.isSafeInteger(value) && value > 0 ? value : null;
};

export interface CurrentWork {
  workOrder: UseQueryResult<ConsoleWorkOrder>;
  /** 열린 세션. 없으면 `null`, 아직 모르면 `undefined`(`data`). */
  session: UseQueryResult<ConsoleWorkSession | null>;
}

export const useCurrentWork = (workOrderId: number | null): CurrentWork => {
  const { client } = useApiClient();

  const workOrder = useQuery({
    queryKey: popConsoleKeys.workOrder(workOrderId ?? 0),
    enabled: workOrderId !== null,
    refetchInterval: REFRESH_MS,
    queryFn: () => {
      if (workOrderId === null) throw new Error('작업지시를 모르면 조회하지 않습니다.');

      return runRequest(() =>
        client.GET('/production/work-orders/{workOrderId}', {
          params: { path: { workOrderId }, query: { withProgress: true } },
        }),
      );
    },
  });

  const session = useQuery({
    queryKey: popConsoleKeys.openSession(workOrderId ?? 0),
    enabled: workOrderId !== null,
    refetchInterval: REFRESH_MS,
    queryFn: async () => {
      if (workOrderId === null) throw new Error('작업지시를 모르면 세션을 조회하지 않습니다.');

      const data = await runRequest(() =>
        client.GET('/production/work-sessions', {
          params: { query: { workOrderId, open: true, page: 1, size: 2 } },
        }),
      );

      return data.items[0] ?? null;
    },
  });

  return { workOrder, session };
};

/**
 * 상태등의 색 — **단말이 아는 것은 세션 상태다.**
 *
 * ⛔ **설비 PLC 상태를 지어내지 않는다.** 설비가 실제로 도는지는 단말이 모른다. 「가동 중」은
 *    「이 작업지시의 세션이 열려 있고 중단되지 않았다」는 뜻이다.
 *
 * ⚠ 세션 상태 코드는 `RUNNING`·`STOPPED` 둘을 안다(`work-hold-register/types.ts`). 모르는 코드는
 *   「확인 중」과 같은 회색으로 둔다 — 초록으로 접으면 멈춘 설비가 도는 것처럼 보인다.
 */
export type SessionLight = 'running' | 'stopped' | 'none' | 'unknown';

export const sessionLightOf = (
  workOrderId: number | null,
  session: UseQueryResult<ConsoleWorkSession | null>,
): SessionLight => {
  if (workOrderId === null) return 'none';
  if (session.isPending || session.isError) return 'unknown';
  if (session.data === null) return 'none';
  if (session.data.statusCode === 'RUNNING') return 'running';
  if (session.data.statusCode === 'STOPPED') return 'stopped';

  return 'unknown';
};
