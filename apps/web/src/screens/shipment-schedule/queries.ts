import type { ApiClient } from '@omf-mes/api-client';
import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { useApiClient } from '../../patterns/api-context';
import { runRequest } from '../../patterns/request';
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
};

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
    queryFn: () => {
      if (query === null) {
        throw new Error('출하일 시작 없이는 목록을 조회하지 않습니다.');
      }

      return fetchShipmentSchedule(client, query);
    },
  });
};
