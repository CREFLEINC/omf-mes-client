import type { components } from '@omf-mes/api-client';
import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { useApiClient } from '../../patterns/api-context';
import { runRequest } from '../../patterns/request';
import type { StockTransfer, StockTransferLine } from './transfer';

export type Location = components['schemas']['Location'];
export type Warehouse = components['schemas']['Warehouse'];

/** 창고를 넉넉히 받는다. 한 공장의 창고는 이 안에 다 든다. */
const WAREHOUSE_SIZE = 200;

/**
 * 옮겨 갈 수 있는 창고.
 *
 * 도착 위치를 창고 없이 찾을 수 없다 - 위치 조회가 창고를 필수로 요구한다. 그래서 창고를
 * 먼저 고르고 그 안에서 위치를 스캔한다.
 */
export const useWarehouses = (): UseQueryResult<Warehouse[]> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: ['stock-transfer-warehouses'] as const,
    queryFn: async () => {
      const data = await runRequest(() =>
        client.GET('/mdm/warehouses', { params: { query: { size: WAREHOUSE_SIZE } } }),
      );

      return data.items.filter((warehouse) => warehouse.isActive);
    },
  });
};

export type InventoryBalance = components['schemas']['InventoryBalance'];

/**
 * 이 LOT 이 어느 자리에 얼마나 있는가.
 *
 * 위치별로 갈라 받는다 - 한 LOT 이 여러 자리에 있을 수 있고, 어느 자리에서 빼는지가
 * 반출 라인에 실린다. 잔액이 0 인 자리는 옮길 것이 없어 받지 않는다.
 */
export const useLotBalances = (lotId: number | null): UseQueryResult<InventoryBalance[]> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: ['stock-transfer-balances', lotId] as const,
    enabled: lotId !== null,
    /* 공유계약 C-6 - 재고는 판정에 쓰는 값이라 캐시하지 않는다. */
    staleTime: 0,
    gcTime: 0,
    queryFn: async () => {
      if (lotId === null) {
        throw new Error('LOT 을 스캔하기 전에는 재고를 조회하지 않습니다.');
      }

      const data = await runRequest(() =>
        client.GET('/inventory/balances', {
          params: { query: { lotId, groupBy: 'LOCATION', includeZero: false } },
        }),
      );

      return data.items;
    },
  });
};

/** 반출됐으나 아직 도착하지 않은 이동과 그 라인. */
export interface UnfinishedTransfer {
  transfer: StockTransfer;
  lines: StockTransferLine[];
}

/**
 * 반쪽만 저장된 이동.
 *
 * 반출과 도착 사이에 그만두거나 앱이 꺼지면 그 상태가 남는데, 데이터베이스가 막지 않는다.
 * 진입에서 보이지 않으면 작업자는 같은 물건을 또 반출한다.
 */
export const useUnfinishedTransfers = (): UseQueryResult<UnfinishedTransfer[]> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: ['stock-transfer-unfinished'] as const,
    /*
     * 공유계약 C-6 - 판정에 쓰는 값은 캐시하지 않는다. 다른 단말이 방금 도착시킨 것을 낡은
     * 목록으로 보이면 이미 끝난 이동을 또 끝내려 든다.
     */
    staleTime: 0,
    gcTime: 0,
    queryFn: async () => {
      const found = await runRequest(() =>
        client.GET('/logistics/stock-transfers', {
          params: { query: { inTransitOnly: true, size: 20 } },
        }),
      );

      return Promise.all(
        found.items.map(async (transfer) => {
          const lines = await runRequest(() =>
            client.GET('/logistics/stock-transfers/{stockTransferId}/lines', {
              params: { path: { stockTransferId: transfer.stockTransferId } },
            }),
          );

          return { transfer, lines: lines.items };
        }),
      );
    },
  });
};
