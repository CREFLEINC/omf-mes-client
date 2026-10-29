import type { components } from '@omf-mes/api-client';
import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { useApiClient } from '../../patterns/api-context';
import { runRequest } from '../../patterns/request';
import { CODE_GROUPS } from './code-options';
import type { Location, LookupEntry, LookupSources, WarehouseFilters } from './types';

type PageMeta = components['schemas']['PageMeta'];
type Warehouse = components['schemas']['Warehouse'];
type WarehouseDetailResponse = components['schemas']['WarehouseDetailResponse'];
/* 위치는 서버가 만든 위치의 역할 · 별칭(계약 밖)까지 읽는다 — `./types` 의 `Location`. */
type LocationDetailResponse = Omit<components['schemas']['LocationDetailResponse'], 'location'> & {
  location: Location;
};

export interface WarehouseListResponse {
  items: Warehouse[];
  page: PageMeta;
}

export interface LocationListResponse {
  items: Location[];
  page: PageMeta;
}

/**
 * 이 화면이 쓰는 캐시 키. 무효화 범위를 한 곳에서 읽을 수 있게 모아 둔다.
 * all을 무효화하면 목록과 상세가 함께 다시 조회된다.
 */
export const warehouseKeys = {
  all: ['warehouses'] as const,
  list: (filters: WarehouseFilters) => ['warehouses', 'list', filters] as const,
  detail: (warehouseId: number) => ['warehouses', 'detail', warehouseId] as const,
};

/** ETag가 보관된 경로. 쓰기의 If-Match는 언제나 이 경로에서 꺼낸다(사용 중지도 마찬가지다). */
export const warehouseDetailPath = (warehouseId: number): string =>
  `/mdm/warehouses/${String(warehouseId)}`;

/**
 * 주소에서 온 공장 조건을 숫자로 읽는다. **읽을 수 없으면 조건이 없는 것으로 다룬다.**
 *
 * 조회 조건을 URL이 소유하므로 손으로 고친 주소(`?plant=abc`)가 그대로 들어온다. 거르지 않으면
 * 정수가 아닌 `plantId` 가 실려 서버가 400 으로 거절하고, 사용자는 조회 실패만 본다.
 */
const plantIdQuery = (value: string): { plantId: number } | Record<string, never> => {
  if (value === '') return {};
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? { plantId: parsed } : {};
};

/**
 * 창고 목록. 조건은 서버로 보낸다 — 클라이언트에서 거르면 서버가 자른 뒤의 결과만 걸러진다.
 * size는 보내지 않고 서버 기본값을 따른다. 잘림은 page.total로 드러내 안내한다.
 *
 * 공장(`plantId`)은 서버 선행 P-109(omf-mes-server#809) 질의다 — 타입은 `WarehouseListQueryForward` 가 덧댄다.
 */
export const useWarehouseList = (
  filters: WarehouseFilters,
): UseQueryResult<WarehouseListResponse> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: warehouseKeys.list(filters),
    queryFn: () =>
      runRequest(() =>
        client.GET('/mdm/warehouses', {
          params: {
            query: {
              ...(filters.q === '' ? {} : { q: filters.q }),
              ...plantIdQuery(filters.plantId),
              ...(filters.warehouseTypeCode === ''
                ? {}
                : { warehouseTypeCode: filters.warehouseTypeCode }),
              includeInactive: filters.includeInactive,
            },
          },
        }),
      ),
  });
};

/**
 * 창고 상세. ETag와 코드 편집 가능 여부가 이 응답으로 온다 —
 * 목록 행만으로는 저장을 시작할 수 없다.
 */
export const useWarehouseDetail = (
  warehouseId: number | null,
): UseQueryResult<WarehouseDetailResponse> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: warehouseKeys.detail(warehouseId ?? 0),
    enabled: warehouseId !== null,
    queryFn: () => {
      if (warehouseId === null) {
        throw new Error('창고를 고르기 전에는 상세를 조회하지 않습니다.');
      }

      return runRequest(() =>
        client.GET('/mdm/warehouses/{warehouseId}', { params: { path: { warehouseId } } }),
      );
    },
  });
};

export const locationKeys = {
  all: ['locations'] as const,
  list: (warehouseId: number, q: string) => ['locations', 'list', warehouseId, q] as const,
  detail: (locationId: number) => ['locations', 'detail', locationId] as const,
};

