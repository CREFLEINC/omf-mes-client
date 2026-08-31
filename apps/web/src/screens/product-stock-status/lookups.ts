import type { ApiClient, components } from '@omf-mes/api-client';
import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { useApiClient } from '../../patterns/api-context';
import type { LookupEntry } from '../../patterns/lookup-display';
import { runRequest } from '../../patterns/request';

/**
 * 내부 번호(FK)로 이어진 값을 이름으로 푸는 선택 목록.
 *
 * ⚠ **계획은 이 훅이 창고·품목 둘뿐이라고 지시했다.** `/inventory/balances` 응답이 품목·
 * 위치·LOT 이름을 인라인으로 준다는 가정이었는데, `types.ts`가 적어 둔 대로 이 클라이언트가
 * 생성한 계약에는 아직 그 인라인 이름이 없다. 그래서 이 화면도 W-01-07처럼 품목·위치·LOT
 * 이름을 풀 참조가 필요해 **넷**이 됐다 — 창고·품목·위치·LOT. 계약 생성물이 갱신되면 위치·
 * LOT 훅 둘을 걷어내고 표가 `itemCode`·`lotNo`·`locationCode`를 직접 쓰도록 정리한다.
 *
 * **위치는 창고에 매달린다**(계약이 `warehouseId`를 필수로 요구한다). **LOT은 품목에
 * 매달린다**(`/trace/lots`에 번호 여러 개를 한 번에 조회하는 수단이 없다 — 품목이 범위를
 * 정한다). 매달림은 `enabled`로만 표현한다.
 *
 * 전부 `includeInactive=true`로 받는다 — 미사용 창고·위치·품목을 참조하는 과거 재고가
 * 오면 이름이 비어 보이는 것을 막는다.
 *
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 파일을 참조하지 않는다.
 */

type Client = ApiClient['client'];
type PageMeta = components['schemas']['PageMeta'];

export interface ReferenceOptionsResult {
  entries: readonly LookupEntry[];
  /** 서버가 준 전체 건수가 받은 건수보다 많으면 잘린 것이다 — 고를 수 없는 값이 생겼다는 뜻이다. */
  isTruncated: boolean;
}

export const lookupKeys = {
  warehouses: ['product-stock-status', 'lookups', 'warehouses'] as const,
  items: ['product-stock-status', 'lookups', 'items'] as const,
  locations: (warehouseId: number | null) =>
    ['product-stock-status', 'lookups', 'locations', warehouseId] as const,
  lots: (itemId: number | null) => ['product-stock-status', 'lookups', 'lots', itemId] as const,
};

const toResult = (entries: LookupEntry[], page: PageMeta): ReferenceOptionsResult => ({
  entries,
  isTruncated: page.total > entries.length,
});

const fetchWarehouseOptions = async (client: Client): Promise<ReferenceOptionsResult> => {
  const data = await runRequest(() =>
    client.GET('/mdm/warehouses', { params: { query: { includeInactive: true } } }),
  );

  return toResult(
    data.items.map((item) => ({
      value: String(item.warehouseId),
      label: `${item.warehouseCode} · ${item.warehouseName}`,
      isActive: item.isActive,
    })),
    data.page,
  );
};

/** 창고 — 조건 줄의 창고 선택칸이 쓴다. 이 화면의 필수 조건이라 늘 부른다. */
export const useWarehouseOptions = (): UseQueryResult<ReferenceOptionsResult> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: lookupKeys.warehouses,
    queryFn: () => fetchWarehouseOptions(client),
  });
};

const fetchItemOptions = async (client: Client): Promise<ReferenceOptionsResult> => {
  const data = await runRequest(() =>
    client.GET('/mdm/items', { params: { query: { includeInactive: true } } }),
  );

  return toResult(
    data.items.map((item) => ({
      value: String(item.itemId),
      label: `${item.itemCode} · ${item.itemName}`,
      isActive: item.isActive,
    })),
    data.page,
  );
};

/** 품목 — 조건 줄의 품목 선택칸과 세 보기의 품목 열·그룹 헤더가 함께 쓴다. */
export const useItemOptions = (): UseQueryResult<ReferenceOptionsResult> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: lookupKeys.items,
    queryFn: () => fetchItemOptions(client),
  });
};

const validIdentifier = (value: number | null): value is number =>
  value !== null && Number.isSafeInteger(value) && value >= 1;

const fetchLocationOptions = async (
  client: Client,
  warehouseId: number,
): Promise<ReferenceOptionsResult> => {
  const data = await runRequest(() =>
    client.GET('/mdm/locations', { params: { query: { warehouseId, includeInactive: true } } }),
  );

  return toResult(
    data.items.map((item) => ({
      value: String(item.locationId),
      label: `${item.locationCode} · ${item.locationName}`,
      isActive: item.isActive,
    })),
    data.page,
  );
};

/** 위치 — 위치별 보기의 위치 열·그룹 헤더가 쓴다. 창고를 고른 뒤에만 부른다. */
export const useLocationOptions = (
  warehouseId: number | null,
): UseQueryResult<ReferenceOptionsResult> => {
  const { client } = useApiClient();
  const enabled = validIdentifier(warehouseId);

  return useQuery({
    queryKey: lookupKeys.locations(warehouseId),
    enabled,
    queryFn: () => {
      if (!validIdentifier(warehouseId)) {
        throw new Error('창고를 고르기 전에는 위치 목록을 조회하지 않습니다.');
      }

      return fetchLocationOptions(client, warehouseId);
    },
  });
};

const fetchLotOptions = async (client: Client, itemId: number): Promise<ReferenceOptionsResult> => {
  const data = await runRequest(() => client.GET('/trace/lots', { params: { query: { itemId } } }));

  return toResult(
    data.items.map((item) => ({ value: String(item.lotId), label: item.lotNo, isActive: true })),
    data.page,
  );
};

/**
 * LOT — LOT별 보기의 LOT 열이 쓴다. **품목을 고르고 LOT별 보기일 때만 부른다**
 * (`view-axis.ts`의 게이팅과 같은 갈래).
 */
export const useLotOptions = (
  itemId: number | null,
  enabled: boolean,
): UseQueryResult<ReferenceOptionsResult> => {
  const { client } = useApiClient();
  const active = enabled && validIdentifier(itemId);

  return useQuery({
    queryKey: lookupKeys.lots(itemId),
    enabled: active,
    queryFn: () => {
      if (!validIdentifier(itemId)) {
        throw new Error('품목을 고르기 전에는 LOT 목록을 조회하지 않습니다.');
      }

      return fetchLotOptions(client, itemId);
    },
  });
};
