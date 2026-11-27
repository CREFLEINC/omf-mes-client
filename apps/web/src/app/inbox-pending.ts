import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';
import { useLocation } from 'react-router';

import { useApiClient } from '../patterns/api-context';
import { runRequest } from '../patterns/request';
import { inboxKeys, PENDING_COUNT_SIZE } from '../screens/approval-inbox/queries';
import { notificationKeys } from '../screens/notification-center/queries';

export const APPROVAL_INBOX_PATH = '/approval/inbox';
export const NOTIFICATION_CENTER_PATH = '/notification/center';

const INBOX_PENDING_INTERVAL_MS = 60_000;

/**
 * 사이드바 「결재함」의 대기 수(#361) — 지금 내가 결재할 차례인 요청 수.
 *
 * 결재함 화면의 「내 결재 대기」 탭 숫자와 **같은 열쇠 · 같은 응답 모양**을 쓴다 — 결재하면 그 화면이 이 열쇠를
 * 무효화해 메뉴 숫자도 함께 줄어든다. 화면을 옮길 때와 1분마다 다시 센다(검사 대기 수와 같다).
 */
export const useApprovalPendingCount = (enabled: boolean): number | undefined => {
  const { client } = useApiClient();
  const { pathname } = useLocation();
  const query = useQuery({
    queryKey: inboxKeys.pendingCount(),
    enabled,
    refetchInterval: INBOX_PENDING_INTERVAL_MS,
    queryFn: () =>
      runRequest(() =>
        client.GET('/app/approval-requests', {
          params: { query: { myTurnOnly: true, size: PENDING_COUNT_SIZE } },
        }),
      ),
  });
  const { refetch } = query;

  useEffect(() => {
    if (enabled) void refetch();
  }, [enabled, pathname, refetch]);

  return enabled ? query.data?.page.total : undefined;
};

/**
 * 사이드바 「알림센터」의 미확인 알림 수(#361). 알림센터 화면의 「모두 확인」 판정과 **같은 열쇠 · 같은 경로**라
 * 읽음 처리로 그 열쇠가 무효화되면 메뉴 숫자도 함께 줄어든다. 화면을 옮길 때와 1분마다 다시 센다.
 */
export const useNotificationUnreadCount = (enabled: boolean): number | undefined => {
  const { client } = useApiClient();
  const { pathname } = useLocation();
  const query = useQuery({
    queryKey: notificationKeys.unreadCount,
    enabled,
    refetchInterval: INBOX_PENDING_INTERVAL_MS,
    queryFn: async () =>
      (await runRequest(() => client.GET('/app/notifications/unread-count'))).unreadCount,
  });
  const { refetch } = query;

  useEffect(() => {
    if (enabled) void refetch();
  }, [enabled, pathname, refetch]);

  return enabled ? query.data : undefined;
};
