import type { ApiClient } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';
import { useQueries, useQuery } from '@tanstack/react-query';

import { useApiClient } from '../../patterns/api-context';
import { fetchAllPages } from '../../patterns/fetch-all-pages';
import { runRequest } from '../../patterns/request';
import type { LookupEntry, PageMeta } from './types';

/**
 * 내부 번호(FK)로 이어진 값을 이름으로 푸는 선택 목록 넷 — 고객·납품처·품목·단위.
 * 여기에 더해 **가용 수량**(`useAvailableQty`)을 라인 품목마다 조회한다.
 *
 * 고객·납품처는 계약이 역할 필드를 주지 않아(`Partner` 스키마 실측 · `shipment-schedule`과
 * 같은 사정) 같은 자원(`/mdm/partners`)을 각각 독립 키로 받는다 — 한쪽 재시도가 다른 쪽에
 * 번지지 않게 하기 위해서다.
 *
 * 전부 `includeInactive=true`로 받는다. 미사용 값을 참조하는 과거 지시서가 오면 이름이
 * 비어 보이지 않게 하기 위해서다.
 *
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 파일을 참조하지 않는다.
 */

const t = messages.shipmentRequestCreate;

export interface ReferenceSource {
  entries: readonly LookupEntry[];
  isError: boolean;
  isLoading: boolean;
}

export interface LookupResult extends ReferenceSource {
  entries: LookupEntry[];
  truncated: boolean;
  refetch: () => void;
}

export type ReferenceState =
  { kind: 'named'; label: string } | { kind: 'unknown' } | { kind: 'loading' } | { kind: 'failed' };

export const toReference = (
  source: ReferenceSource,
  id: number | null | undefined,
): ReferenceState => {
  if (source.isError) return { kind: 'failed' };
  if (source.isLoading) return { kind: 'loading' };
  if (id === null || id === undefined) return { kind: 'unknown' };

  const label = source.entries.find((entry) => entry.value === String(id))?.label;

  return label === undefined ? { kind: 'unknown' } : { kind: 'named', label };
};

export const describeReference = (state: ReferenceState): string => {
  switch (state.kind) {
    case 'named':
      return state.label;
    case 'unknown':
      return t.values.unknown;
    case 'loading':
      return t.values.referenceLoading;
    case 'failed':
      return t.values.referenceFailed;
  }
};

const EMPTY_ENTRIES: LookupEntry[] = [];

const isTruncated = (page: PageMeta, shown: number): boolean => page.total > shown;

export const lookupNote = (lookup: LookupResult): string | undefined => {
  if (lookup.isError) return t.filters.lookupFailed;
  if (lookup.truncated) return t.filters.lookupTruncated;

  return undefined;
};

export const lookupKeys = {
  customers: ['shipment-request-create-lookups', 'customers'] as const,
  shipToPartners: ['shipment-request-create-lookups', 'ship-to-partners'] as const,
  businessUnits: ['shipment-request-create-lookups', 'business-units'] as const,
  warehouses: ['shipment-request-create-lookups', 'warehouses'] as const,
  plants: ['shipment-request-create-lookups', 'plants'] as const,
  itemName: (itemId: number) => ['shipment-request-create-lookups', 'item-name', itemId] as const,
  uoms: ['shipment-request-create-lookups', 'uoms'] as const,
};

type Client = ApiClient['client'];

const toPartnerLookupResult = (
  data:
    | {
        items: { partnerId: number; partnerCode: string; partnerName: string; isActive: boolean }[];
        page: PageMeta;
        /** 쪽을 끝까지 받고도 총계에 못 미쳤는가(`fetchAllPages`). */
        truncated: boolean;
      }
    | undefined,
  isError: boolean,
  isLoading: boolean,
  refetch: () => void,
): LookupResult => ({
  entries:
    data?.items.map((item) => ({
      value: String(item.partnerId),
      label: `${item.partnerCode} · ${item.partnerName}`,
      isActive: item.isActive,
    })) ?? EMPTY_ENTRIES,
  truncated: data?.truncated === true,
  isError,
  isLoading,
  refetch,
});

/** 고객 — 좌측 조건의 선택칸과 편성 폼의 고객 이름이 함께 쓴다. */
export const useCustomerOptions = (): LookupResult => {
  const { client } = useApiClient();

  const query = useQuery({
    queryKey: lookupKeys.customers,
    queryFn: () =>
      fetchAllPages((page, size) =>
        runRequest(() =>
          client.GET('/mdm/partners', {
            params: { query: { includeInactive: true, page, size } },
          }),
        ),
      ),
  });

  return toPartnerLookupResult(query.data, query.isError, query.isPending, () => {
    void query.refetch();
  });
};

