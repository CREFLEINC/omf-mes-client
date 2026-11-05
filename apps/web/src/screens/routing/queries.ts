import type { components } from '@omf-mes/api-client';
import { useQueries, useQuery, type UseQueryResult } from '@tanstack/react-query';

import { useApiClient } from '../../patterns/api-context';
import { masterName } from '../../patterns/master-name';
import { runRequest } from '../../patterns/request';
import type { RoutingAuditEvent } from './revision-history';
import type {
  ItemFilters,
  LookupEntry,
  Process,
  ProcessDetailResponse,
  ProcessFilters,
  LatestRoutingStatus,
} from './types';

type PageMeta = components['schemas']['PageMeta'];
type Item = components['schemas']['Item'];
type Routing = components['schemas']['Routing'];
type RoutingDetailResponse = components['schemas']['RoutingDetailResponse'];
type RoutingOperation = components['schemas']['RoutingOperation'];

export interface ItemListResponse {
  items: Item[];
  page: PageMeta;
}

/** Rev 목록에는 페이지네이션이 없다 — 품목당 판 수가 소수라 계약이 두지 않았다. */
export interface RoutingListResponse {
  items: Routing[];
}

/**
 * 이 화면이 쓰는 캐시 키. 무효화 범위를 한 곳에서 읽을 수 있게 모아 둔다.
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 키 모듈을 참조하지 않는다.
 */
export const itemKeys = {
  all: ['routing-items'] as const,
  list: (filters: ItemFilters, paging: ListPaging) =>
    ['routing-items', 'list', filters, paging] as const,
};

/** 목록 쪽 — 주소(`page` · `size`)가 소유한다. 쪽 이동 줄(PageNav)이 바꾼다(#231). */
export interface ListPaging {
  page: number;
  size: number;
}

/**
 * 품목 목록. 조건은 서버로 보낸다 — 클라이언트에서 거르면 서버가 자른 뒤의 결과만 걸러진다.
 *
 * `hasRouting`은 **켜졌을 때만** 싣는다. `true`를 보내면 「Routing을 보유한 품목만」이 되어
 * 확인칸의 뜻(미보유만)과 정반대의 결과가 나온다.
 */
export const useItemList = (
  filters: ItemFilters,
  paging: ListPaging,
): UseQueryResult<ItemListResponse> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: itemKeys.list(filters, paging),
    queryFn: () =>
      runRequest(() =>
        client.GET('/mdm/items', {
          params: {
            query: {
              ...(filters.q === '' ? {} : { q: filters.q }),
              ...itemStatusQuery(filters),
              page: paging.page,
              size: paging.size,
            },
          },
        }),
      ),
  });
};

/** 진행 상태 조건 → 서버 조건. 미등록은 `hasRouting=false`, 나머지는 `latestRoutingStatus`(#231). */
const itemStatusQuery = (
  filters: Pick<ItemFilters, 'onlyWithoutRouting' | 'latestStatus'>,
): { hasRouting?: false; latestRoutingStatus?: LatestRoutingStatus } => {
  if (filters.onlyWithoutRouting) return { hasRouting: false };
  return filters.latestStatus === '' ? {} : { latestRoutingStatus: filters.latestStatus };
};

/** 진행 상태 칩 하나 — 미등록(NONE)은 `onlyWithoutRouting` 으로 간다. */
export type ItemStatusChip = '' | LatestRoutingStatus | 'NONE';

export const toStatusFilters = (
  chip: ItemStatusChip,
): Pick<ItemFilters, 'onlyWithoutRouting' | 'latestStatus'> =>
  chip === 'NONE'
    ? { onlyWithoutRouting: true, latestStatus: '' }
    : { onlyWithoutRouting: false, latestStatus: chip };

/**
 * 진행 상태 칩의 건수(#231) — 지금 검색어로, 칩마다 한 줄만 받아 쪽 정보의 전체 건수를 쓴다(검사 조회·판정 판정 칩과 같은 방식).
 */
export const useItemStatusCounts = (
  q: string,
  chips: readonly ItemStatusChip[],
): (number | undefined)[] => {
  const { client } = useApiClient();
  const results = useQueries({
    queries: chips.map((chip) => ({
      queryKey: ['routing-items', 'status-count', q, chip] as const,
      queryFn: () =>
        runRequest(() =>
          client.GET('/mdm/items', {
            params: {
              query: {
                ...(q === '' ? {} : { q }),
                ...itemStatusQuery(toStatusFilters(chip)),
                page: 1,
                size: 1,
              },
            },
          }),
        ).then((list) => list.page.total),
    })),
  });
  return results.map((result) => result.data);
};

