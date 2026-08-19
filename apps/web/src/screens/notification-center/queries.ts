import type { ApiClient, ApiError } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';
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

/**
 * 이 화면의 캐시 키 전부.
 *
 * ⭐ **`all`이 나머지의 접두다.** 「모두 읽음」이 `all` 하나를 무효화하면 목록과 안 읽은 수가
 * **함께** 걸린다 — 그 보증이 상자 밖에 흩어져 있으면 키를 늘리는 사람이 접두를 깨뜨려도
 * 아무 데서도 보이지 않는다. 새 키는 반드시 `['notifications', …]`로 시작한다.
 */
export const notificationKeys = {
  all: ['notifications'] as const,
  list: (query: NotificationListQuery | null) => ['notifications', 'list', query] as const,
  unreadCount: ['notifications', 'unread-count'] as const,
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
export const useUnreadCount = (): UseQueryResult<number> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: notificationKeys.unreadCount,
    queryFn: async () => {
      const data = await runRequest(() => client.GET('/app/notifications/unread-count'));

      return data.unreadCount;
    },
  });
};

/**
 * 쓰기 실패 하나 — **무엇이 실패했는지까지 든다.**
 *
 * ⭐ **`request`와 `feedback`을 가른다.** 쓰기가 실패한 것과, 쓰기는 됐는데 화면이 그 결과를
 * 반영하지 못한 것은 **사용자에게 다른 사실**이다(배너 제목이 갈린다).
 *
 * `cause`는 되먹임 갈래에만 있다 — `ApiError`에 원인을 실을 자리가 없어 여기 매단다.
 * 화면은 그리지 않지만 개발 도구·시험이 읽을 수 있어, 이 앱의 결함이 「서버가 이상하다」로
 * 보이는 것을 막는다.
 */
export interface WriteFailure {
  kind: 'request' | 'feedback';
  error: ApiError;
  cause?: unknown;
}

/** 읽음 처리의 실패. **어느 알림의 것인지**를 함께 든다 — 여러 장이 동시에 나가기 때문이다. */
export interface MarkReadFailure extends WriteFailure {
  notificationId: number;
}

export interface MarkReadMutation {
  /** 읽음으로 바꾼다. **그 번호가 이미 나가는 중이면 받지 않는다** — 다른 번호는 받는다 */
  markRead: (notificationId: number) => void;
  /**
   * 지금 나가는 중인 번호들. **집합이다.**
   *
   * ⭐ 번호 하나만 들면 「다른 카드는 계속 누를 수 있다」가 **시각적으로만** 참이 된다 —
   * 잠기지 않은 카드를 눌러도 훅이 그 클릭을 조용히 버린다(T3 검증이 탐침으로 실측했다).
   * 잠그지 않음으로써 「누를 수 있다」고 말해 놓고 아무 일도 하지 않는 것은 되먹임이 없는
   * 결함이다. 집합이면 **누른 만큼 나가고 각각이 자기 카드만 잠근다.**
   */
  pendingIds: ReadonlySet<number>;
  /** 마지막 실패. 배너 제목이 갈래에 따라 갈린다 */
  failure: MarkReadFailure | null;
  /** 나가는 중인 것이 하나도 없을 때만 되돌린다 — 사본 체크리스트의 `resetIfIdle` 규율 */
  resetIfIdle: () => void;
}

/**
 * 나가는 것이 하나도 없을 때의 자리.
 *
 * ⚠ **참조 안정성이 근거가 아니다** — 소비처가 `useState`의 초깃값 하나뿐이고 그 자리는
 * **마운트 때 한 번만** 읽힌다. 인라인 `new Set()`으로 두어도 상태는 달라지지 않는다.
 * 근거는 **자리표시에 이름을 주는 것**이다 — 「나가는 것이 없다」가 값이 아니라 이름으로 읽힌다.
 *
 * ⚠ 같은 파일의 `EMPTY_READ_STATE`(`read-state.ts`)와 **반대다.** 그쪽은 조건이 바뀔 때마다
 * 상태에 다시 넣으므로 고정 참조가 실제로 하중을 진다.
 */
const EMPTY_PENDING_IDS: ReadonlySet<number> = new Set<number>();