/** 납품처 — 편성 폼의 납품처 선택칸(단독 생성)과 이름 표시(지시서 경유)가 함께 쓴다. */
export const useShipToPartnerOptions = (): LookupResult => {
  const { client } = useApiClient();

  const query = useQuery({
    queryKey: lookupKeys.shipToPartners,
    queryFn: () =>
      fetchAllPages((page, size) =>
        runRequest(() =>
          client.GET('/mdm/partners', {
            params: { query: { includeInactive: true, page, size } },
          }),
        ),
      ),
  });

  return toPartnerLookupResult(query.data, query.isError, query.isPending, () => {
    void query.refetch();
  });
};

/** 세션의 데이터 범위 한 줄 — 계약 `SessionScope`. */
export interface DataScope {
  businessUnitId: number;
  plantId?: number;
}

/**
 * 고를 수 있는 사업부인가(피처 012 FR-002) — 범위가 없으면 모든 활성 사업부, 범위 줄이 있으면 그 줄들의
 * 사업부(공장만 지정한 줄도 그 공장의 사업부를 싣는다 — 계약 `SessionScope.businessUnitId` 는 필수다).
 * 서버(`accountCoversBusinessUnit`)와 같은 규칙이다. 서버가 범위 밖을 403 으로 막으므로 이 거름은
 * 고를 수 없는 값을 보이지 않게 하는 몫이다.
 */
export const businessUnitInScope = (
  businessUnitId: number,
  scopes: readonly DataScope[],
): boolean => scopes.length === 0 || scopes.some((scope) => scope.businessUnitId === businessUnitId);

/**
 * 고를 수 있는 창고인가(피처 012 FR-003 · Edge 「공장 줄만 있는 범위」).
 *
 * - 활성 · 불량창고 아님 · 고른 사업부의 창고.
 * - 계정 범위: 그 사업부를 통째로 가진 줄(공장 없음)이 있으면 그 사업부 창고 모두, 공장 줄만 있으면 그 공장 창고만.
 *   범위가 하나도 없으면 전체.
 */
export const warehouseSelectable = (
  warehouse: {
    businessUnitId: number;
    plantId: number;
    isActive: boolean;
    isDefect: boolean;
  },
  businessUnitId: number,
  scopes: readonly DataScope[],
): boolean => {
  if (!warehouse.isActive || warehouse.isDefect || warehouse.businessUnitId !== businessUnitId) {
    return false;
  }
  if (scopes.length === 0) return true;

  const unitScopes = scopes.filter((scope) => scope.businessUnitId === businessUnitId);

  return unitScopes.some(
    (scope) => scope.plantId === undefined || scope.plantId === warehouse.plantId,
  );
};

/** 사업부 선택지 — 활성 사업부 중 계정 범위 안. */
export const useBusinessUnitOptions = (scopes: readonly DataScope[]): LookupResult => {
  const { client } = useApiClient();
  const query = useQuery({
    queryKey: lookupKeys.businessUnits,
    queryFn: () =>
      fetchAllPages((page, size) =>
        runRequest(() => client.GET('/mdm/business-units', { params: { query: { page, size } } })),
      ),
  });
  const data = query.data;

  return {
    entries:
      data?.items
        .filter((unit) => unit.isActive && businessUnitInScope(unit.businessUnitId, scopes))
        .map((unit) => ({
          value: String(unit.businessUnitId),
          label: unit.businessUnitName,
          isActive: unit.isActive,
        })) ?? EMPTY_ENTRIES,
    truncated: data?.truncated === true,
    isError: query.isError,
    isLoading: query.isPending,
    refetch: () => {
      void query.refetch();
    },
  };
};

/** 출고 창고 한 건 — 선택지와 「사업부를 바꾸면 비울 줄」 판정이 함께 쓴다. */
export interface WarehouseEntry {
  value: string;
  /** 「창고 이름 · 공장 이름」(시안 W0401-After) */
  label: string;
  warehouseName: string;
  businessUnitId: number;
  plantId: number;
}

export interface WarehouseLookup {
  /** 고른 사업부에서 고를 수 있는 창고(계정 범위 · 활성 · 불량 아님). 사업부를 안 골랐으면 빈 목록. */
  selectable: (businessUnitId: string) => WarehouseEntry[];
  /** 번호로 이름을 푼다 — 고를 수 없게 된 창고도 이름은 푼다. */
  nameOf: (warehouseId: string) => string | undefined;
  isError: boolean;
  isLoading: boolean;
  truncated: boolean;
}

