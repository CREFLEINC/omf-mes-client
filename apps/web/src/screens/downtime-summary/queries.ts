import type { ApiClient } from '@omf-mes/api-client';
import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { useApiClient } from '../../patterns/api-context';
import { runRequest } from '../../patterns/request';
import type { DowntimeFilterQuery, Bucket, GroupBy } from './filters';
import type { PeriodQuery } from './period';
import {
  toIntervalView,
  toSummaryView,
  type DowntimeIntervalView,
  type DowntimeSummaryView,
} from './types';

/**
 * 이 화면의 읽기 — **집계 하나와 구간 목록 하나**다.
 *
 * ⭐ **탭을 바꾸는 것이 곧 다시 조회하는 것이다.** 세 탭이 같은 경로의 묶음 축(`groupBy`)으로
 * 갈리고 응답의 배열 하나만 채워지므로, 한 번 받아 화면에서 나누는 길이 없다.
 *
 * ⭐ **구간 목록은 요약의 안내를 눌렀을 때만 부른다.** 「빠진 구간」·「겹친 구간」은 건수만
 * 요약에 오고 목록은 담기지 않는다 — 목록이 필요하면 비가동 목록을 필터로 부르라고 계약이
 * 지시한다. 창을 열기 전에는 부르지 않는다.
 *
 * 경로 리터럴은 이 파일에만 둔다 — `openapi-fetch`가 경로를 리터럴 타입으로 요구해 문자열
 * 변수로 넘기면 타입 검사가 풀린다.
 *
 * **쓰기 오퍼레이션이 없다.** 이 화면은 조회 전용이다.
 */

type Client = ApiClient['client'];

export type DowntimeSummaryQuery = PeriodQuery &
  DowntimeFilterQuery & {
    groupBy: GroupBy;
    /** 추이 탭에서만 뜻이 있다 — 그 밖에는 서버가 무시한다. */
    bucket?: Bucket;
  };

/** 구간 목록의 두 갈래. 요약이 건수로만 알려 준 것을 목록으로 펴 볼 때 쓴다. */
export type IntervalKind = 'open' | 'overlapping';

export const downtimeSummaryKeys = {
  all: ['downtime-summary'] as const,
  summary: (query: DowntimeSummaryQuery | null) => ['downtime-summary', 'summary', query] as const,
  intervals: (kind: IntervalKind, query: unknown) =>
    ['downtime-summary', 'intervals', kind, query] as const,
};

const fetchSummary = async (
  client: Client,
  query: DowntimeSummaryQuery,
  groupBy: GroupBy,
): Promise<DowntimeSummaryView> => {
  const data = await runRequest(() =>
    client.GET('/maintenance/downtimes/summary', { params: { query } }),
  );

  return toSummaryView(data, groupBy);
};

/**
 * 비가동 집계.
 *
 * **기간이 서지 않으면 부르지 않는다**(공유계약 L-3 · 계약이 두 칸을 필수로 표시한다).
 * `query`가 `null`이면 그 상태다.
 */
export const useDowntimeSummary = (
  query: DowntimeSummaryQuery | null,
): UseQueryResult<DowntimeSummaryView> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: downtimeSummaryKeys.summary(query),
    enabled: query !== null,
    queryFn: () => {
      if (query === null) {
        throw new Error('기간 없이는 집계를 조회하지 않습니다.');
      }

      return fetchSummary(client, query, query.groupBy);
    },
  });
};

export interface IntervalListResult {
  items: DowntimeIntervalView[];
  total: number;
}

/**
 * 요약이 건수로 알려 준 구간의 목록.
 *
 * ⭐ **열린 구간에는 기간을 싣지 않는다.** 전날부터 이어진 구간을 놓치면 안 되기 때문이고,
 * 계약도 그 호출만 기간을 비울 수 있게 열어 두었다. 겹친 구간은 반대로 **조회한 기간 안**의
 * 것이라야 요약의 건수와 맞는다.
 */
const fetchIntervals = async (
  client: Client,
  kind: IntervalKind,
  period: PeriodQuery,
  filters: DowntimeFilterQuery,
): Promise<IntervalListResult> => {
  const data = await runRequest(() =>
    client.GET('/maintenance/downtimes', {
      params: {
        query:
          kind === 'open'
            ? {
                openOnly: true,
                ...(filters.equipmentId === undefined ? {} : { equipmentId: filters.equipmentId }),
              }
            : {
                overlappingOnly: true,
                startedFrom: period.startedFrom,
                startedTo: period.startedTo,
                ...(filters.equipmentId === undefined ? {} : { equipmentId: filters.equipmentId }),
              },
      },
    }),
  );

  return {
    items: data.items.map(toIntervalView),
    /* 전체 건수는 `page.total`을 읽는다 — `totalCount`는 같은 값의 옛 이름이다(공유계약 L-1). */
    total: data.page?.total ?? data.items.length,
  };
};

export const useDowntimeIntervals = (
  kind: IntervalKind | null,
  period: PeriodQuery | null,
  filters: DowntimeFilterQuery,
): UseQueryResult<IntervalListResult> => {
  const { client } = useApiClient();
  const enabled = kind !== null && period !== null;

  return useQuery({
    queryKey: downtimeSummaryKeys.intervals(kind ?? 'open', { period, filters }),
    enabled,
    queryFn: () => {
      if (kind === null || period === null) {
        throw new Error('구간 목록은 창을 연 뒤에만 조회합니다.');
      }

      return fetchIntervals(client, kind, period, filters);
    },
  });
};