/** 받은 건수가 전체보다 적으면 목록이 잘린 것이다. 이 화면이 갖는다 — 짧아도 공유하지 않는다. */
export const isTruncated = (page: PageMeta, shown: number): boolean => page.total > shown;

/**
 * Routing(Rev)의 캐시 키. all을 무효화하면 목록·상세·라인이 함께 다시 조회된다 —
 * 상태 전이와 첫 등록 응답에는 ETag가 없어서, 성공 후 재조회로 잠금 토큰을 확보해야 한다.
 */
export const routingKeys = {
  all: ['routings'] as const,
  list: (itemId: number) => ['routings', 'list', itemId] as const,
  detail: (routingId: number) => ['routings', 'detail', routingId] as const,
  operations: (routingId: number) => ['routings', 'operations', routingId] as const,
  dependencies: (routingId: number) => ['routings', 'dependencies', routingId] as const,
};

/**
 * ETag가 보관된 경로. 쓰기의 If-Match는 **언제나 이 경로**에서 꺼낸다.
 * 보관 키가 요청 경로라 `...:confirm` 같은 액션 경로로 꺼내면 항상 비어 있다.
 */
export const routingDetailPath = (routingId: number): string =>
  `/planning/routings/${String(routingId)}`;

/** Rev 목록. 계약이 itemId를 필수로 두므로 품목을 고르기 전에는 조회하지 않는다. */
export const useRoutingList = (itemId: number | null): UseQueryResult<RoutingListResponse> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: routingKeys.list(itemId ?? 0),
    enabled: itemId !== null,
    queryFn: () => {
      if (itemId === null) {
        throw new Error('품목을 고르기 전에는 Rev 목록을 조회하지 않습니다.');
      }

      return runRequest(() => client.GET('/planning/routings', { params: { query: { itemId } } }));
    },
  });
};

/**
 * 품목 목록 한 쪽의 기본 Rev — 품목 목록 응답에 Rev 정보가 없어 품목마다 Rev 목록을 받는다(사용자 결정 · #231).
 * 쪽에 보이는 품목 수(10 · 20 · 50)만큼 요청이 나간다. Rev 목록과 같은 열쇠라 받은 것은 Rev 칸과 나눠 쓴다.
 * 반환: 품목 번호 → 기본 Rev(없으면 null). 아직 받지 못한 품목은 지도에 없다.
 */
/** 품목 목록 열에 쓰는 품목별 개정 요약(#231). */
export interface ItemRevisionSummary {
  /** 기본 Rev. 지정이 없으면 null. */
  defaultRevision: Routing | null;
  /** 가장 최근 Rev(번호가 가장 큰 것). 없으면 null. */
  latestRevision: Routing | null;
  /** 발행한 Rev 수(폐기 포함). */
  revisionCount: number;
}

export const useItemRevisionSummaries = (
  itemIds: readonly number[],
): ReadonlyMap<number, ItemRevisionSummary> => {
  const { client } = useApiClient();

  const results = useQueries({
    queries: itemIds.map((itemId) => ({
      queryKey: routingKeys.list(itemId),
      queryFn: () =>
        runRequest(() => client.GET('/planning/routings', { params: { query: { itemId } } })),
    })),
  });

  const byItem = new Map<number, ItemRevisionSummary>();
  results.forEach((result, index) => {
    const itemId = itemIds[index];
    if (itemId === undefined || result.data === undefined) return;
    const rows = result.data.items;
    /* 상태 열은 가장 최근 Rev 와 그 상태를 낸다(사용자 지시 · #231). */
    const latestRevision = rows.reduce<Routing | null>(
      (latest, row) =>
        latest === null || row.routingVersion > latest.routingVersion ? row : latest,
      null,
    );
    byItem.set(itemId, {
      defaultRevision: rows.find((row) => row.isDefault === true) ?? null,
      latestRevision,
      revisionCount: rows.length,
    });
  });
  return byItem;
};

/**
 * Routing 헤더 상세. 낙관적 잠금 토큰(ETag)과 코드 편집 가능 여부가 이 응답으로 온다 —
 * 목록 행만으로는 저장을 시작할 수 없다.
 */
