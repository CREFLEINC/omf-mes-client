import type { ApiClient, components } from '@omf-mes/api-client';
import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { useApiClient } from '../../patterns/api-context';
import { requireIfMatch, useMasterWrite, type MasterWriteResult } from '../../patterns/master';
import { runRequest } from '../../patterns/request';
import type { FailureListQuery } from './filters';
import {
  toDetailView,
  toReportView,
  type BreakdownDetailView,
  type BreakdownListResult,
} from './types';

/**
 * 이 화면의 오퍼레이션 — 읽기 둘과 쓰기 셋.
 *
 * ⭐ **상태를 본문으로 받지 않는다.** 「처리 중으로」와 「완료」가 각각 전용 경로다. 그래서
 * 이 파일에는 상태를 넘기는 `PUT`이 없고, 있는 것은 **원인 코드와 처리 내역만 고치는** `PUT`뿐이다.
 *
 * ⛔ **사진을 붙이는 경로를 쓰지 않는다.** 계약에 있지만 이 화면의 사진은 읽기 전용이다 —
 * 현장이 적은 것을 사무가 고치지 않는다.
 *
 * ⭐ **잠금 토큰은 상세 경로에 보관된다.** 쓰기 경로(`:complete` 등)로 꺼내면 늘 비어 있다.
 *
 * 경로 리터럴은 이 파일에만 둔다 — `openapi-fetch`가 경로를 리터럴 타입으로 요구해 문자열
 * 변수로 넘기면 타입 검사가 풀린다.
 */

type Client = ApiClient['client'];
type Breakdown = components['schemas']['Breakdown'];
type BreakdownHandlingUpdate = components['schemas']['BreakdownHandlingUpdate'];
type BreakdownComplete = components['schemas']['BreakdownComplete'];

export const failureKeys = {
  all: ['equipment-failure'] as const,
  list: (query: FailureListQuery) => ['equipment-failure', 'list', query] as const,
  detail: (breakdownId: number) => ['equipment-failure', 'detail', breakdownId] as const,
};

/** 상세 경로. **잠금 토큰이 이 경로에 보관된다** — 쓰기 경로로 꺼내면 늘 비어 있다. */
export const breakdownDetailPath = (breakdownId: number): string =>
  `/maintenance/breakdowns/${String(breakdownId)}`;

const fetchList = async (client: Client, query: FailureListQuery): Promise<BreakdownListResult> => {
  const data = await runRequest(() => client.GET('/maintenance/breakdowns', { params: { query } }));

  return {
    items: data.items.map(toReportView),
    page: data.page ?? { page: query.page ?? 1, size: data.items.length, total: data.items.length },
  };
};

export const useFailureList = (query: FailureListQuery): UseQueryResult<BreakdownListResult> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: failureKeys.list(query),
    queryFn: () => fetchList(client, query),
  });
};

/**
 * 고장 하나의 상세.
 *
 * ⭐ **목록으로 갈음할 수 없다.** 처리 내역·사진·연결된 비가동은 **상세 응답에서만** 채워지고,
 * 목록의 같은 칸은 늘 0이다. 목록 줄로 상세를 그리면 「연결된 비가동 0건」이 늘 참이 된다.
 */
export const useFailureDetail = (
  breakdownId: number | null,
): UseQueryResult<BreakdownDetailView> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: failureKeys.detail(breakdownId ?? 0),
    enabled: breakdownId !== null,
    queryFn: () => {
      if (breakdownId === null) {
        throw new Error('고장을 고르기 전에는 상세를 조회하지 않습니다.');
      }

      return runRequest(() =>
        client.GET('/maintenance/breakdowns/{breakdownId}', {
          params: { path: { breakdownId } },
        }),
      ).then(toDetailView);
    },
  });
};

/** 화면이 소유한 입력칸 이름 — 오류를 그릴 자리가 있는 둘만 넣는다. */
const KNOWN_FIELDS = ['causeCode', 'handlingNote'] as const;

/**
 * 처리 내용 저장 — **원인 코드와 처리 내역만** 고친다.
 *
 * 되돌릴 수 있는 쓰기라 멱등 키 수명은 기본(`per-attempt`)이다. 같은 값을 두 번 저장해도
 * 결과가 같으므로 키를 붙들 이유가 없다.
 */
export const useHandlingUpdate = (
  breakdownId: number | null,
  onSuccess: () => void,
): MasterWriteResult<BreakdownHandlingUpdate> => {
  const { client } = useApiClient();

  return useMasterWrite<BreakdownHandlingUpdate, Breakdown>({
    request: (body, headers) =>
      client.PUT('/maintenance/breakdowns/{breakdownId}', {
        params: {
          path: { breakdownId: breakdownId ?? 0 },
          header: {
            'Idempotency-Key': headers['Idempotency-Key'],
            'If-Match': requireIfMatch(headers),
          },
        },
        body,
      }),
    etagPath: breakdownId === null ? null : breakdownDetailPath(breakdownId),
    invalidateKeys: [failureKeys.all],
    knownFields: KNOWN_FIELDS,
    onSuccess,
  });
};

/**
 * 「처리 중으로」 — **되돌리는 길이 없다.**
 *
 * ⚠ 멱등 키 수명이 **기본(`per-attempt`)**이다. 본문이 빈 액션에 `until-applied`를 쓰면
 * 「값이 바뀌면 새 키」가 성립하지 않아, 원인을 고치고 다시 눌러도 같은 키가 나가고 서버가
 * 앞선 거부를 되돌려 주면 **영영 성공할 수 없다**(`use-master-write.ts`의 ⚠ 참조).
 */
export const useStartHandling = (
  breakdownId: number | null,
  onSuccess: () => void,
): MasterWriteResult<void> => {
  const { client } = useApiClient();

  return useMasterWrite<void, Breakdown>({
    request: (_variables, headers) =>
      client.POST('/maintenance/breakdowns/{breakdownId}:start-handling', {
        params: {
          path: { breakdownId: breakdownId ?? 0 },
          header: {
            'Idempotency-Key': headers['Idempotency-Key'],
            'If-Match': requireIfMatch(headers),
          },
        },
      }),
    etagPath: breakdownId === null ? null : breakdownDetailPath(breakdownId),
    invalidateKeys: [failureKeys.all],
    knownFields: [],
    onSuccess,
  });
};

/**
 * 「완료」 — **되돌릴 수 없다.** 완료된 건은 잠기고, 잘못됐으면 새 고장 건으로 등록해야 한다.
 *
 * ⭐ 멱등 키 수명이 **`until-applied`**다. 본문(원인 코드·처리 내역)이 있어 「값이 바뀌면 새
 * 키」가 성립하고, 통신이 끊긴 뒤 다시 눌렀을 때 서버가 다른 쓰기로 보는 것을 막아야 한다.
 */
export const useComplete = (
  breakdownId: number | null,
  onSuccess: () => void,
): MasterWriteResult<BreakdownComplete> => {
  const { client } = useApiClient();

  return useMasterWrite<BreakdownComplete, Breakdown>({
    request: (body, headers) =>
      client.POST('/maintenance/breakdowns/{breakdownId}:complete', {
        params: {
          path: { breakdownId: breakdownId ?? 0 },
          header: {
            'Idempotency-Key': headers['Idempotency-Key'],
            'If-Match': requireIfMatch(headers),
          },
        },
        body,
      }),
    etagPath: breakdownId === null ? null : breakdownDetailPath(breakdownId),
    invalidateKeys: [failureKeys.all],
    knownFields: KNOWN_FIELDS,
    keyLifetime: 'until-applied',
    onSuccess,
  });
};
