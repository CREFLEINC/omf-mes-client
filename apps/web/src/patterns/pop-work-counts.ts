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

/**
 * 화면 탭 건수(POP 통일 시안 #295) — `/app/terminal-work-counts` 가 세지 않는 화면의 수.
 * 그 화면이 이미 쓰는 GET 을 한 쪽(size 1)만 불러 서버가 준 합계를 쓴다. 남은 작업 창에는 넣지 않는다.
 * - 자재 관리 LOT 라벨: 공장 전체 이미 만든 미출력 자재 관리 LOT 수(`material-lot-pairs` 의 `summary.unprintedCount` —
 *   피처 014 D-9). 아직 아무도 고르지 않은 조합의 「생성 예정」 몫은 세지 않는다(가벼운 집계).
 * - 분할 LOT 라벨: 라벨 안 찍은 분할 LOT 수(`unprintedCount` — 화면 「발행 대기 N」과 같다)
 * 갈 수 없는 화면(`paths` 에 없음)은 부르지 않는다. 실패하거나 아직이면 그 화면 수는 없다.
 */
const POP_TAB_COUNT_PATHS = {
  materialLotLabel: '/pop/material-lot-label',
  splitLotLabel: '/pop/goods-issue-qr',
} as const;

const popTabCountKeys = { all: ['pop-tab-counts'] as const };

export const usePopTabCounts = (
  enabled: boolean,
  plantId: number | null,
  paths: readonly string[],
): Partial<Record<string, number>> => {
  const { client } = useApiClient();
  const can = (path: string): boolean => enabled && paths.includes(path);
  const common = { refetchInterval: POP_WORK_COUNT_INTERVAL_MS } as const;

  const material = useQuery({
    ...common,
    queryKey: [...popTabCountKeys.all, 'material-lot-label', plantId],
    enabled: can(POP_TAB_COUNT_PATHS.materialLotLabel) && plantId !== null,
    queryFn: async () => {
      const data = await runRequest(() =>
        client.GET('/logistics/material-lot-pairs', {
          params: { query: { plantId: plantId ?? 0, page: 1, size: 1 } },
        }),
      );
      return data.summary.unprintedCount;
    },
  });
  const split = useQuery({
    ...common,
    queryKey: [...popTabCountKeys.all, 'split-lot-label', plantId],
    enabled: can(POP_TAB_COUNT_PATHS.splitLotLabel) && plantId !== null,
    queryFn: async () => {
      const data = await runRequest(() =>
        client.GET('/logistics/split-material-lots', {
          params: {
            query: { plantId: plantId ?? 0, labelState: 'UNPRINTED', page: 1, size: 1 },
          },
        }),
      );
      return data.unprintedCount;
    },
  });
  const valueOf = (query: { isError: boolean; data: number | undefined }) =>
    query.isError ? undefined : query.data;

  return {
    [POP_TAB_COUNT_PATHS.materialLotLabel]: valueOf(material),
    [POP_TAB_COUNT_PATHS.splitLotLabel]: valueOf(split),
  };
};