export const useRoutingDetail = (
  routingId: number | null,
): UseQueryResult<RoutingDetailResponse> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: routingKeys.detail(routingId ?? 0),
    enabled: routingId !== null,
    queryFn: () => {
      if (routingId === null) {
        throw new Error('Rev를 고르기 전에는 상세를 조회하지 않습니다.');
      }

      return runRequest(() =>
        client.GET('/planning/routings/{routingId}', { params: { path: { routingId } } }),
      );
    },
  });
};

/** 공정 라인 목록에도 페이지네이션이 없다 — Rev당 라인 수가 소수라 계약이 두지 않았다. */
export interface RoutingOperationListResponse {
  items: RoutingOperation[];
}

/**
 * 공정 라인 목록. Rev를 고르기 전에는 조회하지 않는다.
 *
 * 응답의 순서 값은 서버 채번이며 화면은 그것을 표시하지 않는다 — 표시 번호는 목록 안의 위치다.
 */
export const useRoutingOperations = (
  routingId: number | null,
): UseQueryResult<RoutingOperationListResponse> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: routingKeys.operations(routingId ?? 0),
    enabled: routingId !== null,
    queryFn: () => {
      if (routingId === null) {
        throw new Error('Rev를 고르기 전에는 공정 라인을 조회하지 않습니다.');
      }

      return runRequest(() =>
        client.GET('/planning/routings/{routingId}/operations', {
          params: { path: { routingId } },
        }),
      );
    },
  });
};

type RoutingOperationDependencyListResponse =
  components['schemas']['RoutingOperationDependencyListResponse'];

/** 공정 선후행. 라인과 따로 저장되는 관계라 라인 목록과 별개로 받는다. */
export const useOperationDependencies = (
  routingId: number | null,
): UseQueryResult<RoutingOperationDependencyListResponse> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: routingKeys.dependencies(routingId ?? 0),
    enabled: routingId !== null,
    queryFn: () => {
      if (routingId === null) {
        throw new Error('Rev를 고르기 전에는 선후행을 조회하지 않습니다.');
      }

      return runRequest(() =>
        client.GET('/planning/routings/{routingId}/operation-dependencies', {
          params: { path: { routingId } },
        }),
      );
    },
  });
};

export interface DependencyTypeOption {
  code: string;
  codeName: string;
}

/** 선후행 유형은 시스템 소유 공통코드다 — 이름은 서버 값(지금 언어 이름, 없으면 기본 이름)을 쓴다. */
export const useDependencyTypeOptions = (): UseQueryResult<DependencyTypeOption[]> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: ['routing-dependency-types'] as const,
    queryFn: async () => {
      const data = await runRequest(() =>
        client.GET('/mdm/code-values', {
          params: { query: { codeGroupCode: 'ROUTING_OPERATION_DEPENDENCY_TYPE' } },
        }),
      );

      return data.items
        .filter((item) => item.isActive)
        .sort((left, right) => left.displayOrder - right.displayOrder)
        .map((item) => ({ code: item.code, codeName: masterName(item, item.codeName) }));
    },
  });
};

export const processKeys = {
  all: ['routing-processes'] as const,
  list: (filters: ProcessFilters, paging: ListPaging) =>
    ['routing-processes', 'list', filters, paging] as const,
  detail: (processId: number) => ['routing-processes', 'detail', processId] as const,
  options: ['routing-processes', 'options'] as const,
  types: ['routing-processes', 'types'] as const,
};

export const processDetailPath = (processId: number): string =>
  `/mdm/processes/${String(processId)}`;

export interface ProcessListResponse {
  items: Process[];
  page: PageMeta;
}

export const useProcessList = (
  filters: ProcessFilters,
  paging: ListPaging,
): UseQueryResult<ProcessListResponse> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: processKeys.list(filters, paging),
    queryFn: () =>
      runRequest(() =>
        client.GET('/mdm/processes', {
          params: {
            query: {
              ...(filters.q === '' ? {} : { q: filters.q }),
              ...(filters.includeInactive ? { includeInactive: true } : {}),
              page: paging.page,
              size: paging.size,
            },
          },
        }),
      ),
  });
};

