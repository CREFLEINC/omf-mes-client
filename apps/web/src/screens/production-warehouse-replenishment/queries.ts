import type {
  components,
  ReplenishmentArrival,
  ReplenishmentItem,
  ReplenishmentSettings,
} from '@omf-mes/api-client';
import { useQueries, useQuery, type UseQueryResult } from '@tanstack/react-query';

import { useApiClient } from '../../patterns/api-context';
import { fetchAllPages } from '../../patterns/fetch-all-pages';
import { runRequest } from '../../patterns/request';
import {
  toArrivalQuery,
  toItemQuery,
  toProgressQuery,
  type ArrivalFilters,
  type ItemFilters,
  type ProgressFilters,
} from './filters';
import {
  toDetailView,
  toRequestView,
  type ReplenishmentDetailView,
  type ReplenishmentRequestView,
} from './types';

type Plant = components['schemas']['Plant'];
type PageMeta = components['schemas']['PageMeta'];
type HistoryItem = components['schemas']['MaterialIssueRequestHistoryItem'];

export const PAGE_SIZE = 50;

/** 이 화면이 소유하는 캐시 키. 쓰기가 성공하면 `all` 을 무효화한다. */
export const replenishmentKeys = {
  all: ['production-warehouse-replenishment'] as const,
  plants: ['production-warehouse-replenishment', 'plants'] as const,
  settings: (plantId: number) =>
    ['production-warehouse-replenishment', 'settings', plantId] as const,
  warehouses: (plantId: number) =>
    ['production-warehouse-replenishment', 'warehouses', plantId] as const,
  plannedStock: (plantId: number, warehouseId: string) =>
    ['production-warehouse-replenishment', 'planned-stock', plantId, warehouseId] as const,
  managed: (plantId: number, warehouseId: number) =>
    ['production-warehouse-replenishment', 'managed', plantId, warehouseId] as const,
  items: (plantId: number, filters: ItemFilters, page: number) =>
    ['production-warehouse-replenishment', 'items', plantId, filters, page] as const,
  progress: (plantId: number, filters: ProgressFilters, page: number) =>
    ['production-warehouse-replenishment', 'progress', plantId, filters, page] as const,
  arrivals: (plantId: number, filters: ArrivalFilters, page: number) =>
    ['production-warehouse-replenishment', 'arrivals', plantId, filters, page] as const,
  varianceReasons: ['production-warehouse-replenishment', 'variance-reasons'] as const,
  counts: (plantId: number) => ['production-warehouse-replenishment', 'counts', plantId] as const,
  detail: (id: number) => ['production-warehouse-replenishment', 'detail', id] as const,
  history: (id: number) => ['production-warehouse-replenishment', 'history', id] as const,
  uoms: ['production-warehouse-replenishment', 'uoms'] as const,
  closeReasons: ['production-warehouse-replenishment', 'close-reasons'] as const,
};

export const usePlants = (): UseQueryResult<Plant[]> => {
  const { client } = useApiClient();
  return useQuery({
    queryKey: replenishmentKeys.plants,
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

/**
 * 공장의 생산 창고와 실행 시각(계약 §4). 창고 목록이 곧 「공장 생산 창고」다 — 비어 있으면 이 공장은 이 화면을
 * 쓸 수 없다(US1-8).
 */
export const useSettings = (plantId: number | null): UseQueryResult<ReplenishmentSettings> => {
  const { client } = useApiClient();
  return useQuery({
    queryKey: replenishmentKeys.settings(plantId ?? 0),
    enabled: plantId !== null,
    queryFn: () =>
      runRequest(() =>
        client.GET('/logistics/replenishment-settings', {
          params: { query: { plantId: plantId ?? 0 } },
        }),
      ),
  });
};

export interface Option {
  value: string;
  label: string;
}

export interface WarehouseOption extends Option {
  isDefect: boolean;
}

/** 공장의 사용 중인 창고 — 출고 자재 창고 후보(생산 창고 · 불량창고는 쓰는 쪽에서 뺀다). */
export const useWarehouses = (plantId: number | null): UseQueryResult<WarehouseOption[]> => {
  const { client } = useApiClient();
  return useQuery({
    queryKey: replenishmentKeys.warehouses(plantId ?? 0),
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
          /* 이름이 같은 창고가 있어 코드를 앞에 붙인다(G1 확인 5). */
          label: `${warehouse.warehouseCode} ${warehouse.warehouseName}`,
          isDefect: warehouse.isDefect,
        })),
  });
};