/** ETag가 보관된 경로. Location 수정의 If-Match는 여기서 꺼낸다. */
export const locationDetailPath = (locationId: number): string =>
  `/mdm/locations/${String(locationId)}`;

/** Location 목록. 계약이 warehouseId를 필수로 두므로 창고를 고르기 전에는 조회하지 않는다. */
export const useLocationList = (
  warehouseId: number | null,
  q: string,
): UseQueryResult<LocationListResponse> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: locationKeys.list(warehouseId ?? 0, q),
    enabled: warehouseId !== null,
    queryFn: async () => {
      if (warehouseId === null) {
        throw new Error('창고를 고르기 전에는 Location을 조회하지 않습니다.');
      }

      const pageSize = 200;
      const items: Location[] = [];
      let pageNumber = 1;
      let total = 0;
      let totalPages = 1;

      /*
       * 계층 편집은 부모와 자식이 모두 있어야 정확하다. 첫 페이지만 그린 뒤 경고하는 방식은
       * 201번째 노드를 영원히 관리할 수 없게 하므로, 검색 결과의 모든 페이지를 모은다.
       */
      do {
        const page = await runRequest(() =>
          client.GET('/mdm/locations', {
            params: {
              query: {
                warehouseId,
                ...(q === '' ? {} : { q }),
                includeInactive: true,
                page: pageNumber,
                size: pageSize,
              },
            },
          }),
        );
        items.push(...page.items);
        total = page.page.total;
        totalPages = Math.max(1, Math.ceil(total / Math.max(1, page.page.size)));

        if (page.items.length === 0) break;
        pageNumber += 1;
      } while (pageNumber <= totalPages);

      return {
        items,
        page: { page: 1, size: items.length, total },
      };
    },
  });
};

/**
 * Location 상세. 화면은 목록만 조회하므로 잠금 토큰과 코드 편집 가능 여부가 없다 —
 * 편집 다이얼로그를 열 때 이것을 실행해 둘을 확보한다. 초기값은 목록 행에서 온다.
 */
export const useLocationDetail = (
  locationId: number | null,
): UseQueryResult<LocationDetailResponse> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: locationKeys.detail(locationId ?? 0),
    enabled: locationId !== null,
    /* 편집 중 백그라운드 갱신으로 폼과 ETag 기준시점이 갈리지 않게 한다. 충돌 때 명시적으로 갱신한다. */
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    queryFn: () => {
      if (locationId === null) {
        throw new Error('편집할 Location을 고르기 전에는 상세를 조회하지 않습니다.');
      }

      return runRequest(() =>
        client.GET('/mdm/locations/{locationId}', { params: { path: { locationId } } }),
      );
    },
  });
};

/** 받은 건수가 전체보다 적으면 목록이 잘린 것이다. */
export const isTruncated = (page: PageMeta, shown: number): boolean => page.total > shown;

const isListTruncated = (data: { items: unknown[]; page: PageMeta } | undefined): boolean =>
  data !== undefined && isTruncated(data.page, data.items.length);

export const lookupKeys = {
  all: ['lookups'] as const,
  list: (resource: string) => ['lookups', resource] as const,
};

export interface LookupResult {
  sources: LookupSources;
  /** 어느 선택 목록이라도 잘렸으면 참. 고를 수 없는 값이 생겼다는 뜻이다. */
  truncated: boolean;
  /** 어느 선택 목록이라도 실패했으면 참. 실패를 삼키면 선택칸이 이유 없이 비어 보인다. */
  isError: boolean;
  isLoading: boolean;
}

const EMPTY_ENTRIES: LookupEntry[] = [];

/**
 * 선택 목록 4종. includeInactive=true로 한 번 받아 두고 화면이 표시 규칙을 정한다 —
 * 기본 조회는 사용 중인 것만 내려주므로, 미사용 값을 참조하는 창고를 열면 선택칸이 비어 보인다.
 */
