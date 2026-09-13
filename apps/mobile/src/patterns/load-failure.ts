import { isUnauthenticated } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';
import { useQuery, useQueryClient, type Query, type QueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useSyncExternalStore } from 'react';

import { useApiClient } from './api-context';
import { currentPlantId } from './plant';
import { ApiRequestError, runRequest, toApiError } from './request';

/** 단말 토큰이 서버에서 살아 있는가. 확인하지 못했으면 모른다고 둔다. */
export type DeviceTokenState = 'alive' | 'dead' | 'unknown';

export const deviceTokenKey = ['device-token-state'] as const;

/**
 * 거절이 토큰 탓인지 조회 탓인지 가른다.
 *
 * 서버는 토큰이 죽은 것과 이 단말에 열리지 않은 조회를 같은 401 로 보내고, 돌려주는 문구로도
 * 가를 수 없다 - 단말 유형에 열리지 않은 경로도 「로그인이 필요합니다」로 온다. 그래서 모바일
 * 단말에 열려 있는 조회 하나를 불러 본다. 등록 때 토큰을 확인한 것과 같은 조회다.
 *
 * 답이 오면 토큰은 산 것이고, 401 이면 죽은 것이다. 그 밖의 실패는 판정하지 않는다.
 */
const probeDeviceToken = async (
  client: ReturnType<typeof useApiClient>['client'],
): Promise<DeviceTokenState> => {
  const plantId = currentPlantId();

  if (plantId === null) {
    return 'unknown';
  }

  try {
    await runRequest(() =>
      client.GET('/mdm/workers', { params: { query: { plantId, page: 1, size: 1 } } }),
    );
    return 'alive';
  } catch (error) {
    return isUnauthenticated(toApiError(error)) ? 'dead' : 'unknown';
  }
};

export interface LoadFailureOptions {
  other?: string;
  caution?: string;
}

const isRejectedQuery = (query: Query): boolean =>
  query.queryKey[0] !== deviceTokenKey[0] &&
  query.state.status === 'error' &&
  query.state.error instanceof ApiRequestError &&
  isUnauthenticated(query.state.error.apiError);

/**
 * 조회 실패를 사람이 할 일로 옮기는 문구를 고른다.
 *
 * 화면마다 적어 둔 실패 문구는 「연결을 확인하세요」로 끝나는 것이 많다. 연결이 끊긴 때에만
 * 맞는 말인데 서버가 거절해도 같은 문구가 떠, 현장은 멀쩡한 망을 뒤졌다(#1187). 화면의 문구는
 * 연결 실패일 때만 쓰고 나머지는 여기서 가른다.
 *
 * 401 이 보이면 토큰 확인을 한 번 부른다. 확인은 캐시에 두어 여러 조회가 한꺼번에 거절돼도
 * 한 번만 나간다.
 *
 * @returns `(error, offline, options) => 문구` - `offline` 은 그 자리의 연결 실패 문구다.
 *   `other` 를 주면 서버 오류일 때 그 문구를 쓴다(그 자리가 이미 따로 적어 둔 경우).
 *   `caution` 은 연결이 아닌 실패 문구 뒤에 붙인다 - 연결 문구에 섞여 있던 주의를 잃지 않게.
 */
export const useLoadFailure = (): ((
  error: unknown,
  offline: string,
  options?: LoadFailureOptions,
) => string) => {
  const queryClient = useQueryClient();
  const { client } = useApiClient();

  const token = useQuery({
    queryKey: deviceTokenKey,
    queryFn: () => probeDeviceToken(client),
    enabled: false,
  });

  useEffect(() => {
    const check = (target: QueryClient) => {
      void target
        .fetchQuery({ queryKey: deviceTokenKey, queryFn: () => probeDeviceToken(client) })
        .catch(() => undefined);
    };

    const cache = queryClient.getQueryCache();

    /* 이 화면이 서기 전에 이미 거절된 조회가 캐시에 남아 있을 수 있다. */
    if (cache.getAll().some(isRejectedQuery)) {
      check(queryClient);
    }

    return cache.subscribe((event) => {
      if (
        event.type === 'updated' &&
        event.action.type === 'error' &&
        isRejectedQuery(event.query)
      ) {
        check(queryClient);
      }
    });
  }, [client, queryClient]);

  const tokenState: DeviceTokenState = token.data ?? 'unknown';

  return useCallback(
    (error: unknown, offline: string, options: LoadFailureOptions = {}): string => {
      if (error instanceof ApiRequestError && error.apiError.kind === 'network') {
        return offline;
      }

      const told =
        /*
         * 요청 밖의 실패(응답을 읽다 난 예외 등)는 연결 문제가 아니다. 연결을 보라고 하면 사람이
         * 할 수 없는 조치를 하게 된다(`toApiError` 와 같은 판단).
         */
        error instanceof ApiRequestError && isUnauthenticated(error.apiError)
          ? tokenState === 'dead'
            ? messages.httpError.deviceExpired
            : tokenState === 'alive'
              ? messages.httpError.deviceNotAllowed
              : messages.httpError.deviceRejected
          : (options.other ?? messages.httpError.loadServer);

      return options.caution === undefined ? told : `${told} ${options.caution}`;
    },
    [tokenState],
  );
};

/**
 * 키가 `key` 로 시작하는 조회 중 실패한 것의 오류.
 *
 * 여러 조회를 묶어 「확인하지 못함」 하나로 내놓는 훅이 있다. 그 판정은 그대로 두고, 왜
 * 확인하지 못했는지만 캐시에서 읽는다. 실패한 것이 없으면 null 이다.
 */
export const useQueryErrorOf = (key: string): unknown => {
  const cache = useQueryClient().getQueryCache();

  return useSyncExternalStore(
    useCallback((notify: () => void) => cache.subscribe(notify), [cache]),
    () =>
      cache
        .findAll({ predicate: (query) => query.queryKey[0] === key })
        .find((query) => query.state.status === 'error')?.state.error ?? null,
  );
};
