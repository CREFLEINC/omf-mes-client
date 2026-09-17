/**
 * P-04-05 의 읽기.
 *
 * ⭐ **출하 선택 목록은 서버 축 하나로 선다**(설계 §5-1 · `hasUnassignedPackedBox`).
 *    그 축이 없던 동안은 만들지 않고 기다렸다 — 없이 같은 목록을 만들려면 출하를 받아 전표마다
 *    배분을 묻고 상자 상태를 다시 묻는 N+1 이 되고, 그러고도 「PACKED 상자가 있는가」는
 *    클라이언트 교집합이라 완전하지 않다(검토 B-1). 서버가 축을 내주어 **1회**가 됐다.
 */

import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { useApiClient } from '../../patterns/api-context';
import { runRequest, runRequestWithResponse } from '../../patterns/request';

import type { ComposableShipment, ShippingUnitTypeOption } from './api';
import type { ShippingUnitDetail } from './types';

const ROOT = 'shipping-unit';

/** 유형 코드 그룹 — 고객이 늘린다(설계 §3-4). 화면이 값을 적어 두지 않는다. */
const TYPE_CODE_GROUP = 'SHIPPING_UNIT_TYPE';

/** 한 번에 받아 둘 선택지 수. 유형은 몇 개 규모라 한 쪽으로 충분하다. */
const OPTION_SIZE = 100;

export const shippingUnitKeys = {
  shipments: [ROOT, 'shipments'] as const,
  types: [ROOT, 'types'] as const,
  detail: (shippingUnitId: number | null) => [ROOT, 'detail', shippingUnitId] as const,
};

/**
 * 출하 단위 유형 선택지.
 *
 * ⛔ **값을 화면에 적어 두지 않는다**(공유계약 G-32). 초기값은 `PALLET`·`BUNDLE` 이지만 고객이
 *    늘리는 코드 그룹이라, 적어 두면 늘어난 값이 화면에서 사라진다.
 */
export const useShippingUnitTypes = (): UseQueryResult<ShippingUnitTypeOption[]> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: shippingUnitKeys.types,
    queryFn: async () => {
      const data = await runRequest(() =>
        client.GET('/mdm/code-values', {
          params: { query: { codeGroupCode: TYPE_CODE_GROUP, size: OPTION_SIZE } },
        }),
      );

      return data.items.map((item) => ({ code: item.code, codeName: item.codeName }));
    },
  });
};

/** 상세와 그 판 번호. **둘은 짝이다** — 따로 들고 있으면 낡은 번호로 마감을 건다. */
export interface ShippingUnitSnapshot {
  unit: ShippingUnitDetail;
  /**
   * 낙관적 잠금 토큰(`ETag`). `:close` 가 `If-Match` 로 받는다.
   *
   * ⚠ **쓰기마다 갱신한다.** `:add-box`·`DELETE` 도 판 번호를 올리므로(서버 확정 2026-09-17),
   *   생성할 때 받은 값을 들고 있으면 **마감이 409 로 막힌다.**
   */
  etag: string | null;
}

/**
 * 출하 단위 상세 — **납품 라벨 값을 전부 싣는다**(설계 §4-3).
 *
 * ⛔ **`gcTime: 0`.** 상자를 넣고 빼는 동안 값이 계속 바뀐다 — 캐시가 남으면 다른 단위로 갔다
 *    돌아왔을 때 낡은 목록과 낡은 ETag 를 보인다.
 */
export const useShippingUnitDetail = (
  shippingUnitId: number | null,
): UseQueryResult<ShippingUnitSnapshot> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: shippingUnitKeys.detail(shippingUnitId),
    enabled: shippingUnitId !== null,
    gcTime: 0,
    queryFn: async () => {
      if (shippingUnitId === null) throw new Error('출하 단위 없이 상세를 조회하지 않습니다.');

      const { data, response } = await runRequestWithResponse(() =>
        client.GET('/logistics/shipping-units/{shippingUnitId}', {
          params: { path: { shippingUnitId } },
        }),
      );

      return { unit: data, etag: response.headers.get('ETag') };
    },
  });
};

/** 한 번에 받아 둘 출하 수. 구성할 것이 남은 건만 오므로 많지 않다. */
const SHIPMENT_SIZE = 50;


/**
 * 구성할 것이 남은 출하 — **서버가 걸러 준다.**
 *
 * ⛔ **단말 창고를 보내지 않는다.** POP 단말 호출이면 서버가 그 단말의 공장으로 자동으로
 *    좁힌다(서버 확정 2026-09-17). 단말은 제 창고를 모르고(`VerifiedTerminal` 은 `plantId`·
 *    `locationId` 만 갖는다), `locationId → warehouseId` 로 푸는 경로는 단말 토큰에 401 이다
 *    (ISSUE-QR-01 실측). 보낼 수 있는 값이 애초에 없다.
 *
 * ⚠ **`false` 를 보내지 않는다.** 계약이 「`false` 는 절을 걸지 않는다」로 두었다
 *   (`unconfirmedOnly` 와 같은 관례) — 끄고 싶으면 축을 빼야 하는데 이 화면은 늘 켠다.
 */
export const useComposableShipments = (): UseQueryResult<ComposableShipment[]> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: shippingUnitKeys.shipments,
    queryFn: async () => {
      const data = await runRequest(() =>
        client.GET('/logistics/shipments', {
          /*
           * ⛔ **기간을 주지 않는다.** 「구성할 것이 남았나」는 날짜와 무관한 물음이고, 기간을
           *    강제하면 어제 출하한 건의 남은 상자가 창 밖으로 빠져 이 화면에서 영영 안 보인다.
           *    ⚠ 그래서 `hasUnassignedPackedBox=true` 일 때만 기간이 선택이다 — 축을 끄면
           *    기간은 다시 필수다(서버 e2e L-19 가 양방향을 잠근다).
           */
          params: { query: { hasUnassignedPackedBox: true, size: SHIPMENT_SIZE } },
        }),
      );

      return data.items.map((item) => ({
        shipmentId: item.shipmentId,
        shipmentNo: item.shipmentNo,
        /*
         * ⚠ **목록에서만 채워지는 값이다**(상세는 세지 않는다). 없으면 0 이 아니라 「모른다」에
         *   가깝지만, 이 축으로 걸러 온 목록이라 하나 이상인 것은 서버가 보장한다.
         */
        unassignedPackedBoxCount: item.unassignedPackedBoxCount ?? 0,
      }));
    },
  });
};