/**
 * 출고 창고 — 창고 목록(활성)과 공장 이름을 받아 「창고 · 공장」으로 푼다.
 *
 * ⚠ 창고 목록 계약에 사업부 조건이 없다 — 전부 받아 사업부·계정 범위로 거른다(`warehouseSelectable`).
 */
export const useWarehouseOptions = (scopes: readonly DataScope[]): WarehouseLookup => {
  const { client } = useApiClient();
  const warehouses = useQuery({
    queryKey: lookupKeys.warehouses,
    queryFn: () =>
      fetchAllPages((page, size) =>
        runRequest(() => client.GET('/mdm/warehouses', { params: { query: { page, size } } })),
      ),
  });
  const plants = useQuery({
    queryKey: lookupKeys.plants,
    queryFn: () => runRequest(() => client.GET('/mdm/plants', { params: { query: {} } })),
  });

  const plantNames = new Map(
    (plants.data?.items ?? []).map((plant) => [plant.plantId, plant.plantName]),
  );
  const items = warehouses.data?.items ?? [];
  const toEntry = (warehouse: (typeof items)[number]): WarehouseEntry => ({
    value: String(warehouse.warehouseId),
    label: t.lineTable.warehouseOption(
      warehouse.warehouseName,
      plantNames.get(warehouse.plantId) ?? t.values.unknown,
    ),
    warehouseName: warehouse.warehouseName,
    businessUnitId: warehouse.businessUnitId,
    plantId: warehouse.plantId,
  });

  return {
    selectable: (businessUnitId) => {
      if (businessUnitId === '') return [];

      return items
        .filter((warehouse) => warehouseSelectable(warehouse, Number(businessUnitId), scopes))
        .map(toEntry);
    },
    nameOf: (warehouseId) =>
      items.find((warehouse) => String(warehouse.warehouseId) === warehouseId)?.warehouseName,
    isError: warehouses.isError || plants.isError,
    isLoading: warehouses.isPending || plants.isPending,
    truncated:
      warehouses.data?.truncated === true ||
      (plants.data !== undefined && isTruncated(plants.data.page, plants.data.items.length)),
  };
};

/**
 * 라인 품목의 **이름** — 「코드 · 이름」으로 그린다.
 *
 * ⛔ **목록 첫 쪽으로 풀지 않는다.** 종전에는 `GET /mdm/items` 첫 쪽(50건)을 받아 그 안에서
 *    이름을 찾았다 — 그 너머의 품목을 실은 지시서를 열면 **품목 칸이 「알 수 없음」**이 됐고,
 *    라인 편성이 팝업으로 바뀌면서 품목 칸이 그 라인을 가리키는 **유일한 자리**가 되어 그
 *    구멍이 그대로 드러난다.
 * ⭐ 그래서 **번호로 하나씩 푼다**(`GET /mdm/items/{itemId}`). 가용 수량이 이미 같은 짜임으로
 *    품목마다 부르고 있어 요청 수가 늘지 않는다.
 *
 * **중복 품목은 한 번만 묻는다** — 두 라인이 같은 품목이면 요청도 하나다.
 */
export interface ItemNameLookup {
  of: (itemId: number | null) => ReferenceState;
}

const fetchItemName = async (client: Client, itemId: number): Promise<string> => {
  const data = await runRequest(() =>
    client.GET('/mdm/items/{itemId}', { params: { path: { itemId } } }),
  );

  /* 상세는 봉투로 온다 — 편집 가능 여부(`editability`)는 이 화면이 쓰지 않는다. */
  return `${data.item.itemCode} · ${data.item.itemName}`;
};

export const useItemNames = (itemIds: readonly (number | null)[]): ItemNameLookup => {
  const { client } = useApiClient();

  const uniqueIds = [...new Set(itemIds.filter((id): id is number => id !== null))];

  const results = useQueries({
    queries: uniqueIds.map((itemId) => ({
      queryKey: lookupKeys.itemName(itemId),
      queryFn: () => fetchItemName(client, itemId),
    })),
  });

  return {
    of: (itemId) => {
      if (itemId === null) return { kind: 'unknown' };

      const index = uniqueIds.indexOf(itemId);
      const result = index === -1 ? undefined : results[index];

      if (result === undefined || result.isPending) return { kind: 'loading' };
      if (result.isError) return { kind: 'failed' };
      if (result.data === undefined) return { kind: 'loading' };

      return { kind: 'named', label: result.data };
    },
  };
};

