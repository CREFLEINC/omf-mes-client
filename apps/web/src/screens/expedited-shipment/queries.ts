import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { useApiClient } from '../../patterns/api-context';
import { runRequest } from '../../patterns/request';
import { isUsablePeriod, type Period } from './period';
import {
  lineForItem,
  toProductionLotCandidate,
  toShipmentRequestTarget,
  type ProductionLotCandidate,
  type ShipmentRequestTarget,
} from './types';

/**
 * 이 화면의 읽기. 쓰기(`POST /logistics/shipments`)는 `mutations.ts`가 갖는다.
 *
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 파일을 참조하지 않는다.
 */

/** 한 쪽에 받는 건수. 선택칸에 담는 목록이라 넉넉히 받되 무한정 받지는 않는다(공유계약 L-11). */
const PAGE_SIZE = 100;

export const expeditedShipmentKeys = {
  all: ['expedited-shipment'] as const,
  lots: () => ['expedited-shipment', 'lots'] as const,
  targets: (period: Period) => ['expedited-shipment', 'targets', period.from, period.to] as const,
  target: (shipmentRequestId: number | null) =>
    ['expedited-shipment', 'target', shipmentRequestId] as const,
};

export interface PagedResult<Item> {
  items: Item[];
  /** 받은 것보다 더 있는가 — 선택칸이 잘렸다는 사실을 화면이 적어야 한다. */
  truncated: boolean;
}

/**
 * ① 생산 완료분 — **완료됐고 아직 입고 전표에 실리지 않은** LOT.
 *
 * ⭐ **두 축을 서버가 판정한다.** `completed`는 완료 시각이 있고 없고로 갈리므로 상태 코드
 * 문자열을 몰라도 성립하고(공유계약 G-2를 비켜 간다), `unreceivedOnly`가 「창고에 아직 안
 * 들어온」을 가른다 — 이미 입고된 LOT은 정상 출하 흐름으로 가야 한다(§5-7 · 계약 주석).
 *
 * ⛔ **응답을 화면이 다시 거르지 않는다** — 목록이 쪽 단위라 화면이 거르면 「이 쪽에서 걸러낸
 * 것」이 되고 총 건수와 어긋난다(공유계약 L-11 · 계약 주석이 같은 말을 못박았다).
 */
export const useProductionLotCandidates = (): UseQueryResult<
  PagedResult<ProductionLotCandidate>
> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: expeditedShipmentKeys.lots(),
    queryFn: async () => {
      const data = await runRequest(() =>
        client.GET('/trace/lots', {
          params: { query: { completed: true, unreceivedOnly: true, page: 1, size: PAGE_SIZE } },
        }),
      );

      return {
        items: data.items.map(toProductionLotCandidate),
        truncated: data.page.total > data.items.length,
      };
    },
  });
};

/**
 * ② 출하작업지시.
 *
 * ⚠ **품목 축을 서버에 실을 수 없다.** 계약의 이 오퍼레이션에 `itemId` 질의가 없다(실측) —
 * 그래서 §5-7의 「품목이 맞는 것만」을 **화면이 받아서 거른다.** 목록이 쪽 단위라 이 걸러내기는
 * **이번 쪽에 받은 결과 안에서만** 성립하고, 그 사실을 화면이 적는다(공유계약 A-11 · L-11).
 * `W-04-04`가 `pickingCompleteOnly`에서 같은 처리를 했다.
 *
 * ⭐ **`shippableRemainderOnly`는 실을 수 있다** — 출하 잔여가 남은 건만 받아 걸러낼 양을
 * 줄인다. ⛔ `pickingCompleteOnly`는 **싣지 않는다** — 직행은 피킹을 건너뛰므로 그것으로 좁히면
 * 이 화면의 정상 사용처가 통째로 사라진다.
 */
export const useShipmentRequestTargets = (
  period: Period,
): UseQueryResult<PagedResult<ShipmentRequestTarget>> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: expeditedShipmentKeys.targets(period),
    /* 기간이 못 쓸 값이면 부르지 않는다 — 계약이 `shipDateFrom`을 필수로 둔다(L-3). */
    enabled: isUsablePeriod(period),
    queryFn: async () => {
      if (!isUsablePeriod(period)) {
        throw new Error('쓸 수 없는 기간으로는 출하작업지시를 조회하지 않습니다.');
      }

      const data = await runRequest(() =>
        client.GET('/logistics/shipment-requests', {
          params: {
            query: {
              shipDateFrom: period.from,
              shipDateTo: period.to,
              shippableRemainderOnly: true,
              page: 1,
              size: PAGE_SIZE,
            },
          },
        }),
      );

      return {
        items: data.items.map(toShipmentRequestTarget),
        truncated: data.page.total > data.items.length,
      };
    },
  });
};

/**
 * 고른 LOT의 품목과 맞는 라인을 가진 지시만 남긴다.
 *
 * ⚠ **`lines`가 `null`인 건은 남긴다** — 「라인을 못 받았다」와 「맞는 라인이 없다」는 다르고,
 * 못 받은 것을 없는 것으로 접으면 고를 수 있는 지시가 조용히 사라진다. 상세를 부르면 라인이
 * 오므로, 고른 뒤에 맞는 라인이 없으면 그때 사유를 낸다.
 */
export const targetsForItem = (
  targets: readonly ShipmentRequestTarget[],
  itemId: number | null,
): ShipmentRequestTarget[] => {
  if (itemId === null) return [];

  return targets.filter((target) => target.lines === null || lineForItem(target, itemId) !== null);
};

/**
 * 고른 지시의 상세.
 *
 * ⭐ **목록 응답의 라인은 참고용이다** — 계약상 선택 필드라 응답마다 있을 수도 없을 수도 있고,
 * 보낼 본문의 `shipmentRequestLineId`·`uomId`는 이 상세를 정본으로 쓴다.
 */
export const useShipmentRequestTarget = (
  shipmentRequestId: number | null,
): UseQueryResult<ShipmentRequestTarget> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: expeditedShipmentKeys.target(shipmentRequestId),
    enabled: shipmentRequestId !== null,
    queryFn: async () => {
      if (shipmentRequestId === null) {
        throw new Error('출하작업지시를 고르기 전에는 상세를 조회하지 않습니다.');
      }

      return toShipmentRequestTarget(
        await runRequest(() =>
          client.GET('/logistics/shipment-requests/{shipmentRequestId}', {
            params: { path: { shipmentRequestId } },
          }),
        ),
      );
    },
  });
};
