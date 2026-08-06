import type { components } from '@omf-mes/api-client';
import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { useApiClient } from '../../patterns/api-context';
import { runRequest } from '../../patterns/request';
import type { LookupEntries, LookupEntry, WarehouseFilters } from './types';

type PageMeta = components['schemas']['PageMeta'];
type Warehouse = components['schemas']['Warehouse'];
type WarehouseDetailResponse = components['schemas']['WarehouseDetailResponse'];
type Location = components['schemas']['Location'];
type LocationDetailResponse = components['schemas']['LocationDetailResponse'];

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
 * 창고 목록. 조건은 서버로 보낸다 — 클라이언트에서 거르면 서버가 자른 뒤의 결과만 걸러진다.
 * size는 보내지 않고 서버 기본값을 따른다. 잘림은 page.total로 드러내 안내한다.
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
  list: (warehouseId: number) => ['locations', 'list', warehouseId] as const,
  detail: (locationId: number) => ['locations', 'detail', locationId] as const,
};

/** ETag가 보관된 경로. Location 수정의 If-Match는 여기서 꺼낸다. */
export const locationDetailPath = (locationId: number): string =>
  `/mdm/locations/${String(locationId)}`;

/** Location 목록. 계약이 warehouseId를 필수로 두므로 창고를 고르기 전에는 조회하지 않는다. */
export const useLocationList = (
  warehouseId: number | null,
): UseQueryResult<LocationListResponse> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: locationKeys.list(warehouseId ?? 0),
    enabled: warehouseId !== null,
    queryFn: () => {
      if (warehouseId === null) {
        throw new Error('창고를 고르기 전에는 Location을 조회하지 않습니다.');
      }

      return runRequest(() => client.GET('/mdm/locations', { params: { query: { warehouseId } } }));
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
  entries: LookupEntries;
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

  const partners = useQuery({
    queryKey: lookupKeys.list('partners'),
    queryFn: () =>
      runRequest(() =>
        client.GET('/mdm/partners', { params: { query: { includeInactive: true } } }),
      ),
  });

  const uoms = useQuery({
    queryKey: lookupKeys.list('uoms'),
    queryFn: () =>
      runRequest(() => client.GET('/mdm/uoms', { params: { query: { includeInactive: true } } })),
  });

  return {
    entries: {
      plants:
        plants.data?.items.map((item) => ({
          value: String(item.plantId),
          label: item.plantName,
          isActive: item.isActive,
        })) ?? EMPTY_ENTRIES,
      businessUnits:
        businessUnits.data?.items.map((item) => ({
          value: String(item.businessUnitId),
          label: item.businessUnitName,
          isActive: item.isActive,
        })) ?? EMPTY_ENTRIES,
      partners:
        partners.data?.items.map((item) => ({
          value: String(item.partnerId),
          label: item.partnerName,
          isActive: item.isActive,
        })) ?? EMPTY_ENTRIES,
      uoms:
        uoms.data?.items.map((item) => ({
          value: String(item.uomId),
          label: item.uomCode,
          isActive: item.isActive,
        })) ?? EMPTY_ENTRIES,
    },
    truncated:
      isListTruncated(plants.data) ||
      isListTruncated(businessUnits.data) ||
      isListTruncated(partners.data) ||
      isListTruncated(uoms.data),
    isError: plants.isError || businessUnits.isError || partners.isError || uoms.isError,
    isLoading: plants.isPending || businessUnits.isPending || partners.isPending || uoms.isPending,
  };
};
