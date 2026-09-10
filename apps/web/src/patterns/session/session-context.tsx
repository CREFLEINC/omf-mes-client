import type { components } from '@omf-mes/api-client';
import { hashKey, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { createContext, use, useCallback, useEffect, useMemo, type ReactNode } from 'react';

import { useApiClient } from '../api-context';
import { runRequest, toApiError } from '../request';

/**
 * 로그인 결과이자 「지금 나는 누구이고 어디까지 보는가」.
 *
 * 계약 타입을 여기서 다시 별칭한다 — 허용 의존 규칙이 `patterns/` → `screens/` 참조를 막으므로
 * 화면 슬라이스의 같은 별칭을 쓸 수 없다. 전례(`patterns/api-context.tsx`)가 `ApiClient`를
 * 패키지에서 직접 가져오는 것과 같은 형태다.
 */
export type Session = components['schemas']['Session'];

/**
 * 로그인 상태 넷.
 *
 * ⭐ **「아직 모른다」가 둘이고 서로 다르다.** `restoring`은 물어보는 중이고 `unknown`은
 * 물어봤는데 답을 못 받은 것이다. 앞엣것은 기다리면 풀리고 뒤엣것은 사람이 다시 눌러야
 * 풀린다 — 같은 모양으로 두면 닿지 않는 서버 앞에서 화면이 영영 「확인하는 중」에 머문다.
 *
 * ⛔ **`unknown`을 `anonymous`로 접지 않는다.** 접으면 서버가 잠깐 흔들릴 때 **작업 중인
 * 사람이 로그인 화면으로 쫓겨난다.** 그 사람의 자격에는 아무 문제가 없었다. 전례가
 * `patterns/pop-access.ts`에 있다 — 조회 실패를 「권한 없음」과 가른다.
 */
export type SessionStatus = 'restoring' | 'authenticated' | 'anonymous' | 'unknown';

export interface SessionValue {
  status: SessionStatus;
  /** `authenticated`일 때만 값이 있다. **「모른다」와 「비었다」를 같은 모양으로 두지 않는다** */
  session: Session | null;
  signIn: (session: Session) => void;
  /**
   * 이 브라우저가 들고 있던 판정만 지운다. **서버 세션을 끊지 않는다** — 끊는 것은
   * `useSignOut`이 하고, 이 함수는 그 성공 뒤에 불린다.
   */
  signOut: () => void;
  /** `unknown`에서 다시 물어본다. 다른 상태에서는 할 일이 없다. */
  retryRestore: () => void;
}

/** 자격이 없다는 서버의 답. 이 하나만 「로그인 안 했다」로 읽는다. */
const HTTP_UNAUTHORIZED = 401;

/**
 * ⚠ **세션은 자주 바뀌지 않지만 무한정 묵히지도 않는다.** 관리웹은 하루 종일 열어 두는 화면이라,
 * 권한을 새로 받은 사람이 브라우저를 껐다 켜야만 반영되는 것은 곤란하다. 전례
 * (`patterns/pop-access.ts`)와 같은 값을 쓴다.
 */
const SESSION_STALE_MS = 5 * 60 * 1000;

export const sessionKeys = {
  current: ['app', 'session', 'current'] as const,
};

const SESSION_QUERY_HASH = hashKey(sessionKeys.current);

/** 잡은 값이 「자격이 없다」인가. 그 밖의 실패는 전부 「모른다」다. */
const isUnauthenticated = (cause: unknown): boolean => {
  const error = toApiError(cause);

  return error.kind === 'http' && error.status === HTTP_UNAUTHORIZED;
};

/**
 * **세션이 끊겼다는 답을 어디서 받든 판정에 반영한다.**
 *
 * 세션은 시간이 지나면 만료된다. 그때 화면이 하는 일은 조회이지 세션 확인이 아니라서, 만료를
 * 알려 주는 401은 **업무 조회의 실패로 먼저 도착한다.** 그것을 흘려보내면 화면마다 「불러오지
 * 못했습니다」 배너만 서고, 사람은 새로고침을 되풀이하다 원인을 모른 채 브라우저를 껐다 켠다.
 *
 * ⛔ **세션 조회 자신의 401은 제외한다.** 그쪽은 이미 `anonymous`로 답한 것이라 여기서 또
 * 건드리면 같은 판정을 두 번 쓴다.
 *
 * ⚠ **쓰기(mutation)도 함께 본다.** 만료된 뒤 첫 조작이 저장인 경우가 흔하고, 그 실패만
 * 보고 있으면 세션은 끊겼는데 화면은 로그인된 척한다. 로그인 자체의 401은 여기 걸리지
 * 않는다 — 그쪽은 `LoginFailedError`를 던져 `toApiError`가 상태 코드를 붙이지 못한다.
 */
const useSignOutOnUnauthenticated = (queryClient: QueryClient): void => {
  useEffect(() => {
    const markAnonymous = (): void => {
      queryClient.setQueryData<Session | null>(sessionKeys.current, null);
    };

    const unsubscribeQueries = queryClient.getQueryCache().subscribe((event) => {
      if (event.type !== 'updated' || event.action.type !== 'error') return;
      if (event.query.queryHash === SESSION_QUERY_HASH) return;
      if (!isUnauthenticated(event.action.error)) return;

      markAnonymous();
    });

    const unsubscribeMutations = queryClient.getMutationCache().subscribe((event) => {
      if (event.type !== 'updated' || event.action.type !== 'error') return;
      if (!isUnauthenticated(event.action.error)) return;

      markAnonymous();
    });

    return () => {
      unsubscribeQueries();
      unsubscribeMutations();
    };
  }, [queryClient]);
};

/**
 * 로그인 결과를 앱에 내려 주는 컨텍스트.
 *
 * **`patterns/`에 있는 이유**는 허용 의존 규칙이 `screens/`·`patterns/` → `app/` 참조를 막기
 * 때문이다(`app-inner-direction`). 마운트는 `app/providers.tsx`가 하고 읽기는 셸과 화면이
 * 한다 — `app/` → `patterns/`는 허용 방향이다. 전례 `patterns/api-context.tsx`가 같은 사정으로
 * 같은 자리에 있다.
 *
 * ⭐ **판정의 근거는 서버에 한 번 물어본 답 하나다.** 자격은 서버가 내린 세션 쿠키에 있고
 * 브라우저 스크립트는 그것을 읽을 수 없다 — 그래서 「로그인돼 있는가」는 **물어봐야만** 안다.
 * 저장소에 흉내를 내 두면 쿠키가 만료된 뒤에도 화면은 로그인된 척하고, 요청만 전부 거절당하는
 * 상태가 된다.
 *
 * ⭐ **그 답을 캐시 한 칸에 둔다.** 로그인·로그아웃도 같은 칸을 고쳐 쓴다. 상태를 따로
 * 들고 있으면 「방금 로그인했다」와 「서버에 물어본 답」이 어긋날 자리가 생기고, 어긋나면
 * 어느 쪽이 참인지 화면에서 보이지 않는다.
 */
const SessionContext = createContext<SessionValue | null>(null);

export interface SessionProviderProps {
  children: ReactNode;
}

export const SessionProvider = ({ children }: SessionProviderProps) => {
  const { client } = useApiClient();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: sessionKeys.current,
    staleTime: SESSION_STALE_MS,
    queryFn: async (): Promise<Session | null> => {
      try {
        return await runRequest(() => client.GET('/app/sessions/current'));
      } catch (cause) {
        /*
         * ⭐ **미인증은 실패가 아니라 답이다.** 던지면 「물어보지 못했다」와 같은 모양이 되어
         * 가드가 둘을 가를 수 없다 — 로그인하지 않은 첫 방문자마다 「다시 시도」가 뜬다.
         */
        if (isUnauthenticated(cause)) return null;

        throw cause;
      }
    },
  });

  useSignOutOnUnauthenticated(queryClient);

  const signIn = useCallback(
    (next: Session): void => {
      /**
       * **응답을 그대로 담는다.** 필요한 것만 골라 담으면 뒤따르는 화면이 권한 범위를 읽을 때
       * 다시 로그인을 시켜야 한다 — 지금 그리는 것이 이름 하나뿐인 것과는 별개다.
       */
      queryClient.setQueryData<Session | null>(sessionKeys.current, next);
    },
    [queryClient],
  );

  const signOut = useCallback((): void => {
    queryClient.setQueryData<Session | null>(sessionKeys.current, null);
  }, [queryClient]);

  const retryRestore = useCallback((): void => {
    void queryClient.refetchQueries({ queryKey: sessionKeys.current });
  }, [queryClient]);

  const status = readStatus(query.isPending, query.isError, query.data);

  /* 값 객체를 매 렌더 새로 만들면 세션이 그대로인데도 읽는 쪽이 전부 다시 그린다. */
  const value = useMemo<SessionValue>(
    () => ({
      status,
      session: status === 'authenticated' && query.data !== undefined ? query.data : null,
      signIn,
      signOut,
      retryRestore,
    }),
    [status, query.data, signIn, signOut, retryRestore],
  );

  return <SessionContext value={value}>{children}</SessionContext>;
};

