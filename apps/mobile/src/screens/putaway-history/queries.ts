import type { components } from '@omf-mes/api-client';
import {
  useInfiniteQuery,
  type InfiniteData,
  type UseInfiniteQueryResult,
} from '@tanstack/react-query';

import { useApiClient } from '../../patterns/api-context';
import { runRequest } from '../../patterns/request';

export type PutawayRecord = components['schemas']['PutawayRecord'];

/** 「내 기록」(작업자, 단말 무관) · 「이 단말」(작업자 무관). */
export type PutawayRecordScope = 'WORKER' | 'TERMINAL';

/** 한 쪽에 받는 수 — 서버 기본값과 같다. */
const PAGE_SIZE = 50;

export const putawayRecordKeys = {
  /** 기준 · 사번 · 날짜를 가리지 않고 전부 — 전송 대기가 보내졌을 때 다시 부르는 데 쓴다. */
  all: ['putaway-records'] as const,
  /*
   * 「내 기록」은 사번이 열쇠에 든다 - 교대로 사번이 바뀌면 다른 목록이라 앞 작업자의 줄이 남지 않는다.
   * 「이 단말」은 사번과 무관해 null 로 둔다 - 사번이 바뀌어도 받아 둔 목록을 그대로 쓴다.
   */
  list: (scope: PutawayRecordScope, workerNo: string | null, businessDate: string) =>
    ['putaway-records', scope, scope === 'WORKER' ? workerNo : null, businessDate] as const,
};

interface PutawayRecordPage {
  items: PutawayRecord[];
  page: number;
  total: number;
}

export interface PutawayRecordList {
  /** 지금까지 받은 쪽을 이어 붙인 것. 최근 것부터. */
  items: PutawayRecord[];
  /** 이 기준 · 날짜의 전체 건수. */
  total: number;
}

const toList = (data: InfiniteData<PutawayRecordPage>): PutawayRecordList => ({
  items: data.pages.flatMap((each) => each.items),
  total: data.pages[0]?.total ?? 0,
});

/**
 * 서버에 남은 적치를 영업일 하루치 받는다(M-01-14).
 *
 * 화면에 들어올 때마다 새로 묻는다 - 적치 화면에서 방금 한 것이 들어와 있어야 한다. 받아 둔 것은
 * 메모리 캐시에만 남아, 연결이 끊긴 채 다시 열면 그때 받은 목록과 시각을 보인다(디스크에 두지 않는다).
 */
export const usePutawayRecords = (
  scope: PutawayRecordScope,
  workerNo: string | null,
  businessDate: string,
): UseInfiniteQueryResult<PutawayRecordList> => {
  const { client } = useApiClient();

  return useInfiniteQuery({
    queryKey: putawayRecordKeys.list(scope, workerNo, businessDate),
    enabled: scope === 'TERMINAL' || workerNo !== null,
    staleTime: 0,
    refetchOnMount: 'always',
    initialPageParam: 1,
    queryFn: async ({ pageParam }): Promise<PutawayRecordPage> => {
      if (scope === 'WORKER' && workerNo === null) {
        throw new Error('사번을 확인하기 전에는 내 기록을 조회하지 않습니다.');
      }

      const data = await runRequest(() =>
        client.GET('/logistics/putaway-records', {
          params: {
            query: { scope, businessDate, page: pageParam, size: PAGE_SIZE },
            /* 「이 단말」은 작업자와 무관하다. 사번은 「내 기록」에만 싣는다. */
            ...(scope === 'WORKER' && workerNo !== null
              ? { header: { 'X-Worker-No': workerNo } }
              : {}),
          },
        }),
      );

      return { items: data.items, page: data.page.page, total: data.page.total };
    },
    /* 받은 수로 센다 - 서버가 빈 쪽을 답하면 거기서 멈춘다(patterns/masters.ts 와 같다). */
    getNextPageParam: (last, pages) => {
      const loaded = pages.reduce((count, each) => count + each.items.length, 0);

      return last.items.length > 0 && loaded < last.total ? last.page + 1 : undefined;
    },
    select: toList,
  });
};
