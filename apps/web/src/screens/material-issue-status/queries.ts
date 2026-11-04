import type {
  ApiError,
  components,
  MaterialIssueRequestCancelForward,
  MaterialIssueRequestDetailForward,
  MaterialIssueRequestForward,
  MaterialIssueRequestHistoryEntry,
  MaterialIssueRequestUpdateForward,
  PlannedStockResponse,
} from '@omf-mes/api-client';
import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { useApiClient } from '../../patterns/api-context';
import { fetchAllPages } from '../../patterns/fetch-all-pages';
import { useMasterWrite, type MasterWriteResult } from '../../patterns/master';
import { runRequest } from '../../patterns/request';
import { toListQuery, type StatusFilters } from './filters';

type Plant = components['schemas']['Plant'];
type PageMeta = components['schemas']['PageMeta'];

export const PAGE_SIZE = 50;

/** 이 화면이 소유하는 캐시 키. 쓰기가 성공하면 `all` 을 무효화해 목록 · 상세 · 부족을 함께 다시 받는다. */
export const statusKeys = {
  all: ['material-issue-status'] as const,
  plants: ['material-issue-status', 'plants'] as const,
  list: (filters: StatusFilters, page: number) =>
    ['material-issue-status', 'list', filters, page] as const,
  detail: (id: number) => ['material-issue-status', 'detail', id] as const,
  history: (id: number) => ['material-issue-status', 'history', id] as const,
  shortage: (plantId: number) => ['material-issue-status', 'shortage', plantId] as const,
  warehouses: (plantId: number) => ['material-issue-status', 'warehouses', plantId] as const,
  locations: (locationId: number) => ['material-issue-status', 'locations', locationId] as const,
};

export const usePlants = (): UseQueryResult<Plant[]> => {
  const { client } = useApiClient();
  return useQuery({
    queryKey: statusKeys.plants,
    queryFn: async () =>
      (
        await fetchAllPages((page, size) =>
          runRequest(() => client.GET('/mdm/plants', { params: { query: { page, size } } })),
        )
      ).items,
    select: (plants) =>
      plants
        .filter((plant) => plant.isActive)
        .sort((left, right) => left.plantCode.localeCompare(right.plantCode)),
  });
};

export const useRequestList = (
  filters: StatusFilters,
  page: number,
  enabled: boolean,
): UseQueryResult<{ items: MaterialIssueRequestForward[]; page: PageMeta }> => {
  const { client } = useApiClient();
  return useQuery({
    queryKey: statusKeys.list(filters, page),
    enabled,
    queryFn: () =>
      runRequest(() =>
        client.GET('/logistics/material-issue-requests', {
          params: { query: toListQuery(filters, page, PAGE_SIZE) },
        }),
      ),
  });
};

export const useRequestDetail = (
  id: number | null,
): UseQueryResult<MaterialIssueRequestDetailForward> => {
  const { client } = useApiClient();
  return useQuery({
    queryKey: statusKeys.detail(id ?? 0),
    enabled: id !== null,
    queryFn: () =>
      runRequest(() =>
        client.GET('/logistics/material-issue-requests/{materialIssueRequestId}', {
          params: { path: { materialIssueRequestId: id ?? 0 } },
        }),
      ),
  });
};

export const useRequestHistory = (
  id: number | null,
): UseQueryResult<MaterialIssueRequestHistoryEntry[]> => {
  const { client } = useApiClient();
  return useQuery({
    queryKey: statusKeys.history(id ?? 0),
    enabled: id !== null,
    queryFn: async () =>
      (
        await runRequest(() =>
          client.GET('/logistics/material-issue-requests/{materialIssueRequestId}/history', {
            params: { path: { materialIssueRequestId: id ?? 0 } },
          }),
        )
      ).items,
  });
};

/** 부족 보기 — 부족 행만(`onlyShortage=true`)과 「재고 있는 생산 창고 없음」 묶음. */
export const usePlannedShortage = (
  plantId: number | null,
): UseQueryResult<PlannedStockResponse> => {
  const { client } = useApiClient();
  return useQuery({
    queryKey: statusKeys.shortage(plantId ?? 0),
    enabled: plantId !== null,
    queryFn: () =>
      runRequest(() =>
        client.GET('/logistics/material-issue-requests/planned-stock', {
          params: { query: { plantId: plantId ?? 0, onlyShortage: true } },
        }),
      ),
  });
};

export interface Option {
  value: string;
  label: string;
}