/** 출고 자재 창고 후보 — 같은 공장 활성 창고, 고른 생산 창고 · 불량창고 제외(FR-002). */
export const sourceOptions = (
  warehouses: readonly WarehouseOption[],
  productionWarehouseId: string,
): Option[] =>
  warehouses
    .filter((warehouse) => !warehouse.isDefect && warehouse.value !== productionWarehouseId)
    .map(({ value, label }) => ({ value, label }));

export interface StockFigures {
  available: number;
  planned: number;
  free: number;
}

/** 창고별로 받은 (창고, 품목) 수치. 받은 창고만 `loaded` 에 든다. */
export interface StockLookup {
  figures: ReadonlyMap<string, StockFigures>;
  loaded: ReadonlySet<string>;
}

const ZERO: StockFigures = { available: 0, planned: 0, free: 0 };

/**
 * (창고, 품목) 가용 · 예정 · 남은 수량(계약 §1 `planned-stock`, G1 보완). 창고마다 `includeUnplanned=true` +
 * `sourceWarehouseId` 로 부른다 — 예정이 없어도 잔액이 있는 쌍이 오고, 받은 창고에 행이 없는 쌍은 가용 0 · 예정 0 이다.
 */
export const usePlannedStock = (
  plantId: number | null,
  warehouseIds: readonly string[],
): StockLookup => {
  const { client } = useApiClient();
  const ids = [...new Set(warehouseIds.filter((id) => id !== ''))].sort();
  const results = useQueries({
    queries: ids.map((warehouseId) => ({
      queryKey: replenishmentKeys.plannedStock(plantId ?? 0, warehouseId),
      enabled: plantId !== null,
      queryFn: async () =>
        (
          await runRequest(() =>
            client.GET('/logistics/material-issue-requests/planned-stock', {
              params: {
                query: {
                  plantId: plantId ?? 0,
                  sourceWarehouseId: Number(warehouseId),
                  includeUnplanned: true,
                },
              },
            }),
          )
        ).items,
    })),
  });
  const figures = new Map<string, StockFigures>();
  const loaded = new Set<string>();
  ids.forEach((warehouseId, index) => {
    const rows = results[index]?.data;
    if (rows === undefined) return;
    loaded.add(warehouseId);
    for (const row of rows) {
      figures.set(stockKey(row.sourceWarehouseId, row.itemId), {
        available: row.availableQty,
        planned: row.plannedQty,
        free: row.freeQty,
      });
    }
  });
  return { figures, loaded };
};

/** 받은 창고면 행이 없어도 0, 아직 못 받았으면 undefined(「—」). */
export const stockOf = (
  stock: StockLookup,
  warehouseId: string,
  itemId: string,
): StockFigures | undefined =>
  stock.loaded.has(warehouseId)
    ? (stock.figures.get(stockKey(warehouseId, itemId)) ?? ZERO)
    : undefined;

export const stockKey = (warehouseId: number | string, itemId: number | string): string =>
  `${String(warehouseId)}:${String(itemId)}`;

/** 한 생산 창고의 관리 품목 전부 — 요청 보기의 기본 출고 자재 창고와 「기준 아래 불러오기」. */
export const useManagedItems = (
  plantId: number | null,
  warehouseId: number | null,
): UseQueryResult<ReplenishmentItem[]> => {
  const { client } = useApiClient();
  return useQuery({
    queryKey: replenishmentKeys.managed(plantId ?? 0, warehouseId ?? 0),
    enabled: plantId !== null && warehouseId !== null,
    queryFn: async () =>
      (
        await fetchAllPages((page, size) =>
          runRequest(() =>
            client.GET('/logistics/replenishment-items', {
              params: {
                query: {
                  plantId: plantId ?? 0,
                  productionWarehouseId: warehouseId ?? 0,
                  page,
                  size,
                },
              },
            }),
          ),
        )
      ).items,
  });
};