const withPending = (current: ReadonlySet<number>, notificationId: number): ReadonlySet<number> => {
  const next = new Set(current);
  next.add(notificationId);

  return next;
};

const withoutPending = (
  current: ReadonlySet<number>,
  notificationId: number,
): ReadonlySet<number> => {
  const next = new Set(current);
  next.delete(notificationId);

  return next;
};

/**
 * 되먹임이 던진 것을 배너가 읽을 수 있는 모양으로 옮긴다.
 *
 * **통신 실패로 오인시키지 않는다** — 연결은 멀쩡했고 서버는 답했다. 원인을 연결 문제로
 * 적으면 사용자가 할 수 없는 조치(연결 확인)를 하게 된다(전례 `patterns/request.ts`의
 * `toApiError`와 같은 규율).
 *
 * ⛔ **원인을 버리지 않는다.** 이 자리에 떨어지는 것은 대부분 **이 앱의 코드가 던진 것**이고,
 * 버리면 그 결함이 「서버가 이상하다」로 보인다. 갈래에 매달아 개발 도구·시험에서 읽게 둔다
 * (원인은 이 함수가 아니라 `WriteFailure.cause`가 든다).
 *
 * ⭐ **문면은 `feedbackDescription` 하나다** — 「기간을 다시 조회하면 최신 상태가 보입니다」.
 * 그 알림은 **존재하고 서버는 이미 바꿨으므로**, 「찾을 수 없습니다」류로 바꾸면 거짓이 되고
 * 조치도 달라진다(최신 상태 보기 ↔ 없는 건 찾기).
 *
 * ⚠ **`validation` 갈래를 빌려 쓴다 — 이 실패는 검증 실패가 아니다.**
 *
 * `ApiError`는 **서버 응답을 정규화한 다섯 갈래**라(`patterns/request.ts`) 「응답은 정상인데
 * 화면 쪽이 어긋났다」를 담을 자리가 없다. 배너가 문구를 꺼내는 갈래 중 **화면이 문면을 직접
 * 정할 수 있는 것**이 `validation`뿐이라 그것을 골랐다 — 나머지는 서버가 준 `message`를 쓰거나
 * 고정 문구로 떨어진다.
 *
 * 그래서 `code`에 이 자리의 이름을 남긴다(`READ_FEEDBACK_FAILED`) — 갈래만 보고 「서버가 400을
 * 줬다」로 읽지 않게 한다. `ApiError`에 화면 쪽 갈래가 생기면 그때 이 차용을 걷는다.
 */
const feedbackError = (): ApiError => ({
  kind: 'validation',
  errors: [
    {
      scope: 'screen',
      code: 'READ_FEEDBACK_FAILED',
      message: messages.notificationCenter.writeError.feedbackDescription,
    },
  ],
});

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
 * ⭐ **여러 장을 동시에 처리할 수 있다.** 사용자가 카드를 연달아 누르는 화면이라, 진행 상태를
 * 불리언 하나로 두면 모든 카드가 함께 잠기고, **번호 하나**로 두면 잠기지 않은 카드의 클릭이
 * 조용히 버려진다(둘 다 완료 조건 T3-5와 어긋난다). 번호 **집합**을 들어 누른 만큼 내보내고
 * 각각이 자기 카드만 잠근다.
 *
 * ⚠ **그래서 요청 상태를 `useMutation`에서 읽지 않는다.** 그 훅은 **마지막 시도 하나**의
 * 변수·진행 여부만 추적하므로, 동시에 둘이 나가면 앞의 것이 뒤의 것에 덮인다. 시도를
 * `mutateAsync`로 각각 띄우고 **집합은 이 훅이 손으로 관리한다** — 성공·실패 되먹임이
 * **그 번호에만** 반영되는 것이 이 형태의 요점이다.
 */