/** 출발 생산 창고로 고를 수 있는 창고 — 그 공장의 사용 중인 창고(서버가 부서 연결을 다시 본다). */
export const useWarehouseOptions = (plantId: number | null): UseQueryResult<Option[]> => {
  const { client } = useApiClient();
  return useQuery({
    queryKey: statusKeys.warehouses(plantId ?? 0),
    enabled: plantId !== null,
    queryFn: async () =>
      (
        await fetchAllPages((page, size) =>
          runRequest(() =>
            client.GET('/mdm/warehouses', {
              params: { query: { plantId: plantId ?? 0, includeInactive: false, page, size } },
            }),
          ),
        )
      ).items
        .filter((warehouse) => warehouse.plantId === plantId && warehouse.isActive)
        .map((warehouse) => ({
          value: String(warehouse.warehouseId),
          label: `${warehouse.warehouseCode} ${warehouse.warehouseName}`,
        })),
  });
};

/** 입고지로 고를 수 있는 위치 — 지금 입고지와 같은 창고의 위치. */
export const useDestinationOptions = (locationId: number | null): UseQueryResult<Option[]> => {
  const { client } = useApiClient();
  return useQuery({
    queryKey: statusKeys.locations(locationId ?? 0),
    enabled: locationId !== null,
    queryFn: async () => {
      const { location } = await runRequest(() =>
        client.GET('/mdm/locations/{locationId}', {
          params: { path: { locationId: locationId ?? 0 } },
        }),
      );
      const list = await runRequest(() =>
        client.GET('/mdm/locations', {
          params: { query: { warehouseId: location.warehouseId, includeInactive: false } },
        }),
      );
      return list.items.map((item) => ({
        value: String(item.locationId),
        label: `${item.locationCode} ${item.locationName}`,
      }));
    },
  });
};

/** 수정(PUT, 본문 `versionNo`). 진행 있음이면 `lines` 만 싣는다 — 화면이 고르는 칸을 정한다. */
export const useUpdateRequest = (
  id: number | null,
  onSuccess: (saved: MaterialIssueRequestDetailForward) => void,
): MasterWriteResult<MaterialIssueRequestUpdateForward> => {
  const { client } = useApiClient();
  return useMasterWrite({
    request: (body, headers) =>
      client.PUT('/logistics/material-issue-requests/{materialIssueRequestId}', {
        params: {
          path: { materialIssueRequestId: id ?? 0 },
          header: { 'Idempotency-Key': headers['Idempotency-Key'] },
        },
        body,
      }),
    etagPath: null,
    invalidateKeys: [statusKeys.all],
    knownFields: [],
    onSuccess,
  });
};

export const useCancelRequest = (
  id: number | null,
  onSuccess: (saved: MaterialIssueRequestDetailForward) => void,
): MasterWriteResult<MaterialIssueRequestCancelForward> => {
  const { client } = useApiClient();
  return useMasterWrite({
    request: (body, headers) =>
      client.POST('/logistics/material-issue-requests/{materialIssueRequestId}:cancel', {
        params: {
          path: { materialIssueRequestId: id ?? 0 },
          header: { 'Idempotency-Key': headers['Idempotency-Key'] },
        },
        body,
      }),
    etagPath: null,
    invalidateKeys: [statusKeys.all],
    knownFields: [],
    onSuccess,
  });
};

/** 출고 요청 사유 코드 → 이름 — 이력 「예정분을 가져감」의 사유를 이름으로 보인다. */
export const useReasonNames = (): UseQueryResult<Map<string, string>> => {
  const { client } = useApiClient();
  return useQuery({
    queryKey: ['material-issue-status', 'reasons'] as const,
    queryFn: async () =>
      new Map(
        (
          await runRequest(() =>
            client.GET('/mdm/code-values', {
              params: {
                query: {
                  codeGroupCode: 'MATERIAL_ISSUE_REQUEST_REASON',
                  includeInactive: true,
                  size: 100,
                },
              },
            }),
          )
        ).items.map((item) => [item.code, item.codeName]),
      ),
  });
};

/** 오류 응답에 이 업무 코드가 있는가 — 422 `HOLIDAY_ACK_REQUIRED` · 409 `STATE_LOCKED` 등. */
export const hasErrorCode = (error: ApiError | null, code: string): boolean => {
  if (error === null) return false;
  switch (error.kind) {
    case 'validation':
    case 'stateLocked':
      return error.errors.some((item) => item.code === code);
    case 'conflict':
    case 'http':
      return error.code === code;
    default:
      return false;
  }
};
