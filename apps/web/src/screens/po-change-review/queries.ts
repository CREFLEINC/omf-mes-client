import type { components } from '@omf-mes/api-client';
import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { useApiClient } from '../../patterns/api-context';
import { runRequest } from '../../patterns/request';
import {
  toAffectedWorkOrder,
  toChangeNotification,
  type AffectedWorkOrder,
  type ChangeNotification,
} from './types';

type PageMeta = components['schemas']['PageMeta'];

/**
 * 이 화면의 읽기. 쓰기(`:acknowledge`)는 `mutations.ts`가 갖는다.
 *
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 파일을 참조하지 않는다.
 */

const PAGE_SIZE = 50;

export const poChangeKeys = {
  all: ['po-change-review'] as const,
  notifications: () => ['po-change-review', 'notifications'] as const,
  detail: (productionOrderId: number | null) =>
    ['po-change-review', 'detail', productionOrderId] as const,
  workOrders: (productionOrderId: number | null) =>
    ['po-change-review', 'work-orders', productionOrderId] as const,
};

export interface NotificationListResult {
  items: ChangeNotification[];
  page: PageMeta;
}

/**
 * ① 변경 알림 목록 — **미확인 P/O.**
 *
 * ⭐ **서버가 「확인한 뒤 ERP 가 또 보낸」 건까지 포함해 내린다** — 계약이 `unacknowledgedOnly`
 * 를 「확인 시각이 비어 있**거나** 마지막 변경 수신이 그 뒤인 것」으로 정의한다. 그 둘째 갈래가
 * **이 화면이 존재하는 이유** 자체다.
 *
 * ⛔ **연계 원문(`/integration/messages`)을 부르지 않는다** — 전산담당 전용이라 업무 화면에
 * 열려 있지 않다(공유계약 B-4-1 ④ · 요구서 §3-6). 연계 원문은 연계 동기화 현황 화면 소관이다.
 */
export const useChangeNotifications = (): UseQueryResult<NotificationListResult> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: poChangeKeys.notifications(),
    queryFn: async () => {
      const data = await runRequest(() =>
        client.GET('/planning/production-orders', {
          /* ⭐ withLastChange — 「무엇이 몇에서 몇으로」는 이 축으로만 온다. 행마다 따로 부르지 않는다. */
          params: {
            query: { unacknowledgedOnly: true, withLastChange: true, page: 1, size: PAGE_SIZE },
          },
        }),
      );

      return { items: data.items.map(toChangeNotification), page: data.page };
    },
  });
};

/**
 * 고른 P/O 의 상세.
 *
 * ⭐ **값을 쓰려는 것이 아니라 잠금 토큰을 받으려고 부른다** — `:acknowledge` 가 `If-Match` 를
 * 필수로 받고, 그 토큰은 이 조회의 ETag 응답 헤더로만 온다(공유계약 B-1-1).
 */
export const useProductionOrderDetail = (
  productionOrderId: number | null,
): UseQueryResult<ChangeNotification> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: poChangeKeys.detail(productionOrderId),
    enabled: productionOrderId !== null,
    queryFn: async () => {
      if (productionOrderId === null)
        throw new Error('P/O를 고르기 전에는 상세를 조회하지 않습니다.');

      return toChangeNotification(
        await runRequest(() =>
          client.GET('/planning/production-orders/{productionOrderId}', {
            params: { path: { productionOrderId }, query: { withLastChange: true } },
          }),
        ),
      );
    },
  });
};

/** 잠금 토큰을 꺼낼 자리. 보관소가 응답 URL 경로로 키를 잡으므로 같은 모양을 만든다(B-1). */
export const productionOrderPath = (productionOrderId: number): string =>
  `/planning/production-orders/${String(productionOrderId)}`;

/**
 * ③ 영향 받는 W/O.
 *
 * ⭐ **`withProgress` 를 켠다** — 「실적 1,200 ⚠ 이미 생산됨」이 그것 없이는 그려지지 않고,
 * 그 경고가 이 화면의 판단 근거다(§6).
 *
 * ⚠ 단건이 아니라 **목록**이다 — 한 P/O 가 여러 W/O 로 전개된다.
 */
export const useAffectedWorkOrders = (
  productionOrderId: number | null,
): UseQueryResult<AffectedWorkOrder[]> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: poChangeKeys.workOrders(productionOrderId),
    enabled: productionOrderId !== null,
    queryFn: async () => {
      if (productionOrderId === null) {
        throw new Error('P/O를 고르기 전에는 영향 W/O를 조회하지 않습니다.');
      }

      const data = await runRequest(() =>
        client.GET('/production/work-orders', {
          params: {
            query: { productionOrderId, withProgress: true, page: 1, size: PAGE_SIZE },
          },
        }),
      );

      return data.items.map(toAffectedWorkOrder);
    },
  });
};
