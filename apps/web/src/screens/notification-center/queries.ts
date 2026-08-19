import type { ApiClient, ApiError } from '@omf-mes/api-client';
import { useMutation, useQuery, useQueryClient, type UseQueryResult } from '@tanstack/react-query';
import { useCallback, useRef, useState } from 'react';

import { useApiClient } from '../../patterns/api-context';
import { runRequest, toApiError } from '../../patterns/request';
import type { NotificationFilterQuery } from './filters';
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
 * 기간 두 값은 계약이 필수로 두어 **늘 실리고**, 나머지는 **고른 것만 키가 실린다** —
 * 요청 URL이 조건을 그대로 드러내야 무엇으로 조회했는지 읽을 수 있다.
 *
 * `size`는 싣지 않는다. 서버 기본값을 그대로 쓰고 쪽 크기를 화면이 정하지 않는다 —
 * 화면이 상수를 심으면 서버 기본이 바뀔 때 두 값이 갈려 범위 표기가 실제 응답과 어긋난다.
 */
export type NotificationListQuery = PeriodQuery &
  NotificationFilterQuery & {
    /** 첫 쪽이면 싣지 않는다 — 서버 기본값이 1이다. */
    page?: number;
  };

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

/**
 * 안 읽은 알림 수 — **「모두 읽음」의 활성 판정에만 쓴다.**
 *
 * ⛔ **목록을 세지 않는다.** 지금 쪽에 보이는 안 읽음으로 판정하면 다른 쪽에 안 읽음이 있어도
 * 버튼이 잠긴다 — 「모두」라는 말과 정면으로 어긋나는 **틀린 판정**이다. 전용 경로가 있는
 * 이유가 그것이다.
 *
 * ⚠ **셸의 종 배지는 이 회차에 만들지 않는다**(결정 ②). 경로를 쓰는 것과 상단 바에 배지를
 * 그리는 것은 다른 일이다 — 배지는 셸의 책임이고 갱신 주기가 아직 정해지지 않았다.
 */
export const unreadCountKey = ['notifications', 'unread-count'] as const;

export const useUnreadCount = (): UseQueryResult<number> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: unreadCountKey,
    queryFn: async () => {
      const data = await runRequest(() => client.GET('/app/notifications/unread-count'));

      return data.unreadCount;
    },
  });
};

/** 되돌아온 값에서 갈래를 꺼낸다. 우리가 던진 것이 아니면 통신 실패로 오인시키지 않는다. */
const toWriteError = (cause: unknown): ApiError => toApiError(cause);

export interface MarkReadMutation {
  /** 읽음으로 바꾼다. **나가는 중인 번호가 있으면 받지 않는다** */
  markRead: (notificationId: number) => void;
  /** 지금 나가는 중인 번호. `null`이면 나가는 중이 아니다 — 그 카드 하나만 잠근다 */
  pendingId: number | null;
  error: ApiError | null;
  /** 진행 중이 아닐 때만 되돌린다 — 사본 체크리스트의 `resetIfIdle` 규율 */
  resetIfIdle: () => void;
}

export interface MarkReadOptions {
  /** 성공. **번호를 넘긴다** — 화면이 그 번호를 읽음 집합에 더한다 */
  onSuccess: (notificationId: number) => void;
}

/** 한 번의 시도. **멱등 키를 번호와 함께 나른다** — 재시도가 새 키를 얻으면 다른 요청이 된다. */
interface MarkReadAttempt {
  notificationId: number;
  idempotencyKey: string;
}

/**
 * 알림 하나를 읽음으로 바꾼다.
 *
 * ⭐ **성공해도 목록을 무효화하지 않는다**(결정 ⑤ · `read-state.ts`). 전례의 쓰기 훅
 * (`patterns/master/use-master-write.ts`)은 `invalidateKeys`를 기본으로 두는데, 그 형태가 참인
 * 이유는 **그 화면들의 목록에서 저장으로 행이 사라지지 않기 때문**이다. 여기서는 기본 조건이
 * 「안 읽음만」이라 무효화가 곧 **방금 누른 카드의 사라짐**이고, 캐시 키가 바뀌면 목록 구획이
 * 통째로 다시 서서 앞 회차가 세운 DOM 보증(T1-7)까지 무너진다(실측).
 *
 * **공통 쓰기 훅을 쓰지 않는 이유**도 같다 — 그쪽은 무효화·ETag·필드 오류 분해를 전제로 하는데
 * 이 쓰기에는 셋 다 없다(낙관적 잠금 없음 · 인라인 낼 칸 없음).
 *
 * ⭐ **나가는 중인 번호를 하나만 든다.** 사용자가 카드를 연달아 누를 수 있는 화면이라, 진행
 * 상태를 불리언 하나로 두면 **모든 카드가 함께 잠긴다.** 번호를 들면 그 카드만 잠긴다.
 */
