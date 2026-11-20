import type { ApiClient } from '@omf-mes/api-client';
import { useQueries, useQuery, type UseQueryResult } from '@tanstack/react-query';

import { useApiClient } from '../../patterns/api-context';
import { runRequest, runRequestWithResponse } from '../../patterns/request';
import { useMasterWrite, type MasterWriteResult } from '../../patterns/master';
import type { components } from '@omf-mes/api-client';
import type { ShipmentFilterQuery } from './filters';
import type { PeriodQuery } from './period';
import type { SortQuery } from './sort';
import { toShipmentRequestView, type ShipmentScheduleListResult } from './types';

/**
 * 이 화면의 읽기 — **오퍼레이션이 하나뿐이다.** 상세(`GET /logistics/shipment-requests/{id}`)는
 * 부르지 않는다 — 이 슬라이스는 행 클릭 이동이 없어(계획서 미결 항목) 상세로 갈 경로가 없다.
 *
 * 경로 리터럴은 이 파일에만 둔다 — `openapi-fetch`가 경로를 리터럴 타입으로 요구해 문자열
 * 변수로 넘기면 타입 검사가 풀린다.
 *
 * **쓰기 오퍼레이션이 없다.** 이 슬라이스는 조회 전용이다.
 */

type Client = ApiClient['client'];

/**
 * 목록 조회의 쿼리 전체. **채운 조건만 키가 실린다.**
 *
 * `size`는 싣지 않는다. 서버 기본값을 그대로 쓰고 쪽 크기를 화면이 정하지 않는다.
 */
export type ShipmentScheduleListQuery = PeriodQuery &
  ShipmentFilterQuery &
  SortQuery & {
    /** 첫 쪽이면 싣지 않는다 — 서버 기본값이 1이다. */
    page?: number;
  };

export const shipmentScheduleKeys = {
  all: ['shipment-schedule'] as const,
  list: (query: ShipmentScheduleListQuery | null) => ['shipment-schedule', 'list', query] as const,
  detail: (shipmentRequestId: number | null) =>
    ['shipment-schedule', 'detail', shipmentRequestId] as const,
};

const shipmentRequestDetailPath = (
  shipmentRequestId: number,
): '/logistics/shipment-requests/{shipmentRequestId}' =>
  '/logistics/shipment-requests/{shipmentRequestId}';

const fetchShipmentSchedule = async (
  client: Client,
  query: ShipmentScheduleListQuery,
): Promise<ShipmentScheduleListResult> => {
  const data = await runRequest(() =>
    client.GET('/logistics/shipment-requests', { params: { query } }),
  );

  return { items: data.items.map(toShipmentRequestView), page: data.page };
};

/**
 * 출하 예정 목록.
 *
 * **출하일 시작이 없으면 부르지 않는다**(공유계약 L-3, 계약이 `shipDateFrom`을 필수로 표시).
 * `query`가 `null`이면 그 상태다 — W-01-09(기간이 선택이라 빈 값으로도 부른다)와 반대다.
 */
export const useShipmentScheduleList = (
  query: ShipmentScheduleListQuery | null,
): UseQueryResult<ShipmentScheduleListResult> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: shipmentScheduleKeys.list(query),
    enabled: query !== null,
    queryFn: async () => {
      if (query === null) {
        throw new Error('출하일 시작 없이는 목록을 조회하지 않습니다.');
      }

      return fetchShipmentSchedule(client, query);
    },
  });
};

export const useShipmentRequestDetail = (shipmentRequestId: number | null) => {
  const { client, etags } = useApiClient();
  return useQuery({
    queryKey: shipmentScheduleKeys.detail(shipmentRequestId),
    enabled: shipmentRequestId !== null,
    queryFn: async () => {
      if (shipmentRequestId === null) throw new Error('선택한 출하작업지시가 없습니다.');
      const { data, response } = await runRequestWithResponse(() =>
        client.GET('/logistics/shipment-requests/{shipmentRequestId}', {
          params: { path: { shipmentRequestId } },
        }),
      );
      const etag = response.headers.get('ETag');
      if (etag !== null) etags.capture(shipmentRequestDetailPath(shipmentRequestId), etag);
      return data;
    },
  });
};

/**
 * 피처 010 — 상세 창 · 인쇄의 품목 표기(「코드 이름」). 지시서 라인은 품목 번호만 실어 번호로
 * 하나씩 푼다(`GET /mdm/items/{itemId}`). 같은 품목은 한 번만 묻는다. 못 풀면 `null` — 화면이
 * 번호를 대신 적는다.
 */
export const useItemLabels = (itemIds: readonly number[]): ((itemId: number) => string | null) => {
  const { client } = useApiClient();
  const uniqueIds = [...new Set(itemIds)];

  const results = useQueries({
    queries: uniqueIds.map((itemId) => ({
      queryKey: ['shipment-schedule', 'item', itemId] as const,
      queryFn: async () => {
        const data = await runRequest(() =>
          client.GET('/mdm/items/{itemId}', { params: { path: { itemId } } }),
        );
        return `${data.item.itemCode} ${data.item.itemName}`;
      },
    })),
  });

  const labels = new Map<number, string>();
  uniqueIds.forEach((itemId, index) => {
    const label = results[index]?.data;
    if (label !== undefined) labels.set(itemId, label);
  });

  return (itemId) => labels.get(itemId) ?? null;
};
