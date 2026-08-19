import type { ApiClient } from '@omf-mes/api-client';
import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { useApiClient } from '../../patterns/api-context';
import { runRequest } from '../../patterns/request';
import type { PeriodQuery } from './period';
import { toNotificationView, type NotificationListResult } from './types';

/**
 * 이 화면의 읽기.
 *
 * 경로 리터럴은 이 파일에만 둔다 — `openapi-fetch`가 경로를 리터럴 타입으로 요구해
 * 문자열 변수로 넘기면 타입 검사가 풀린다.
 *
 * ⚠ **자동 갱신을 두지 않는다**(공유계약 L-6). 목록이 저 혼자 바뀌면 사용자가 읽던 카드가
 * 눈앞에서 자리를 옮긴다. 새 알림은 사용자가 다시 조회할 때 온다.
 *
 * ⭐ **L-6의 각주는 이 화면을 실시간 예외로 지목한다** — 그대로 읽으면 여기에 폴링을 넣게 된다.
 * 그러나 나중 판인 화면 스펙 §8-4와 계약이 「화면은 자동 갱신 없음 · 셸 배지만 화면 전환 시
 * 갱신」으로 정리했고, 나중 판을 따랐다. 두 문서의 어긋남은 질문 `omf-mes#164`로 추적 중이다 —
 * **각주만 보고 되돌리지 말고 그 답을 먼저 확인한다.**
 */

type Client = ApiClient['client'];

/**
 * 목록 조회의 쿼리 전체.
 *
 * 지금은 기간이 전부다 — 계약이 필수로 둔 두 값이라 **늘 실린다.** 뒤따르는 회차가
 * 「안 읽음/전체」·「유형」·쪽을 더한다. 그 셋은 선택이므로 **채운 것만 키가 실린다.**
 *
 * `size`는 싣지 않는다. 서버 기본값을 그대로 쓰고 쪽 크기를 화면이 정하지 않는다 —
 * 화면이 상수를 심으면 서버 기본이 바뀔 때 두 값이 갈려 범위 표기가 실제 응답과 어긋난다.
 */
export type NotificationListQuery = PeriodQuery;

export const notificationKeys = {
  all: ['notifications'] as const,
  list: (query: NotificationListQuery | null) => ['notifications', 'list', query] as const,
};

const fetchNotifications = async (
  client: Client,
  query: NotificationListQuery,
): Promise<NotificationListResult> => {
  const data = await runRequest(() => client.GET('/app/notifications', { params: { query } }));

  return { items: data.items.map(toNotificationView), page: data.page };
};

/**
 * 알림 목록.
 *
 * ⭐ **기간이 없으면 조회 자체가 성립하지 않는다.** 계약이 두 값을 필수로 두었다 — 조건 없이
 * 부르면 400이다. 그래서 다른 조회 화면과 달리 「조건이 없어도 조회한다」가 여기서는 거짓이고,
 * 대신 화면이 **기본 기간을 심는다.**
 *
 * `null`은 **보낼 수 없는 기간**에서만 온다(없는 날짜·뒤집힘·한쪽만 채움).
 * 그때는 조회하지 않고 화면이 사유를 밝힌다.
 */
export const useNotificationList = (
  query: NotificationListQuery | null,
): UseQueryResult<NotificationListResult> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: notificationKeys.list(query),
    enabled: query !== null,
    queryFn: () => {
      if (query === null) {
        throw new Error('보낼 수 없는 기간에서는 알림 목록을 조회하지 않습니다.');
      }

      return fetchNotifications(client, query);
    },
  });
};
