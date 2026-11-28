import type { components } from '@omf-mes/api-client';
import { useMutation, useQuery } from '@tanstack/react-query';

import { useApiClient } from '../../patterns/api-context';
import { runRequest } from '../../patterns/request';
import type { MaterialReturnLotLookup } from './lines';

/**
 * P-01-03 반납 입고의 읽기(피처 019 · contracts §1~§3).
 *
 * | 무엇 | 경로 |
 * | --- | --- |
 * | LOT 스캔 조회 — 품목 · 단위 · 반납 가능 · 출고 생산창고 · 라벨 미발행 | `GET /production/material-returns/lot-lookup` |
 * | W/O 로 찾기 — 반납할 양이 남은 W/O(최근 출고 순) | `GET /production/material-returns/work-orders` |
 * | W/O 로 찾기 — 그 W/O 의 자재 LOT(미발행 먼저) | `GET /production/material-returns/work-orders/{id}/lots` |
 * | 이 단말의 창고 — 받는 곳 칩 「적치 대기」 / 「다른 창고」 | `GET /mdm/terminals/{terminalId}` |
 *
 * 경로 리터럴은 이 파일(과 `mutations.ts`)에만 둔다 — `openapi-fetch` 가 경로를 리터럴 타입으로 요구한다.
 */

export type ReturnWorkOrder = components['schemas']['MaterialReturnWorkOrder'];
export type ReturnWorkOrderLot = components['schemas']['MaterialReturnWorkOrderLot'];

export const materialReturnKeys = {
  all: ['material-return'] as const,
  workOrders: (query: string) => ['material-return', 'work-orders', query] as const,
  workOrderLots: (workOrderId: number) =>
    ['material-return', 'work-orders', workOrderId, 'lots'] as const,
  terminal: (terminalId: number) => ['material-return', 'terminal', terminalId] as const,
};

/** W/O 목록 한 쪽 — 반납이 남은 W/O 는 하루 수십 건이라 한 쪽으로 받는다. */
export const WORK_ORDER_PAGE_SIZE = 50;

/**
 * 스캔 조회. 같은 번호를 다시 스캔하면 «다시» 읽는다(그사이 다른 단말이 반납했을 수 있다) — 그래서 캐시를 쓰는
 * 조회가 아니라 `useMutation` 이다(P-04-08 `:lookup` 과 같은 까닭).
 */
export const useReturnLookup = () => {
  const { client } = useApiClient();

  return useMutation({
    mutationFn: (lotNo: string): Promise<MaterialReturnLotLookup> =>
      runRequest(() =>
        client.GET('/production/material-returns/lot-lookup', { params: { query: { lotNo } } }),
      ),
  });
};

/** 이 단말의 창고(없으면 공장 전체 단말 — `null`). 받는 곳 칩만 이 값을 쓴다. */
export const useTerminalWarehouse = (terminalId: number | null) => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: materialReturnKeys.terminal(terminalId ?? 0),
    enabled: terminalId !== null,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const terminal = await runRequest(() =>
        client.GET('/mdm/terminals/{terminalId}', {
          params: { path: { terminalId: terminalId ?? 0 } },
        }),
      );

      return {
        warehouseId: terminal.warehouseId ?? null,
        warehouseName: terminal.warehouseName ?? null,
      };
    },
  });
};

/** W/O 로 찾기 ① — 반납할 양이 남은 W/O, 최근 출고 순(서버 정렬). `query` 는 W/O 번호 일부. */
export const useReturnWorkOrders = (query: string, enabled: boolean) => {
  const { client } = useApiClient();
  const q = query.trim();

  return useQuery({
    queryKey: materialReturnKeys.workOrders(q),
    enabled,
    queryFn: () =>
      runRequest(() =>
        client.GET('/production/material-returns/work-orders', {
          params: {
            query: { ...(q === '' ? {} : { q }), page: 1, size: WORK_ORDER_PAGE_SIZE },
          },
        }),
      ),
  });
};

/** W/O 로 찾기 ② — 그 W/O 가 가장 최근 출고인 자재 LOT 중 반납 가능 > 0(미발행 먼저 · 서버 정렬). */
export const useReturnWorkOrderLots = (workOrderId: number | null) => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: materialReturnKeys.workOrderLots(workOrderId ?? 0),
    enabled: workOrderId !== null,
    queryFn: async () => {
      const data = await runRequest(() =>
        client.GET('/production/material-returns/work-orders/{workOrderId}/lots', {
          params: { path: { workOrderId: workOrderId ?? 0 } },
        }),
      );

      return data.items;
    },
  });
};
