import type { components } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';
import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { useApiClient } from '../../patterns/api-context';
import { runRequest } from '../../patterns/request';
import { toListQuery } from './filters';
import type { InspectionPlan, LookupEntry, PageMeta, PlanFilters } from './types';

type InspectionPlanDetailResponse = components['schemas']['InspectionPlanDetailResponse'];

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

/**
 * ETag가 보관된 경로. 쓰기의 If-Match는 **언제나 이 경로**에서 꺼낸다.
 * 보관 키가 요청 경로라 `...:approve` 같은 액션 경로로 꺼내면 항상 비어 있다.
 */
export const planDetailPath = (inspectionPlanId: number): string =>
  `/quality/inspection-plans/${String(inspectionPlanId)}`;

/**
 * 기준 상세. 낙관적 잠금 토큰(ETag)과 코드 편집 가능 여부가 이 응답으로 온다 —
 * 목록 행만으로는 저장을 시작할 수 없다.
 */
export const useInspectionPlanDetail = (
  inspectionPlanId: number | null,
): UseQueryResult<InspectionPlanDetailResponse> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: planKeys.detail(inspectionPlanId ?? 0),
    enabled: inspectionPlanId !== null,
    queryFn: () => {
      if (inspectionPlanId === null) {
        throw new Error('기준을 고르기 전에는 상세를 조회하지 않습니다.');
      }

      return runRequest(() =>
        client.GET('/quality/inspection-plans/{inspectionPlanId}', {
          params: { path: { inspectionPlanId } },
        }),
      );
    },
  });
};

/** 선택 목록 조회의 공통 결과 형태. 잘림·실패를 감추지 않고 화면이 안내할 수 있게 함께 낸다. */
export interface LookupResult {
  entries: LookupEntry[];
  /** 목록이 잘렸으면 참. 고를 수 없는 값이 생겼다는 뜻이다. */
  truncated: boolean;
  /** 실패했으면 참. 실패를 삼키면 선택칸이 이유 없이 비어 보인다. */
  isError: boolean;
  isLoading: boolean;
}

const EMPTY_ENTRIES: LookupEntry[] = [];

export const lookupKeys = {
  items: ['inspection-standard-items'] as const,
  processes: ['inspection-standard-processes'] as const,
  routings: (itemId: number) => ['inspection-standard-routings', itemId] as const,
};

/**
 * 품목 선택 목록. `includeInactive=true`로 한 번 받아 두고 화면이 표시 규칙을 정한다 —
 * 기본 조회는 사용 중인 것만 내려주므로, 미사용 품목을 참조하는 기준을 열면 이름이 비어 보인다.
 */
export const useItemOptions = (): LookupResult => {
  const { client } = useApiClient();

  const items = useQuery({
    queryKey: lookupKeys.items,
    queryFn: () =>
      runRequest(() => client.GET('/mdm/items', { params: { query: { includeInactive: true } } })),
  });

  const data = items.data;

  return {
    entries:
      data?.items.map((item) => ({
        value: String(item.itemId),
        label: `${item.itemCode} · ${item.itemName}`,
        isActive: item.isActive,
      })) ?? EMPTY_ENTRIES,
    truncated: data !== undefined && isTruncated(data.page, data.items.length),
    isError: items.isError,
    isLoading: items.isPending,
  };
};

/** 공정 선택 목록. IQC 기준에는 공정이 없으므로 비우는 것이 정상 값이다. */
export const useProcessOptions = (): LookupResult => {
  const { client } = useApiClient();

  const processes = useQuery({
    queryKey: lookupKeys.processes,
    queryFn: () =>
      runRequest(() =>
        client.GET('/mdm/processes', { params: { query: { includeInactive: true } } }),
      ),
  });

  const data = processes.data;

  return {
    entries:
      data?.items.map((process) => ({
        value: String(process.processId),
        label: process.processName,
        isActive: process.isActive,
      })) ?? EMPTY_ENTRIES,
    truncated: data !== undefined && isTruncated(data.page, data.items.length),
    isError: processes.isError,
    isLoading: processes.isPending,
  };
};

/**
 * 라우팅 선택 목록.
 *
 * **품목을 고르기 전에는 조회하지 않는다** — 계약이 `itemId`를 필수 쿼리로 두었다.
 * 그런데 기준의 품목은 비울 수 있으므로(「전 품목 공통 기준」) 그 경우에는
 * 고를 수 있는 라우팅 자체가 없고, 화면은 선택칸을 사유와 함께 비활성으로 둔다.
 *
 * Rev 목록에는 페이지네이션이 없다(계약) — 잘림을 판정할 자리가 없으므로 늘 거짓이다.
 */
export const useRoutingOptions = (itemId: number | null): LookupResult => {
  const { client } = useApiClient();

  const routings = useQuery({
    queryKey: lookupKeys.routings(itemId ?? 0),
    enabled: itemId !== null,
    queryFn: () => {
      if (itemId === null) {
        throw new Error('품목을 고르기 전에는 라우팅을 조회하지 않습니다.');
      }

      return runRequest(() => client.GET('/planning/routings', { params: { query: { itemId } } }));
    },
  });

  return {
    entries:
      routings.data?.items.map((routing) => ({
        value: String(routing.routingId),
        label: messages.inspectionStandard.values.routingOption(
          routing.routingCode,
          routing.routingVersion,
        ),
        // 라우팅에는 사용 여부가 없다(상태는 작성중·확정·폐기다) — 전부 고를 수 있는 값으로 둔다.
        isActive: true,
      })) ?? EMPTY_ENTRIES,
    truncated: false,
    isError: routings.isError,
    isLoading: itemId !== null && routings.isPending,
  };
};
