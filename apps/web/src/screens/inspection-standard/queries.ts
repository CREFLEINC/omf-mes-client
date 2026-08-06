import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { useApiClient } from '../../patterns/api-context';
import { runRequest } from '../../patterns/request';
import { toListQuery } from './filters';
import type { InspectionPlan, LookupEntry, PageMeta, PlanFilters } from './types';

/**
 * 이 화면이 쓰는 조회와 캐시 키. 무효화 범위를 한 곳에서 읽을 수 있게 모아 둔다.
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 키 모듈을 참조하지 않는다.
 */

export interface InspectionPlanListResponse {
  items: InspectionPlan[];
  page: PageMeta;
}

/**
 * 기준의 캐시 키.
 *
 * `all`을 무효화하면 목록·상세가 함께 다시 조회된다 — 승인·사용 중지 응답에는 `ETag`가 없어서
 * 성공 후 재조회로 잠금 토큰을 확보해야 한다.
 */
export const planKeys = {
  all: ['inspection-plans'] as const,
  list: (filters: PlanFilters, page: number) =>
    ['inspection-plans', 'list', filters, page] as const,
  detail: (inspectionPlanId: number) => ['inspection-plans', 'detail', inspectionPlanId] as const,
};

/**
 * 기준 목록. 조건은 서버로 보낸다 — 클라이언트에서 거르면 서버가 자른 뒤의 결과만 걸러진다.
 * 쿼리 구성 규칙(빈 값·꺼진 확인칸·첫 쪽을 싣지 않는다)은 `filters.ts`가 갖는다.
 */
export const useInspectionPlanList = (
  filters: PlanFilters,
  page: number,
): UseQueryResult<InspectionPlanListResponse> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: planKeys.list(filters, page),
    queryFn: () =>
      runRequest(() =>
        client.GET('/quality/inspection-plans', { params: { query: toListQuery(filters, page) } }),
      ),
  });
};

/** 받은 건수가 전체보다 적으면 목록이 잘린 것이다. 선택 목록의 잘림 판정에 쓴다. */
export const isTruncated = (page: PageMeta, shown: number): boolean => page.total > shown;

/** 선택 목록 조회의 공통 결과 형태. 잘림·실패를 감추지 않고 화면이 안내할 수 있게 함께 낸다. */
export interface LookupResult {
  entries: LookupEntry[];
  /** 목록이 잘렸으면 참. 고를 수 없는 값이 생겼다는 뜻이다. */
  truncated: boolean;
  /** 실패했으면 참. 실패를 삼키면 선택칸이 이유 없이 비어 보인다. */
  isError: boolean;
  isLoading: boolean;
}
