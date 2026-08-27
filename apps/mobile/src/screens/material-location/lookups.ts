import { useQueries, type UseQueryResult } from '@tanstack/react-query';

import { useApiClient } from '../../patterns/api-context';
import { runRequest } from '../../patterns/request';
import type { InventoryBalance } from './queries';

type Client = ReturnType<typeof useApiClient>['client'];

/**
 * 참조 값 하나의 표기 상태. 다섯 갈래를 뭉개면 본 자료가 이름보다 먼저 온 순간
 * 정상 값이 unknown 으로 보이고, 그 문구는 값이 잘못됐다는 뜻으로 읽힌다.
 * 어느 갈래에도 내부 번호를 담지 않는다 — 담을 자리가 없으면 화면으로 샐 경로도 없다.
 */
export type ReferenceState =
  | { kind: 'empty' }
  | { kind: 'named'; label: string }
  | { kind: 'unknown' }
  | { kind: 'loading' }
  | { kind: 'failed' };

export type ReferenceResolver = (id: number | null | undefined) => ReferenceState;

export interface ReferenceNames {
  warehouse: ReferenceResolver;
  location: ReferenceResolver;
  item: ReferenceResolver;
  uom: ReferenceResolver;
}

export const lookupKeys = {
  warehouse: (id: number) => ['material-location-warehouse', id] as const,
  location: (id: number) => ['material-location-location', id] as const,
  item: (id: number) => ['material-location-item', id] as const,
  uoms: () => ['material-location-uoms'] as const,
};

const distinct = (values: (number | null | undefined)[]): number[] => [
  ...new Set(values.filter((value): value is number => value !== null && value !== undefined)),
];

const fetchWarehouseName = async (client: Client, warehouseId: number): Promise<string> => {
  const data = await runRequest(() =>
    client.GET('/mdm/warehouses/{warehouseId}', { params: { path: { warehouseId } } }),
  );

  return data.warehouse.warehouseName;
};

const fetchLocationName = async (client: Client, locationId: number): Promise<string> => {
  const data = await runRequest(() =>
    client.GET('/mdm/locations/{locationId}', { params: { path: { locationId } } }),
  );

  return `${data.location.locationCode} (${data.location.locationName})`;
};

const fetchItemCode = async (client: Client, itemId: number): Promise<string> => {
  const data = await runRequest(() =>
    client.GET('/mdm/items/{itemId}', { params: { path: { itemId } } }),
  );

  return data.item.itemCode;
};

const toResolver = (ids: number[], results: UseQueryResult<string>[]): ReferenceResolver => {
  const byId = new Map(ids.map((id, index) => [id, results[index]]));

  return (id) => {
    if (id === null || id === undefined) {
      return { kind: 'empty' };
    }

    const result = byId.get(id);

    if (result === undefined || result.isError) {
      return result === undefined ? { kind: 'unknown' } : { kind: 'failed' };
    }

    return result.data === undefined ? { kind: 'loading' } : { kind: 'named', label: result.data };
  };
};

const useByIdNames = (
  ids: number[],
  queryKey: (id: number) => readonly unknown[],
  fetchName: (client: Client, id: number) => Promise<string>,
): ReferenceResolver => {
  const { client } = useApiClient();
  const results = useQueries({
    queries: ids.map((id) => ({ queryKey: queryKey(id), queryFn: () => fetchName(client, id) })),
  });

  return toResolver(ids, results);
};

const useUomNames = (enabled: boolean): ReferenceResolver => {
  const { client } = useApiClient();
  // 단위는 단건 조회가 없어 목록으로 받는다. 미사용 단위를 참조하는 과거 재고가 오면
  // 기본 조회로는 이름이 비어 보인다.
  const results = useQueries({
    queries: [
      {
        queryKey: lookupKeys.uoms(),
        enabled,
        queryFn: async () => {
          const data = await runRequest(() =>
            client.GET('/mdm/uoms', { params: { query: { includeInactive: true } } }),
          );

          return new Map(data.items.map((uom) => [uom.uomId, uom.uomCode]));
        },
      },
    ],
  });
  const result = results[0];

  return (id) => {
    if (id === null || id === undefined) {
      return { kind: 'empty' };
    }

    if (result === undefined || result.isError) {
      return { kind: 'failed' };
    }

    if (result.data === undefined) {
      return { kind: 'loading' };
    }

    const label = result.data.get(id);

    return label === undefined ? { kind: 'unknown' } : { kind: 'named', label };
  };
};

/**
 * 잔액 응답의 내부 번호를 이름으로 푼다. 계약의 InventoryBalance 21개 필드에 이름이
 * 하나도 없어 필요한 만큼 되짚어 부른다 — 잔액 응답에 이름을 실어 달라는 계약 개선이
 * 반영되면 이 파일이 통째로 사라진다.
 *
 * 창고를 모른 채 들어오는 화면이라 단건 조회를 쓴다. 창고·위치·품목 목록 조회는
 * 창고를 고른 뒤를 전제하며 위치 목록은 warehouseId 를 필수로 요구한다.
 *
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 파일을 참조하지 않는다.
 */
export const useReferenceNames = (
  balances: InventoryBalance[],
  itemId?: number | null,
): ReferenceNames => {
  const warehouseIds = distinct(balances.map((balance) => balance.warehouseId));
  const locationIds = distinct(balances.map((balance) => balance.locationId));
  const itemIds = distinct([...balances.map((balance) => balance.itemId), itemId]);
  // 단위 목록은 LOT 을 찾기 전에는 쓸 자리가 없다. 스캔 전에 부르면 오프라인 기동에서
  // 아무도 읽지 않을 실패가 하나 생긴다.
  const scanned = balances.length > 0 || itemIds.length > 0;

  return {
    warehouse: useByIdNames(warehouseIds, lookupKeys.warehouse, fetchWarehouseName),
    location: useByIdNames(locationIds, lookupKeys.location, fetchLocationName),
    item: useByIdNames(itemIds, lookupKeys.item, fetchItemCode),
    uom: useUomNames(scanned),
  };
};