export const useProcessDetail = (
  processId: number | null,
): UseQueryResult<ProcessDetailResponse> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: processKeys.detail(processId ?? 0),
    enabled: processId !== null,
    queryFn: () => {
      if (processId === null) throw new Error('공정을 고르기 전에는 상세를 조회하지 않습니다.');

      return runRequest(() =>
        client.GET('/mdm/processes/{processId}', { params: { path: { processId } } }),
      );
    },
  });
};

export interface ProcessTypeOption {
  value: string;
  label: string;
}

export const useProcessTypeOptions = (): UseQueryResult<ProcessTypeOption[]> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: processKeys.types,
    queryFn: async () => {
      const data = await runRequest(() =>
        client.GET('/mdm/code-values', {
          params: { query: { codeGroupCode: 'PROCESS_TYPE' } },
        }),
      );

      return data.items
        .filter((item) => item.isActive)
        .sort((left, right) => left.displayOrder - right.displayOrder)
        .map((item) => ({ value: item.code, label: item.codeName }));
    },
  });
};

export interface ProcessLookupResult {
  entries: LookupEntry[];
  /** 목록이 잘렸으면 참. 고를 수 없는 값이 생겼다는 뜻이다. */
  truncated: boolean;
  /** 실패했으면 참. 실패를 삼키면 선택칸이 이유 없이 비어 보인다. */
  isError: boolean;
  isLoading: boolean;
}

const EMPTY_ENTRIES: LookupEntry[] = [];

/**
 * 공정 선택 목록. `includeInactive=true`로 한 번 받아 두고 화면이 표시 규칙을 정한다 —
 * 기본 조회는 사용 중인 것만 내려주므로, 미사용 공정을 참조하는 라인을 열면 이름이 비어 보인다.
 */
export const useProcessOptions = (): ProcessLookupResult => {
  const { client } = useApiClient();

  const processes = useQuery({
    queryKey: processKeys.options,
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

/** 최근 1년 — 감사 이력 조회가 기간을 요구한다(파티션 · 공유계약 B-5). */
const HISTORY_RANGE_MS = 366 * 24 * 60 * 60 * 1000;

/**
 * Routing(Rev 하나)의 변경 이력(#231) — 서버가 Routing 쓰기마다 남긴 감사 이력. 열 때마다 새로 받는다.
 * 한 Rev 의 이력은 소수라 첫 쪽(100건)만 받는다.
 */
export const useRoutingHistory = (
  routingId: number | null,
): UseQueryResult<{ items: RoutingAuditEvent[] }> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: [...routingKeys.all, 'history', routingId ?? 0] as const,
    enabled: routingId !== null,
    staleTime: 0,
    queryFn: async () => {
      if (routingId === null) throw new Error('Rev를 고르기 전에는 변경 이력을 조회하지 않습니다.');
      const now = Date.now();
      const data = await runRequest(() =>
        client.GET('/audit/events', {
          params: {
            query: {
              targetTypeCode: 'ROUTING',
              targetId: routingId,
              occurredFrom: new Date(now - HISTORY_RANGE_MS).toISOString(),
              occurredTo: new Date(now + 60 * 1000).toISOString(),
              size: 100,
            },
          },
        }),
      );
      return {
        items: data.items.map((item) => ({
          auditEventId: item.auditEventId,
          occurredAt: item.occurredAt,
          eventTypeCode: item.eventTypeCode,
          beforeValue: (item.beforeValue ?? null) as Record<string, unknown> | null,
          afterValue: (item.afterValue ?? null) as Record<string, unknown> | null,
          performedBy: item.performedBy ?? null,
        })),
      };
    },
  });
};

/** 처리자 이름 — 사용자 상세로 푼다. 못 받으면(권한 · 없는 사용자) 호출부가 번호로 낸다. */
export const useUserNames = (
  userIds: readonly (number | null)[],
): ((userId: number) => string | null) => {
  const { client } = useApiClient();
  const ids = [...new Set(userIds.filter((id): id is number => id !== null))];

  const results = useQueries({
    queries: ids.map((appUserId) => ({
      queryKey: ['routing', 'user-name', appUserId] as const,
      queryFn: async () => {
        const data = await runRequest(() =>
          client.GET('/app/users/{appUserId}', { params: { path: { appUserId } } }),
        );
        return data.appUser.userName;
      },
      retry: false,
      staleTime: Infinity,
    })),
  });

  return (userId) => results[ids.indexOf(userId)]?.data ?? null;
};