export const useItemList = (
  plantId: number | null,
  filters: ItemFilters,
  page: number,
  enabled: boolean,
): UseQueryResult<{ items: ReplenishmentItem[]; page: PageMeta }> => {
  const { client } = useApiClient();
  return useQuery({
    queryKey: replenishmentKeys.items(plantId ?? 0, filters, page),
    enabled: enabled && plantId !== null,
    queryFn: () =>
      runRequest(() =>
        client.GET('/logistics/replenishment-items', {
          params: { query: toItemQuery(plantId ?? 0, filters, page, PAGE_SIZE) },
        }),
      ),
  });
};

export const useProgressList = (
  plantId: number | null,
  filters: ProgressFilters,
  page: number,
  enabled: boolean,
): UseQueryResult<{ items: ReplenishmentRequestView[]; page: PageMeta }> => {
  const { client } = useApiClient();
  return useQuery({
    queryKey: replenishmentKeys.progress(plantId ?? 0, filters, page),
    enabled: enabled && plantId !== null,
    queryFn: async () => {
      const data = await runRequest(() =>
        client.GET('/logistics/material-issue-requests', {
          params: { query: toProgressQuery(plantId ?? 0, filters, page, PAGE_SIZE) },
        }),
      );
      return {
        items: data.items.map(toRequestView),
        page: data.page,
      };
    },
  });
};

export interface HeaderCounts {
  /** 활성 창고 보충 요청 수(배포, 진행 중). */
  active: number;
  /** 보충 시점 아래 관리 품목 수. */
  below: number;
  /** 미수령 출고 전표 수(도착 대기). */
  arrivals: number;
}

/** 보기 이름 옆 숫자(screens/W-02-12.md 「머리」) — 한 건만 받아 전체 수를 읽는다. */
export const useHeaderCounts = (plantId: number | null): UseQueryResult<HeaderCounts> => {
  const { client } = useApiClient();
  return useQuery({
    queryKey: replenishmentKeys.counts(plantId ?? 0),
    enabled: plantId !== null,
    queryFn: async () => {
      const [active, below, arrivals] = await Promise.all([
        runRequest(() =>
          client.GET('/logistics/material-issue-requests', {
            params: {
              query: {
                requestTypeCode: 'REPLENISHMENT',
                plantId: plantId ?? 0,
                replenishmentStatus: ['DISPATCHED', 'IN_PROGRESS'],
                page: 1,
                size: 1,
              },
            },
          }),
        ),
        runRequest(() =>
          client.GET('/logistics/replenishment-items', {
            params: {
              query: { plantId: plantId ?? 0, belowPointOnly: true, page: 1, size: 1 },
            },
          }),
        ),
        runRequest(() =>
          client.GET('/logistics/replenishment-requests/arrivals', {
            params: { query: { plantId: plantId ?? 0, page: 1, size: 1 } },
          }),
        ),
      ]);
      return {
        active: active.page.total,
        below: below.page.total,
        arrivals: arrivals.page.total,
      };
    },
  });
};

export const useDetail = (id: number | null): UseQueryResult<ReplenishmentDetailView> => {
  const { client } = useApiClient();
  return useQuery({
    queryKey: replenishmentKeys.detail(id ?? 0),
    enabled: id !== null,
    /* 다른 기기의 출고 · 피킹이 바로 보이게 — 열 때마다 새로 받는다(G1 확인 4). */
    staleTime: 0,
    refetchOnMount: 'always',
    queryFn: async () =>
      toDetailView(
        await runRequest(() =>
          client.GET('/logistics/material-issue-requests/{materialIssueRequestId}', {
            params: { path: { materialIssueRequestId: id ?? 0 } },
          }),
        ),
      ),
  });
};