/** 단위 — 라인 표의 단위 이름과(둘 다 모드) 지시서 라인 승계 값의 이름 풀이가 쓴다. */
export const useUomOptions = (): LookupResult => {
  const { client } = useApiClient();

  const query = useQuery({
    queryKey: lookupKeys.uoms,
    queryFn: () =>
      runRequest(() => client.GET('/mdm/uoms', { params: { query: { includeInactive: true } } })),
  });

  const data = query.data;

  return {
    entries:
      data?.items.map((item) => ({
        value: String(item.uomId),
        label: `${item.uomCode} · ${item.uomName}`,
        isActive: item.isActive,
      })) ?? EMPTY_ENTRIES,
    truncated: data !== undefined && isTruncated(data.page, data.items.length),
    isError: query.isError,
    isLoading: query.isPending,
    refetch: () => {
      void query.refetch();
    },
  };
};

/** 가용 수량 한 품목의 조회 상태. 네 갈래 — 아직 안 물음 · 조회 중 · 실패 · 값. */
export type AvailableQtyState =
  { kind: 'unasked' } | { kind: 'loading' } | { kind: 'failed' } | { kind: 'qty'; value: number };

export const describeAvailableQty = (state: AvailableQtyState): string => {
  switch (state.kind) {
    case 'unasked':
      return t.values.empty;
    case 'loading':
      return t.values.availableQtyLoading;
    case 'failed':
      return t.values.availableQtyFailed;
    case 'qty':
      return String(state.value);
  }
};

const fetchAvailableQty = async (
  client: Client,
  itemId: number,
  warehouseId: number,
): Promise<number> => {
  const data = await runRequest(() =>
    client.GET('/inventory/balances', {
      params: { query: { itemId, warehouseId, groupBy: 'ITEM' } },
    }),
  );

  /*
   * **합산이지 재계산이 아니다**(미결 항목 표 · L-2). `availableQty`는 서버가 계산해 내려주는
   * `readonly` 값이고, 여기서는 그 값을 다시 유도하지 않고 그대로 더한다. 소유 구분(`ownershipTypeCode`)이
   * 갈리면 한 품목이 여러 줄로 올 수 있어(계약 설명 「소유 구분은 어떤 축에서도 합치지 않는다」)
   * 합산이 필요하다.
   */
  return data.items.reduce((sum, item) => sum + item.availableQty, 0);
};

export interface AvailableQtyLookup {
  of: (itemId: number | null, warehouseId: number | null) => AvailableQtyState;
  refetchAll: () => void;
}

/** 품목 × 창고 한 쌍. 둘 중 하나라도 비면 묻지 않는다. */
export interface ItemWarehouse {
  itemId: number | null;
  warehouseId: number | null;
}

const pairKey = (itemId: number, warehouseId: number): string =>
  `${String(itemId)}@${String(warehouseId)}`;

/**
 * 라인의 **고른 창고** 가용 수량(피처 012 FR-006a · 시안 빈 곳 ④) —
 * `GET /inventory/balances?itemId=&warehouseId=&groupBy=ITEM` 을 품목 × 창고마다 부른다.
 * 창고를 아직 고르지 않은 줄은 묻지 않는다(「—」) — 사업부 전체 가용을 보이면 다른 창고 재고로 넉넉해 보인다.
 *
 * **같은 품목 × 창고는 한 번만 묻는다** — 나눈 줄이 같은 창고면 요청도 하나다.
 */
export const useAvailableQty = (pairs: readonly ItemWarehouse[]): AvailableQtyLookup => {
  const { client } = useApiClient();

  const unique = new Map<string, { itemId: number; warehouseId: number }>();

  for (const pair of pairs) {
    if (pair.itemId === null || pair.warehouseId === null) continue;
    unique.set(pairKey(pair.itemId, pair.warehouseId), {
      itemId: pair.itemId,
      warehouseId: pair.warehouseId,
    });
  }

  const uniqueKeys = [...unique.keys()];
  const results = useQueries({
    queries: [...unique.values()].map(({ itemId, warehouseId }) => ({
      queryKey: ['shipment-request-create-lookups', 'available-qty', itemId, warehouseId] as const,
      queryFn: () => fetchAvailableQty(client, itemId, warehouseId),
    })),
  });

  const of = (itemId: number | null, warehouseId: number | null): AvailableQtyState => {
    if (itemId === null || warehouseId === null) return { kind: 'unasked' };

    const index = uniqueKeys.indexOf(pairKey(itemId, warehouseId));
    const result = index === -1 ? undefined : results[index];

    if (result === undefined) return { kind: 'unasked' };
    if (result.isError) return { kind: 'failed' };
    if (result.data === undefined) return { kind: 'loading' };

    return { kind: 'qty', value: result.data };
  };

  return {
    of,
    refetchAll: () => {
      for (const result of results) void result.refetch();
    },
  };
};