export const useLookupOptions = (): LookupResult => {
  const { client } = useApiClient();

  const plants = useQuery({
    queryKey: lookupKeys.list('plants'),
    queryFn: () =>
      runRequest(() => client.GET('/mdm/plants', { params: { query: { includeInactive: true } } })),
  });

  const businessUnits = useQuery({
    queryKey: lookupKeys.list('business-units'),
    queryFn: () =>
      runRequest(() =>
        client.GET('/mdm/business-units', { params: { query: { includeInactive: true } } }),
      ),
  });

  /*
   * 위치 칸에서 수용 단위가 빠져(사용자 지시 2026-10-29) 이 화면은 단위를 쓰지 않는다. 단위 공유 캐시 시험(#1240)이
   * 이 훅으로 창고 화면을 거치므로 그 시험을 고칠 때 함께 걷는다.
   */
  const uoms = useQuery({
    queryKey: lookupKeys.list('uoms'),
    queryFn: () =>
      runRequest(() => client.GET('/mdm/uoms', { params: { query: { includeInactive: true } } })),
  });

  const useCodeGroup = (codeGroupCode: string) =>
    useQuery({
      queryKey: lookupKeys.list(`code-values:${codeGroupCode}`),
      queryFn: () =>
        runRequest(() =>
          client.GET('/mdm/code-values', {
            params: { query: { codeGroupCode, includeInactive: true, page: 1, size: 200 } },
          }),
        ),
    });

  const warehouseTypes = useCodeGroup(CODE_GROUPS.warehouseType);
  const reissueReasons = useCodeGroup(CODE_GROUPS.reissueReason);

  const codeSource = (query: typeof warehouseTypes) => ({
    entries:
      query.data?.items.map((item) => ({
        value: item.code,
        label: item.codeName.trim() === '' ? item.code : item.codeName,
        isActive: item.isActive,
      })) ?? EMPTY_ENTRIES,
    isError: query.isError,
    isLoading: query.isPending,
  });

  return {
    sources: {
      plants: {
        entries:
          plants.data?.items.map((item) => ({
            value: String(item.plantId),
            label: item.plantName,
            isActive: item.isActive,
          })) ?? EMPTY_ENTRIES,
        isError: plants.isError,
        isLoading: plants.isPending,
      },
      businessUnits: {
        entries:
          businessUnits.data?.items.map((item) => ({
            value: String(item.businessUnitId),
            label: item.businessUnitName,
            isActive: item.isActive,
          })) ?? EMPTY_ENTRIES,
        isError: businessUnits.isError,
        isLoading: businessUnits.isPending,
      },
      uoms: {
        entries:
          uoms.data?.items.map((item) => ({
            value: String(item.uomId),
            label: item.uomCode,
            isActive: item.isActive,
          })) ?? EMPTY_ENTRIES,
        isError: uoms.isError,
        isLoading: uoms.isPending,
      },
      warehouseTypes: codeSource(warehouseTypes),
      reissueReasons: codeSource(reissueReasons),
    },
    truncated:
      isListTruncated(plants.data) ||
      isListTruncated(businessUnits.data) ||
      isListTruncated(uoms.data) ||
      isListTruncated(warehouseTypes.data) ||
      isListTruncated(reissueReasons.data),
    isError:
      plants.isError ||
      businessUnits.isError ||
      uoms.isError ||
      warehouseTypes.isError ||
      reissueReasons.isError,
    isLoading:
      plants.isPending ||
      businessUnits.isPending ||
      uoms.isPending ||
      warehouseTypes.isPending ||
      reissueReasons.isPending,
  };
};

type DocumentIssue = components['schemas']['DocumentIssue'];

/** 위치 라벨 발행 기록의 캐시 키 — 발행 · 재발행 뒤 이것만 다시 받는다. */
export const locationLabelKeys = {
  of: (locationId: number) => ['location-labels', locationId] as const,
};

/**
 * 위치 하나의 라벨 발행 기록 중 마지막 회차. 없으면 null — 아직 발행하지 않은 위치다.
 * 한 위치의 회차는 많아야 몇 장이라 한 쪽(50건)만 받는다.
 */
export const useLatestLocationLabel = (
  locationId: number,
): UseQueryResult<DocumentIssue | null> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: locationLabelKeys.of(locationId),
    queryFn: async () => {
      const result = await runRequest(() =>
        client.GET('/app/document-issues', {
          params: {
            query: {
              documentTypeCode: 'LOCATION_LABEL',
              targetTypeCode: 'LOCATION',
              targetId: locationId,
              page: 1,
              size: 50,
            },
          },
        }),
      );
      return result.items.reduce<DocumentIssue | null>(
        (latest, issue) => (latest === null || issue.issueSeq > latest.issueSeq ? issue : latest),
        null,
      );
    },
  });
};
