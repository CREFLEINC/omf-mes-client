import type { components } from '@omf-mes/api-client';
import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { useApiClient } from '../../patterns/api-context';
import { runRequest } from '../../patterns/request';
import type { ConfirmListQuery } from './filters';
import { toShipmentRow, type ShipmentRow } from './types';

type PageMeta = components['schemas']['PageMeta'];

/**
 * 이 화면의 읽기. 쓰기(`:confirm`·`:request-cancel`)는 `mutations.ts`가 갖는다.
 *
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 파일을 참조하지 않는다.
 */

export const shipmentConfirmKeys = {
  all: ['shipment-confirm'] as const,
  list: (query: ConfirmListQuery | null) =>
    ['shipment-confirm', 'list', query === null ? null : { ...query }] as const,
};

export interface ShipmentListResult {
  items: ShipmentRow[];
  page: PageMeta;
}

/**
 * 미확정 출하 목록.
 *
 * ⭐ `unconfirmedOnly` 를 서버에 실는다 — 계약이 「미확정만 — W-04-12 기본」으로 그 축을 두었다.
 * 화면이 받아서 거르면 쪽 단위 목록의 앞쪽만 훑게 된다(공유계약 L-11).
 *
 * ⚠ **기간이 없으면 부르지 않는다**(L-3) — 계약이 출하일 시작을 필수로 표시한다.
 */
export const useUnconfirmedShipments = (
  query: ConfirmListQuery | null,
): UseQueryResult<ShipmentListResult> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: shipmentConfirmKeys.list(query),
    enabled: query !== null,
    queryFn: async () => {
      if (query === null) throw new Error('기간 없이는 미확정 출하를 조회하지 않습니다.');

      const data = await runRequest(() =>
        client.GET('/logistics/shipments', { params: { query } }),
      );

      return { items: data.items.map(toShipmentRow), page: data.page };
    },
  });
};

/**
 * 확정에 실을 낙관적 잠금 토큰을 확보한다.
 *
 * ⭐ **상세 GET 이 ETag 를 내리고 보관소가 그것을 경로로 붙든다** — 계약이 「그 쓰기가 «잠그는
 * 대상»의 조회가 내려주는 ETag」라고 못박았고, 목록 응답에는 건별 ETag 가 없다(HTTP 가 그렇다).
 * 그래서 **확정 한 건마다 상세를 먼저 읽는다.**
 *
 * ⚠ 다건 확정이 요청 2N 번이 되는 이유가 이것이다. 줄이려면 계약이 목록에 판 번호를 실어
 * 주거나 일괄 확정 오퍼레이션을 내야 한다.
 */
export const shipmentDetailPath = (shipmentId: number): string =>
  `/logistics/shipments/${String(shipmentId)}`;

/**
 * 고른 한 건의 상세.
 *
 * ⭐ **값을 쓰려고 부르는 것이 아니라 토큰을 받으려고 부른다** — 취소 요청도 `If-Match` 가
 * 필수인데, 그 토큰은 이 조회의 ETag 응답 헤더로만 온다. 부르지 않으면 요청이 나가지 못한다.
 */
export const useShipmentDetail = (shipmentId: number | null): UseQueryResult<ShipmentRow> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: ['shipment-confirm', 'detail', shipmentId] as const,
    enabled: shipmentId !== null,
    queryFn: async () => {
      if (shipmentId === null) throw new Error('출하를 고르기 전에는 상세를 조회하지 않습니다.');

      return toShipmentRow(
        await runRequest(() =>
          client.GET('/logistics/shipments/{shipmentId}', { params: { path: { shipmentId } } }),
        ),
      );
    },
  });
};