export const useMarkRead = (options: MarkReadOptions): MarkReadMutation => {
  const { client } = useApiClient();
  const [error, setError] = useState<ApiError | null>(null);

  const mutation = useMutation({
    mutationFn: async (attempt: MarkReadAttempt): Promise<void> => {
      await runRequest<void>(() =>
        client.POST('/app/notifications/{notificationId}:read', {
          params: {
            header: { 'Idempotency-Key': attempt.idempotencyKey },
            path: { notificationId: attempt.notificationId },
          },
        }),
      );
    },
  });

  const markRead = (notificationId: number): void => {
    /*
     * 나가는 중에는 새 요청을 받지 않는다. 화면이 그 카드를 잠그지만 **훅도 같은 겹을 갖는다** —
     * 진행 중 번호가 하나뿐이라, 겹치면 어느 카드의 성공인지 가릴 수 없게 된다.
     */
    if (mutation.isPending) return;

    setError(null);

    mutation.mutate(
      { notificationId, idempotencyKey: crypto.randomUUID() },
      {
        onSuccess: () => {
          options.onSuccess(notificationId);
        },
        onError: (cause) => {
          setError(toWriteError(cause));
        },
      },
    );
  };

  /**
   * **나가는 중인 쓰기는 건드리지 않는다**(사본 체크리스트 · `omf-mes#96`).
   *
   * 진행 중 mutation의 `reset()`은 그 호출에 매달린 되먹임을 통째로 끊는다 — 서버는 읽음으로
   * 바꿨는데 화면은 없던 일로 친다. 그러면 그 알림은 **안 읽음으로 보이는데 다시 눌러도
   * 아무 일도 일어나지 않는** 상태가 된다(서버에는 이미 읽음이다).
   *
   * ⭐ **참조가 렌더 사이에 유지돼야 한다.** 이 함수는 **effect에서도 불린다**(조건이 바뀌면
   * 앞 조회에 매인 진술을 거둔다 — `screen.tsx`). 렌더마다 새 함수를 만들면 그 effect의
   * 의존성이 매번 달라져 **거둠 → 재렌더 → 거둠**이 멈추지 않는다(실측으로 한 번 겪었다).
   * 진행 여부는 참조로 읽어 이 함수가 그 값에 매이지 않게 한다.
   */
  const { reset } = mutation;
  const isPendingRef = useRef(mutation.isPending);
  isPendingRef.current = mutation.isPending;

  const resetIfIdle = useCallback((): void => {
    if (isPendingRef.current) return;

    setError(null);
    reset();
  }, [reset]);

  return {
    markRead,
    pendingId: mutation.isPending ? mutation.variables.notificationId : null,
    error,
    resetIfIdle,
  };
};

export interface MarkAllReadMutation {
  markAllRead: () => void;
  isSubmitting: boolean;
  error: ApiError | null;
  resetIfIdle: () => void;
}

export interface MarkAllReadOptions {
  /** 성공. **바꾼 건수를 넘긴다** — 화면이 그 수를 알림으로 낸다 */
  onSuccess: (readCount: number) => void;
}

/**
 * 안 읽은 알림을 전부 읽음으로 바꾼다.
 *
 * ⭐ **여기서는 무효화한다 — 읽음 처리 하나와 반대다.** 사용자가 「전부 읽음으로 바꾼다」를
 * 명시적으로 눌렀으므로 안 읽음 목록이 비는 것이 **그 조작의 결과 그대로**다. 카드 하나를
 * 누른 것과 달리 「방금 누른 그 카드」가 없어 잃을 자리도 없다.
 *
 * 안 읽은 수도 함께 무효화한다 — 그 값이 곧 이 버튼의 활성 조건이라, 두지 않으면 눌러도
 * 열린 채로 남는다.
 */
export const useMarkAllRead = (options: MarkAllReadOptions): MarkAllReadMutation => {
  const { client } = useApiClient();
  const queryClient = useQueryClient();
  const [error, setError] = useState<ApiError | null>(null);

  const mutation = useMutation({
    mutationFn: (idempotencyKey: string): Promise<{ readCount: number }> =>
      runRequest(() =>
        client.POST('/app/notifications:read-all', {
          params: { header: { 'Idempotency-Key': idempotencyKey } },
        }),
      ),
  });

  const markAllRead = (): void => {
    if (mutation.isPending) return;

    setError(null);

    mutation.mutate(crypto.randomUUID(), {
      onSuccess: (data) => {
        void queryClient.invalidateQueries({ queryKey: notificationKeys.all });
        options.onSuccess(data.readCount);
      },
      onError: (cause) => {
        setError(toWriteError(cause));
      },
    });
  };

  /**
   * 위 `useMarkRead`와 같은 규율 — 나가는 중인 쓰기의 되먹임을 끊지 않는다.
   * 참조를 유지하는 이유도 같다(effect에서 불린다).
   */
  const { reset } = mutation;
  const isPendingRef = useRef(mutation.isPending);
  isPendingRef.current = mutation.isPending;

  const resetIfIdle = useCallback((): void => {
    if (isPendingRef.current) return;

    setError(null);
    reset();
  }, [reset]);

  return {
    markAllRead,
    isSubmitting: mutation.isPending,
    error,
    resetIfIdle,
  };
};