export const useMarkRead = (options: MarkReadOptions): MarkReadMutation => {
  const { client } = useApiClient();
  /**
   * 마지막 실패 — **어느 알림의 것인지와 함께** 든다.
   *
   * ⭐ **전례들처럼 「새 시도가 앞 시도의 진술을 지운다」로 두면 안 되는 자리다.** 그 규율이
   * 참인 이유는 그 화면들의 쓰기가 **한 번에 하나**이기 때문이다 — 앞 진술은 늘 같은 대상에
   * 대한 말이라 새 시도가 그것을 대체한다. 여기서는 여러 장이 동시에 나가므로, 카드 C를 누른
   * 것이 **카드 A의 실패를 지우면** 사용자는 자기가 본 실패가 왜 사라졌는지 알 수 없다.
   * 지우는 것은 **같은 알림을 다시 누를 때**뿐이다.
   */
  const [failure, setFailure] = useState<MarkReadFailure | null>(null);
  const [pendingIds, setPendingIds] = useState<ReadonlySet<number>>(EMPTY_PENDING_IDS);

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

  const { mutateAsync, reset } = mutation;

  /**
   * 나가는 중인 번호를 **렌더 밖에서도 최신값으로** 읽는 자리.
   *
   * 두 곳이 쓴다 — 재진입 가드와 `resetIfIdle`. 클로저에 잡힌 `pendingIds`를 읽으면 그 렌더
   * 시점의 값이라, 같은 렌더 안에서 두 번 눌렀을 때 앞 클릭이 더한 번호가 보이지 않는다.
   */
  const pendingIdsRef = useRef(pendingIds);
  pendingIdsRef.current = pendingIds;

  const markRead = (notificationId: number): void => {
    /*
     * **같은 번호가 나가는 중이면 받지 않는다.** 화면이 그 카드를 잠그지만 훅도 같은 겹을
     * 갖는다 — 겹치면 같은 알림에 두 요청이 나가고, 둘 중 하나의 실패가 다른 하나의 성공을
     * 덮는다. ⚠ **다른 번호는 막지 않는다**(위 설명).
     */
    if (pendingIdsRef.current.has(notificationId)) return;

    /* 같은 알림을 다시 누를 때만 앞 진술을 지운다(위 `failure` 주석). */
    setFailure((current) => (current?.notificationId === notificationId ? null : current));
    setPendingIds((current) => withPending(current, notificationId));

    /*
     * ⭐ **멱등 키는 시도마다 새로 만든다.** 두 알림의 읽음 처리가 같은 키를 쓰면 서버가
     * 두 번째를 앞 요청의 재생으로 삼켜 **그 알림은 바뀌지 않는데 화면은 바뀌었다고 말한다.**
     * 이 쓰기는 두 번 실행돼도 결과가 같으므로(멱등한 상태 전이) 키를 유지할 이유도 없다.
     */
    mutateAsync({ notificationId, idempotencyKey: crypto.randomUUID() })
      .then(() => {
        /*
         * ⭐ **성공 되먹임의 예외를 요청 실패와 가른다**(전례 `login/queries.ts` · `omf-mes#96` 계열).
         *
         * 이 자리를 감싸지 않으면 뒤에 걸린 `.catch`가 **되먹임이 던진 것까지** 잡는다. 그러면
         * 서버는 읽음으로 바꿨는데 화면은 「읽음으로 바꾸지 못했습니다」라는 **거짓 진술**을 세우고,
         * 사용자가 다시 눌러도 아무 일이 없다(이미 읽음이다). 잡은 값은 이 요청이 만든 실패가
         * 아니므로 **쓰기가 실패했다고 말하지 않는다.**
         *
         * 되먹임이 **그 번호에만** 닿는다 — 동시에 나간 다른 시도의 결과와 섞이지 않는다.
         */
        try {
          options.onSuccess(notificationId);
        } catch (cause) {
          setFailure({ notificationId, error: feedbackError(), kind: 'feedback', cause });
        }
      })
      .catch((cause: unknown) => {
        setFailure({ notificationId, error: toApiError(cause), kind: 'request' });
      })
      .finally(() => {
        /*
         * ⭐ **끝나면 그 번호만 집합에서 뺀다.** 실패했을 때도 뺀다 — 빼지 않으면 그 카드가
         * 잠긴 채로 남아 **다시 누를 수 없고**, 쓰기 실패 배너가 「다시 시도」를 두지 않은
         * 전제(카드를 다시 누르면 된다)가 무너진다.
         */
        setPendingIds((current) => withoutPending(current, notificationId));
      });
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
   * 나가는 중인 번호 **집합**을 참조로 읽어 이 함수가 그 값에 매이지 않게 한다 —
   * **하나라도 나가는 중이면 거두지 않는다.**
   *
   * ⚠ **이 회차에 그 전제가 약해졌다 — 그래도 가드를 남긴다.** 되먹임을 `mutateAsync`가
   * 돌려준 약속에 직접 매달게 바꾸면서, `reset()`이 그 사슬을 **더는 끊지 못한다**(감지기
   * 「나가는 중에 조건이 바뀌어도 성공 되먹임이 살아 있다」가 가드를 지워도 통과한다 — 실측).
   * 즉 지금 이 가드가 막는 것은 「나가는 중에 실패 진술이 지워지는 것」 하나뿐이다.
   *
   * 남기는 이유는 **되먹임을 다시 mutation 객체에 매다는 변경이 언제든 올 수 있고**(예: 공통
   * 쓰기 훅으로 되돌리기) 그때 이 가드가 없으면 규율이 조용히 깨지기 때문이다. 대신 그 사실을
   * 여기 적어 두어, **이 가드의 뮤턴트가 살아남는 것이 사각이 아니라 전제 변화**임을 남긴다.
   */
  const resetIfIdle = useCallback((): void => {
    /*
     * ⭐ **진술은 늘 거둔다 — 규율에 매인 것은 `reset()`뿐이다.**
     *
     * `omf-mes#96`이 막는 것은 **`reset()`이 나가는 중인 되먹임을 끊는 것**이다. `setFailure(null)`은
     * 사슬을 끊지 않는다 — 약속에 매달린 `.catch`는 그 뒤에 실패하면 **다시** 기록한다.
     * 둘을 한 가드로 묶으면 「낡은 진술의 생존」이 규율의 이름을 빌려 남는다.
     */
    setFailure(null);

    if (pendingIdsRef.current.size > 0) return;

    reset();
  }, [reset]);

  return {
    markRead,
    pendingIds,
    failure,
    resetIfIdle,
  };
};

export interface MarkAllReadMutation {
  markAllRead: () => void;
  isSubmitting: boolean;
  /** 마지막 실패. 배너 제목이 갈래에 따라 갈린다 — `useMarkRead`와 같은 규율이다 */
  failure: WriteFailure | null;
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
  const [failure, setFailure] = useState<WriteFailure | null>(null);

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

    setFailure(null);

    mutation.mutate(crypto.randomUUID(), {
      onSuccess: (data) => {
        void queryClient.invalidateQueries({ queryKey: notificationKeys.all });

        /*
         * ⭐ **성공 되먹임의 예외를 요청 실패와 가른다** — `useMarkRead`와 같은 규율이다
         * (전례 `login/queries.ts` · `omf-mes#96` 계열).
         *
         * ⚠ **이 회차에 그 예외가 실제로 나는 경로는 없다**(되먹임이 알림 한 줄뿐이다).
         * 그래도 두는 이유는 **되먹임이 소비자가 넘기는 함수**이기 때문이다 — 뒤에 무엇이 붙든
         * 그것이 던진 것을 「모두 읽음으로 바꾸지 못했습니다」로 말하면 거짓이 되고, 서버는
         * 이미 전부 바꿔 두었다. 두 쓰기의 규율이 갈리면 **뒤에 붙이는 사람이 어느 쪽을 따를지
         * 알 수 없다.**
         */
        try {
          options.onSuccess(data.readCount);
        } catch (cause) {
          setFailure({ kind: 'feedback', error: feedbackError(), cause });
        }
      },
      onError: (cause) => {
        setFailure({ kind: 'request', error: toApiError(cause) });
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
    /* 진술은 늘 거둔다 — 규율에 매인 것은 `reset()`뿐이다(위 `useMarkRead`와 같은 판단). */
    setFailure(null);

    if (isPendingRef.current) return;

    reset();
  }, [reset]);

  return {
    markAllRead,
    isSubmitting: mutation.isPending,
    failure,
    resetIfIdle,
  };
};
