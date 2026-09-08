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
  item: (id: number) => ['material-location-item', id] as const,
  uoms: () => ['material-location-uoms'] as const,
};

const fetchItemCode = async (client: Client, itemId: number): Promise<string> => {
  const data = await runRequest(() =>
    client.GET('/mdm/items/{itemId}', { params: { path: { itemId } } }),
  );

  return data.item.itemCode;
};

/** 잔액이 실어 온 이름으로 푼다. 못 찾은 것과 값이 없는 것을 가른다. */
const fromLabels = (labels: Map<number, string>): ReferenceResolver => {
  return (id) => {
    if (id === null || id === undefined) {
      return { kind: 'empty' };
    }

    const label = labels.get(id);

    return label === undefined ? { kind: 'unknown' } : { kind: 'named', label };
  };
};

const useItemNames = (ids: number[]): ReferenceResolver => {
  const { client } = useApiClient();
  const results = useQueries({
    queries: ids.map((id) => ({
      queryKey: lookupKeys.item(id),
      queryFn: () => fetchItemCode(client, id),
    })),
  });
  const byId = new Map<number, UseQueryResult<string>>(
    ids
      .map((id, index) => [id, results[index]] as const)
      .filter((entry): entry is [number, UseQueryResult<string>] => entry[1] !== undefined),
  );

  return (id) => {
    if (id === null || id === undefined) {
      return { kind: 'empty' };
    }

    const result = byId.get(id);

    if (result === undefined) {
      return { kind: 'unknown' };
    }

    if (result.isError) {
      return { kind: 'failed' };
    }

    return result.data === undefined ? { kind: 'loading' } : { kind: 'named', label: result.data };
  };
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
 * 잔액 응답의 내부 번호를 이름으로 푼다.
 *
 * 창고·위치·품목의 이름이 응답에 실려 온다 - 되짚어 부르지 않는다. 줄마다 단건 조회를 하면
 * 잔액이 있는 자리 수만큼 요청이 늘고, 이름이 본 자료보다 늦게 와 그 사이 화면이 값을 못
 * 읽은 것처럼 보인다.
 *
 * 이름은 위치 축이 접히면 비어 온다(`groupBy` 가 LOCATION 이 아닐 때). 이 화면은 위치별로
 * 물으므로 채워져 오지만, 비어 오는 것을 오류로 읽지 않는다.
 */
export const useReferenceNames = (
  balances: InventoryBalance[],
  itemId?: number | null,
): ReferenceNames => {
  const warehouseNames = new Map<number, string>();
  const locationLabels = new Map<number, string>();
  const itemCodes = new Map<number, string>();

  for (const balance of balances) {
    if (
      balance.warehouseId !== null &&
      balance.warehouseId !== undefined &&
      balance.warehouseName !== null &&
      balance.warehouseName !== undefined
    ) {
      warehouseNames.set(balance.warehouseId, balance.warehouseName);
    }

    if (
      balance.locationId !== null &&
      balance.locationId !== undefined &&
      balance.locationCode !== null &&
      balance.locationCode !== undefined
    ) {
      /* 코드만으로는 어느 자리인지 사람이 못 읽는다. 이름이 오면 함께 보인다. */
      locationLabels.set(
        balance.locationId,
        balance.locationName === null || balance.locationName === undefined
          ? balance.locationCode
          : `${balance.locationCode} (${balance.locationName})`,
      );
    }

    if (balance.itemCode !== undefined) {
      itemCodes.set(balance.itemId, balance.itemCode);
    }
  }

  /*
   * 스캔한 LOT 의 품목만 되짚어 부른다 - 그 LOT 의 잔액이 한 자리도 없으면 응답에 품목 코드가
   * 실려 올 곳이 없다. 잔액이 있으면 부르지 않는다.
   */
  const missingItemIds =
    itemId === null || itemId === undefined || itemCodes.has(itemId) ? [] : [itemId];
  const fetchedItem = useItemNames(missingItemIds);
  const fromBalances = fromLabels(itemCodes);
  // 단위 목록은 LOT 을 찾기 전에는 쓸 자리가 없다. 스캔 전에 부르면 오프라인 기동에서
  // 아무도 읽지 않을 실패가 하나 생긴다.
  const scanned = balances.length > 0 || missingItemIds.length > 0;

  return {
    warehouse: fromLabels(warehouseNames),
    location: fromLabels(locationLabels),
    item: (id) => {
      const found = fromBalances(id);

      return found.kind === 'unknown' ? fetchedItem(id) : found;
    },
    uom: useUomNames(scanned),
  };
};
