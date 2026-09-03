import type { ApiClient, paths } from '@omf-mes/api-client';
import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { useApiClient } from '../../patterns/api-context';
import { runRequest } from '../../patterns/request';
import type { EventFilterQuery } from './filters';
import type { PeriodQuery } from './period';
import { toAuditEventView, type AuditEventListResult, type AuditEventView } from './types';

/**
 * 이 화면의 읽기 — **오퍼레이션이 하나뿐이다.**
 *
 * 계약에 `/audit/events/{id}` 같은 상세 경로가 없다. 그래서 변경 내용 창은 목록 응답의 값을
 * 그대로 쓰며, 창을 열 때 요청이 **0회**인 것이 구조적으로 강제된다.
 *
 * 경로 리터럴은 이 파일에만 둔다 — `openapi-fetch`가 경로를 리터럴 타입으로 요구해
 * 문자열 변수로 넘기면 타입 검사가 풀린다.
 */

type Client = ApiClient['client'];
type AuditEventQuery = NonNullable<paths['/audit/events']['get']['parameters']['query']>;

/**
 * 목록 조회의 쿼리 전체. **기간은 필수**이고 나머지는 값이 있을 때만 키가 실린다 —
 * 요청 URL이 조건을 그대로 드러내야 무엇으로 조회했는지 읽을 수 있다.
 *
 * `size`는 싣지 않는다. 서버 기본값을 그대로 쓰고 쪽 크기를 화면이 정하지 않는다.
 */
export type AuditEventListQuery = PeriodQuery &
  EventFilterQuery & {
    /** 첫 쪽이면 싣지 않는다 — 서버 기본값이 1이다. */
    page?: number;
  };

export const auditEventKeys = {
  all: ['audit-events'] as const,
  list: (query: AuditEventListQuery | null) => ['audit-events', 'list', query] as const,
  /** 선택지는 **기간만** 담는다. 조건을 담으면 조건을 좁힐 때마다 선택지도 함께 좁아진다. */
  options: (period: PeriodQuery | null) => ['audit-events', 'options', period] as const,
};

const fetchAuditEvents = async (
  client: Client,
  query: AuditEventListQuery,
): Promise<AuditEventListResult> => {
  const data = await runRequest(() =>
    client.GET('/audit/events', { params: { query: query as AuditEventQuery } }),
  );

  return { items: data.items.map(toAuditEventView), page: data.page };
};

/**
 * 변경 이력 목록.
 *
 * **기간이 갖춰지지 않으면 조회하지 않는다**(`query === null`). 계약이 기간을 필수로 두어
 * 비운 채 보내면 400이 돌아오고, 사용자에게는 「조회가 늘 실패한다」로만 보인다.
 */
export const useAuditEventList = (
  query: AuditEventListQuery | null,
): UseQueryResult<AuditEventListResult> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: auditEventKeys.list(query),
    enabled: query !== null,
    queryFn: () => {
      if (query === null) {
        throw new Error('기간을 정하기 전에는 목록을 조회하지 않습니다.');
      }

      return fetchAuditEvents(client, query);
    },
  });
};

export interface FilterOptionsResult {
  rows: AuditEventView[];
  /** 실패했으면 참. 실패를 삼키면 선택칸이 이유 없이 비어 보인다. */
  isError: boolean;
}

const EMPTY_ROWS: AuditEventView[] = [];

/**
 * 필터 선택지의 원천 — **같은 기간에 다른 조건 없이** 한 번 더 조회한다.
 *
 * 화면의 조회 조건을 그대로 쓰면 대상 종류를 하나로 좁혔을 때 결과의 대상 종류가 하나뿐이라
 * 선택지가 자기 자신으로 줄고 **다른 값으로 바꿀 수 없게 된다.**
 *
 * 서버가 쪽을 나눠 주므로 이 결과도 첫 쪽뿐이다. 그 한계는 선택칸 아래 안내가 밝힌다.
 *
 * 조건이 하나도 걸리지 않은 첫 쪽에서는 화면이 이 훅을 끈다(`period === null`) —
 * 그때는 목록 조회가 곧 「조건 없는 조회」라 같은 요청을 한 번 더 보낼 이유가 없다.
 */
export const useFilterOptions = (period: PeriodQuery | null): FilterOptionsResult => {
  const { client } = useApiClient();

  const options = useQuery({
    queryKey: auditEventKeys.options(period),
    enabled: period !== null,
    queryFn: () => {
      if (period === null) {
        throw new Error('기간을 정하기 전에는 선택지를 조회하지 않습니다.');
      }

      return fetchAuditEvents(client, period);
    },
  });

  return { rows: options.data?.items ?? EMPTY_ROWS, isError: options.isError };
};