export const useHistory = (id: number | null): UseQueryResult<HistoryItem[]> => {
  const { client } = useApiClient();
  return useQuery({
    queryKey: replenishmentKeys.history(id ?? 0),
    enabled: id !== null,
    /* 다른 기기의 출고 · 피킹이 바로 보이게 — 열 때마다 새로 받는다(G1 확인 4). */
    staleTime: 0,
    refetchOnMount: 'always',
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

/** 단위 번호 → 코드 — 품목은 기준단위 번호만 준다. */
export const useUomCodes = (): UseQueryResult<ReadonlyMap<number, string>> => {
  const { client } = useApiClient();
  return useQuery({
    queryKey: replenishmentKeys.uoms,
    queryFn: async () =>
      new Map(
        (
          await runRequest(() =>
            client.GET('/mdm/uoms', { params: { query: { includeInactive: true, size: 200 } } }),
          )
        ).items.map((uom) => [uom.uomId, uom.uomCode]),
      ),
  });
};

export const CLOSE_REASON_GROUP = 'REPLENISHMENT_CLOSE_REASON';

export interface CloseReasons {
  /** 고를 수 있는 사유(사용 중, 표시 순서). */
  options: Option[];
  /** 코드 → 이름(지난 사유 포함). */
  names: ReadonlyMap<string, string>;
}

/** 잔량 마감 사유 — 공통코드 `REPLENISHMENT_CLOSE_REASON`(고객이 값을 늘린다, 계약 §2). */
export const useCloseReasons = (): UseQueryResult<CloseReasons> => {
  const { client } = useApiClient();
  return useQuery({
    queryKey: replenishmentKeys.closeReasons,
    queryFn: async () => {
      const items = (
        await runRequest(() =>
          client.GET('/mdm/code-values', {
            params: {
              query: { codeGroupCode: CLOSE_REASON_GROUP, includeInactive: true, size: 100 },
            },
          }),
        )
      ).items;
      return {
        options: items
          .filter((item) => item.isActive)
          .sort((left, right) => left.displayOrder - right.displayOrder)
          .map((item) => ({ value: item.code, label: item.codeName })),
        names: new Map(items.map((item) => [item.code, item.codeName])),
      };
    },
  });
};

/** 도착 대기 — 창고 보충 요청에서 나간 `POSTED` 출고 중 수령이 없는 것(계약 §2). */
export const useArrivalList = (
  plantId: number | null,
  filters: ArrivalFilters,
  page: number,
): UseQueryResult<{ items: ReplenishmentArrival[]; page: PageMeta }> => {
  const { client } = useApiClient();
  return useQuery({
    queryKey: replenishmentKeys.arrivals(plantId ?? 0, filters, page),
    enabled: plantId !== null,
    /* 모바일 생산창고 입고에서 받은 전표가 바로 빠지게 — 열 때마다 새로 받는다. */
    staleTime: 0,
    refetchOnMount: 'always',
    queryFn: () =>
      runRequest(() =>
        client.GET('/logistics/replenishment-requests/arrivals', {
          params: { query: toArrivalQuery(plantId ?? 0, filters, page, PAGE_SIZE) },
        }),
      ),
  });
};

export const VARIANCE_REASON_GROUP = 'VARIANCE_REASON';

/** 수령 차이 사유 — 모바일 생산창고 입고와 같은 공통코드(`VARIANCE_REASON`). */
export const useVarianceReasons = (): UseQueryResult<Option[]> => {
  const { client } = useApiClient();
  return useQuery({
    queryKey: replenishmentKeys.varianceReasons,
    queryFn: async () =>
      (
        await runRequest(() =>
          client.GET('/mdm/code-values', {
            params: { query: { codeGroupCode: VARIANCE_REASON_GROUP, size: 100 } },
          }),
        )
      ).items
        .filter((item) => item.isActive)
        .sort((left, right) => left.displayOrder - right.displayOrder)
        .map((item) => ({ value: item.code, label: item.codeName })),
  });
};
