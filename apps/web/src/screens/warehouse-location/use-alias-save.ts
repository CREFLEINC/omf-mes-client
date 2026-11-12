import { type components, createIdempotencyKey } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';

import { useApiClient } from '../../patterns/api-context';
import { runRequest, toApiError } from '../../patterns/request';
import { locationToFormValues, toLocationUpdate } from './mappers';
import { locationDetailPath, locationKeys } from './queries';
import type { Location } from './types';

type LocationDetailResponse = components['schemas']['LocationDetailResponse'];

export type AliasSaveResult =
  /** 저장한 위치 — 서버가 돌려준 값(별칭 · 이름이 바뀐 뒤). */
  | { kind: 'saved'; location: Location }
  /** 남이 먼저 고쳤다(409 · 412) — 최신 별칭과 잠금 값을 다시 읽었다. */
  | { kind: 'conflict'; latestAlias: string }
  | { kind: 'failed'; message: string };

const CONFLICT_STATUSES = new Set([409, 412]);

const statusOf = (error: unknown): number | undefined => {
  const apiError = toApiError(error);
  return 'status' in apiError ? apiError.status : undefined;
};

const failureMessage = (error: unknown): string => {
  const apiError = toApiError(error);
  switch (apiError.kind) {
    case 'validation':
    case 'stateLocked':
      return apiError.errors[0]?.message ?? messages.httpError.title;
    case 'conflict':
      return apiError.message === '' ? messages.httpError.title : apiError.message;
    case 'http':
      return apiError.message ?? messages.httpError.title;
    case 'network':
      return messages.httpError.offline;
  }
};

/**
 * 별칭 하나를 바로 저장한다(#267 FR-007 · R-5). 위치 수정과 같은 잠금 값 흐름이다 — 상세를 읽어 둔 ETag
 * (`locationDetailPath`)를 `If-Match` 로 싣는다. 본문은 수정 창과 같은 `toLocationUpdate` 다 — 사람이 만든 위치는 별칭이 바뀌면
 * 이름도 별칭(지우면 코드)으로 맞추고, 서버가 만든 자리는 이름을 그대로 둔다. 빈 글은 별칭 지우기다.
 *
 * - `load` — 고치기를 열 때 부른다. 그때의 판을 잠금 기준으로 삼아, 그 사이 남이 고쳤으면 저장이 409 · 412 로 걸린다.
 * - `save` — 저장. 끝나면(충돌 포함) 위치 목록을 다시 읽는다.
 */
export const useAliasSave = () => {
  const { client, etags } = useApiClient();
  const queryClient = useQueryClient();

  const load = useCallback(
    (locationId: number): Promise<LocationDetailResponse> =>
      queryClient.fetchQuery({
        queryKey: locationKeys.detail(locationId),
        staleTime: 0,
        queryFn: () =>
          runRequest(() =>
            client.GET('/mdm/locations/{locationId}', { params: { path: { locationId } } }),
          ),
      }),
    [client, queryClient],
  );

  const save = useCallback(
    async (location: Location, aliasText: string): Promise<AliasSaveResult> => {
      try {
        const stored =
          queryClient.getQueryData<LocationDetailResponse>(locationKeys.detail(location.locationId))
            ?.location ?? (await load(location.locationId)).location;
        const saved = await runRequest(() =>
          client.PUT('/mdm/locations/{locationId}', {
            params: {
              path: { locationId: stored.locationId },
              header: {
                'Idempotency-Key': createIdempotencyKey(),
                'If-Match': etags.ifMatch(locationDetailPath(stored.locationId)) ?? '',
              },
            },
            /* 수정 창과 같은 규칙 — 사람이 만든 위치는 이름 = 별칭 ?? 코드, 서버가 만든 자리는 이름 그대로. */
            body: toLocationUpdate(
              { ...locationToFormValues(stored), aliasName: aliasText },
              stored,
            ),
          }),
        );
        return { kind: 'saved', location: saved };
      } catch (error) {
        const status = statusOf(error);
        if (status !== undefined && CONFLICT_STATUSES.has(status)) {
          try {
            const latest = await load(location.locationId);
            return { kind: 'conflict', latestAlias: latest.location.aliasName ?? '' };
          } catch (reloadError) {
            return { kind: 'failed', message: failureMessage(reloadError) };
          }
        }
        return { kind: 'failed', message: failureMessage(error) };
      } finally {
        await queryClient.invalidateQueries({ queryKey: locationKeys.all });
      }
    },
    [client, etags, load, queryClient],
  );

  return { load, save };
};