/**
 * 캐시 한 칸의 세 모양을 상태 넷으로 읽는다.
 *
 * `data`가 `undefined`인 성공은 계약상 오지 않지만(이 조회의 200은 `Session` 본문이 있어야
 * 뜻이 성립한다) **모양을 신뢰하지 않고** 미인증 쪽으로 접는다 — 인증된 것으로 접으면
 * 「로그인했는데 누구인지 모르는」 화면이 열린다.
 */
const readStatus = (
  isPending: boolean,
  isError: boolean,
  data: Session | null | undefined,
): SessionStatus => {
  if (isPending) return 'restoring';
  if (isError) return 'unknown';

  return data === null || data === undefined ? 'anonymous' : 'authenticated';
};

/**
 * ⛔ **프로바이더 밖에서 부르면 던진다** — 전례와 같은 규율이다.
 *
 * 기본값을 돌려주면 프로바이더를 잊은 화면이 **로그인하지 않은 상태로 정상 동작하는 것처럼**
 * 보이고, 그 어긋남은 세션을 실제로 읽는 자리에 가서야 드러난다.
 */
export const useSession = (): SessionValue => {
  const value = use(SessionContext);

  if (value === null) {
    throw new Error('useSession은 SessionProvider 안에서만 쓸 수 있습니다.');
  }

  return value;
};
