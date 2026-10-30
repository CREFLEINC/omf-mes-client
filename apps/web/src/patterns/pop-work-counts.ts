import type { components } from '@omf-mes/api-client';
import { useQuery } from '@tanstack/react-query';

import { useApiClient } from './api-context';
import { runRequest } from './request';

type TerminalWorkCounts = components['schemas']['TerminalWorkCounts'];

/** 열려 있는 동안 다시 세는 간격(SC-002 — 60초 안). */
export const POP_WORK_COUNT_INTERVAL_MS = 60_000;

export const popWorkCountKeys = { all: ['terminal-work-counts', 'pop'] as const };

export interface PopWorkCounts {
  /** 받은 수. 실패·아직이면 `undefined` — 그때는 배지·점·묶음을 그리지 않는다(FR-018). */
  counts: TerminalWorkCounts | undefined;
  /** 화면 이동 창을 열 때 다시 받는다. */
  refresh: () => void;
}

/**
 * 이 단말의 남은 작업 수(피처 002, `/app/terminal-work-counts`). 사번이 확인된 뒤에만 부른다.
 * 실패한 동안은 앞서 받은 수도 보이지 않는다 — 낡은 수가 「남은 일」을 거짓으로 말하지 않게.
 */
export const usePopWorkCounts = (enabled: boolean): PopWorkCounts => {
  const { client } = useApiClient();
  const query = useQuery({
    queryKey: popWorkCountKeys.all,
    enabled,
    refetchInterval: POP_WORK_COUNT_INTERVAL_MS,
    queryFn: () => runRequest(() => client.GET('/app/terminal-work-counts')),
  });

  return {
    counts: query.isError ? undefined : query.data,
    refresh: () => {
      if (enabled) void query.refetch();
    },
  };
};
