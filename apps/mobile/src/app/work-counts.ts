import type { components } from '@omf-mes/api-client';
import { useQuery } from '@tanstack/react-query';

import { useApiClient } from '../patterns/api-context';
import { currentDeviceToken } from '../patterns/device-token';
import { runRequest } from '../patterns/request';
import { readTerminalIdFromToken } from '../patterns/token-claims';
import { useWorkerSession } from '../patterns/worker-session';
import type { HomeScreen } from './home-menu';

type TerminalWorkCounts = components['schemas']['TerminalWorkCounts'];

/** 홈에 머무는 동안 다시 세는 간격(FR-015, SC-002 — 열려 있으면 60초 안). */
export const WORK_COUNT_INTERVAL_MS = 60_000;

export const workCountKeys = {
  counts: ['terminal-work-counts'] as const,
  terminal: (terminalId: number | null) =>
    ['terminal-work-counts', 'terminal', terminalId] as const,
};

/**
 * 이 단말의 남은 작업 수(피처 002, `/app/terminal-work-counts`).
 *
 * - 사번을 넣기 전에는 부르지 않는다(US3-7) — 홈 자체가 사번 뒤에만 서지만, 조회도 같은 조건을 건다.
 * - 홈에 들어올 때마다 다시 받고(`refetchOnMount: 'always'`) 머무는 동안 60초마다(US3-4).
 * - **실패하면 `undefined`** — 배지를 그리지 않고 오류 문구도 띄우지 않는다(FR-018). 앞서 받은 수가
 *   남아 있어도 실패한 동안은 낡은 수를 보이지 않는다.
 */
export const useWorkCounts = (): TerminalWorkCounts | undefined => {
  const { client } = useApiClient();
  const { worker } = useWorkerSession();
  const query = useQuery({
    queryKey: workCountKeys.counts,
    enabled: worker !== null,
    staleTime: 0,
    refetchOnMount: 'always',
    refetchInterval: WORK_COUNT_INTERVAL_MS,
    queryFn: () => runRequest(() => client.GET('/app/terminal-work-counts')),
  });

  return query.isError ? undefined : query.data;
};

/**
 * 수의 기준 — 이 단말의 창고 이름, 창고가 없으면 `null`(공장 전체). 모르면 `undefined` 라 표시하지 않는다.
 * 단말 응답에 창고 칸이 없으면 창고 지정이 없는 것이라 공장 전체다.
 */
export const useCountBasis = (enabled: boolean): string | null | undefined => {
  const { client } = useApiClient();
  const token = currentDeviceToken();
  const terminalId = token === null ? null : readTerminalIdFromToken(token);
  const query = useQuery({
    queryKey: workCountKeys.terminal(terminalId),
    enabled: enabled && terminalId !== null,
    queryFn: () =>
      runRequest(() =>
        client.GET('/mdm/terminals/{terminalId}', {
          params: { path: { terminalId: terminalId ?? 0 } },
        }),
      ),
  });

  if (query.data === undefined || query.isError) return undefined;
  const { warehouseName } = query.data;
  return warehouseName === undefined || warehouseName === null || warehouseName.trim() === ''
    ? null
    : warehouseName;
};

/** 한 작업 화면의 남은 수. 셀 수 없는 화면이거나 수를 모르면 `undefined`. */
export const countOf = (
  screen: HomeScreen,
  counts: TerminalWorkCounts | undefined,
): number | undefined =>
  screen.countKey === undefined || counts === undefined ? undefined : counts[screen.countKey];

/** 업무 하나의 남은 수 합. 셀 수 있는 화면이 없거나 수를 모르면 `undefined`. */
export const sumOf = (
  screens: readonly HomeScreen[],
  counts: TerminalWorkCounts | undefined,
): number | undefined => {
  const known = screens
    .map((screen) => countOf(screen, counts))
    .filter((count): count is number => count !== undefined);

  return known.length === 0 ? undefined : known.reduce((total, count) => total + count, 0);
};
