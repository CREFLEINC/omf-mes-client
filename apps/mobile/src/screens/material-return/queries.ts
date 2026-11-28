import type { components } from '@omf-mes/api-client';
import { useMutation, useQuery } from '@tanstack/react-query';

import { useApiClient } from '../../patterns/api-context';
import { runRequest } from '../../patterns/request';

/**
 * M-01-15 반납 입고의 서버 호출(피처 019 · contracts §1~§4).
 *
 * | 무엇 | 경로 |
 * | --- | --- |
 * | LOT 스캔 조회 | `GET /production/material-returns/lot-lookup` |
 * | 위치 스캔 — 코드로 한 건 | `GET /mdm/locations?locationCode=` |
 * | 반납 입고(LOT 하나) | `POST /production/material-returns` |
 * | W/O 로 찾기 — W/O 목록 · 그 W/O 의 LOT | `GET /production/material-returns/work-orders(/{id}/lots)` |
 *
 * 경로 리터럴은 이 파일에만 둔다 — `openapi-fetch` 가 경로를 리터럴 타입으로 요구한다.
 */
export type MaterialReturnLotLookup = components['schemas']['MaterialReturnLotLookup'];
export type MaterialReturnReceive = components['schemas']['MaterialReturnReceive'];
export type MaterialReturn = components['schemas']['MaterialReturn'];
export type ReturnWorkOrder = components['schemas']['MaterialReturnWorkOrder'];
export type ReturnWorkOrderLot = components['schemas']['MaterialReturnWorkOrderLot'];
export type ScannedLocation = components['schemas']['Location'];

export const RETURN_PATH = '/production/material-returns';

/** LOT 스캔 — 스캔마다 «다시» 읽는다(다른 기기가 그사이 반납했을 수 있다). */
export const useReturnLookup = () => {
  const { client } = useApiClient();

  return useMutation({
    mutationFn: (lotNo: string): Promise<MaterialReturnLotLookup> =>
      runRequest(() =>
        client.GET('/production/material-returns/lot-lookup', { params: { query: { lotNo } } }),
      ),
  });
};

/**
 * 위치 스캔 — 위치 코드는 모든 창고를 통틀어 유일해 코드만으로 한 건이 집힌다(계약 `locationCode`). 없으면 null.
 * 놓을 수 있는가(지정 품목만 받기 · 미지정)는 반납을 보낼 때 서버가 판정한다(적치 009 와 같은 판정).
 */
export const useLocationLookup = () => {
  const { client } = useApiClient();

  return useMutation({
    mutationFn: async (locationCode: string): Promise<ScannedLocation | null> => {
      const data = await runRequest(() =>
        client.GET('/mdm/locations', { params: { query: { locationCode } } }),
      );

      return data.items.find((location) => location.locationCode === locationCode) ?? null;
    },
  });
};

export interface SendVariables {
  body: MaterialReturnReceive;
  idempotencyKey: string;
  workerNo: string;
}

/** 반납 입고 한 건(LOT 하나). 같은 키로 다시 보내면 두 번 들어가지 않는다. */
export const useSendReturn = () => {
  const { client } = useApiClient();

  return useMutation({
    mutationFn: ({ body, idempotencyKey, workerNo }: SendVariables): Promise<MaterialReturn> =>
      runRequest(() =>
        client.POST('/production/material-returns', {
          params: { header: { 'Idempotency-Key': idempotencyKey, 'X-Worker-No': workerNo } },
          body,
        }),
      ),
  });
};

/** W/O 로 찾기 ① — 반납할 양이 남은 W/O, 최근 출고 순(서버 정렬). */
export const useReturnWorkOrders = (query: string) => {
  const { client } = useApiClient();
  const q = query.trim();

  return useQuery({
    queryKey: ['material-return', 'work-orders', q],
    queryFn: () =>
      runRequest(() =>
        client.GET('/production/material-returns/work-orders', {
          params: { query: { ...(q === '' ? {} : { q }), page: 1, size: 50 } },
        }),
      ),
  });
};

/** W/O 로 찾기 ② — 그 W/O 의 자재 LOT(미발행 먼저 · 서버 정렬). */
export const useReturnWorkOrderLots = (workOrderId: number | null) => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: ['material-return', 'work-orders', workOrderId, 'lots'],
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
