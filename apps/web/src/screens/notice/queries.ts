import type { components } from '@omf-mes/api-client';
import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { useApiClient } from '../../patterns/api-context';
import { requireIfMatch, useMasterWrite, type MasterWriteResult } from '../../patterns/master';
import { runRequest } from '../../patterns/request';
import type { NoticeFilters } from './filters';
import {
  toAckView,
  toNoticeView,
  type AckListResult,
  type NoticeListResult,
  type NoticeView,
} from './types';

/**
 * 이 화면의 오퍼레이션.
 *
 * ⭐ **상태를 쓰는 경로가 없다.** 게시·종료는 각각 전용 경로이고 상태는 서버가 파생한다 —
 * 「내려버리기」도 상태를 바꾸는 것이 아니라 종료일을 당기는 것이다.
 *
 * ⛔ **게시된 공지를 고치는 경로를 부르지 않는다.** 서버가 409 로 막지만, 그 전에 화면이
 * 잠근다 — 사람이 본문을 다 고친 뒤에 거부당하면 그 글이 어디에도 남지 않는다.
 *
 * 잠금 토큰은 **공지 상세**가 준 것이다. 게시·종료·수정 모두 같은 공지를 바꾼다.
 *
 * 경로 리터럴은 이 파일에만 둔다 — `openapi-fetch`가 경로를 리터럴 타입으로 요구해 문자열
 * 변수로 넘기면 타입 검사가 풀린다.
 */

type Notice = components['schemas']['Notice'];
type NoticeCreate = components['schemas']['NoticeCreate'];

export const PAGE_SIZE = 20;
export const ACK_PAGE_SIZE = 50;

export const noticeKeys = {
  all: ['notice'] as const,
  list: (filters: NoticeFilters) =>
    [
      'notice',
      'list',
      filters.q,
      filters.statusCode,
      filters.scopeCode,
      filters.activeOnly,
      filters.unacknowledgedByMe,
      filters.overlapFrom,
      filters.overlapTo,
      filters.page,
    ] as const,
  detail: (noticeId: number | null) => ['notice', 'detail', noticeId ?? 0] as const,
  acks: (noticeId: number | null, pendingOnly: boolean) =>
    ['notice', 'acks', noticeId ?? 0, pendingOnly] as const,
};

/** 공지 상세 경로 — **이 화면의 모든 쓰기가 여기서 잠금 토큰을 받는다.** */
export const noticeDetailPath = (noticeId: number): string => `/app/notices/${String(noticeId)}`;

type StatusQuery = components['schemas']['Notice']['statusCode'];
type ScopeQuery = components['schemas']['Notice']['scopeCode'];

export const useNotices = (filters: NoticeFilters): UseQueryResult<NoticeListResult> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: noticeKeys.list(filters),
    queryFn: () =>
      runRequest(() =>
        client.GET('/app/notices', {
          params: {
            query: {
              ...(filters.q === '' ? {} : { q: filters.q }),
              ...(filters.statusCode === ''
                ? {}
                : { statusCode: filters.statusCode as StatusQuery }),
              ...(filters.scopeCode === '' ? {} : { scopeCode: filters.scopeCode as ScopeQuery }),
              ...(filters.activeOnly ? { activeOnly: true } : {}),
              ...(filters.unacknowledgedByMe ? { unacknowledgedByMe: true } : {}),
              ...(filters.overlapFrom === '' ? {} : { overlapFrom: filters.overlapFrom }),
              ...(filters.overlapTo === '' ? {} : { overlapTo: filters.overlapTo }),
              page: filters.page,
              size: PAGE_SIZE,
            },
          },
        }),
      ).then((data) => ({
        items: data.items.map(toNoticeView),
        page: data.page,
      })),
  });
};

export const useNoticeDetail = (noticeId: number | null): UseQueryResult<NoticeView> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: noticeKeys.detail(noticeId),
    enabled: noticeId !== null,
    queryFn: () => {
      if (noticeId === null) throw new Error('공지를 고르기 전에는 상세를 조회하지 않습니다.');

      return runRequest(() =>
        client.GET('/app/notices/{noticeId}', { params: { path: { noticeId } } }),
      ).then(toNoticeView);
    },
  });
};

/**
 * 확인 현황.
 *
 * ⭐ **확인을 요구한 공지에서만 뜻이 있다** — 아닌 공지에서는 부르지 않는다. 부르면 빈
 * 목록이 오고, 그것을 「아무도 확인하지 않았다」로 읽을 사람이 생긴다.
 */
export const useAcknowledgements = (
  noticeId: number | null,
  enabled: boolean,
  pendingOnly: boolean,
): UseQueryResult<AckListResult> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: noticeKeys.acks(noticeId, pendingOnly),
    enabled: enabled && noticeId !== null,
    queryFn: () => {
      if (noticeId === null) throw new Error('공지를 고르기 전에는 확인 현황을 조회하지 않습니다.');

      return runRequest(() =>
        client.GET('/app/notices/{noticeId}/acknowledgements', {
          params: {
            path: { noticeId },
            query: { ...(pendingOnly ? { pendingOnly: true } : {}), page: 1, size: ACK_PAGE_SIZE },
          },
        }),
      ).then((data) => ({
        items: data.items.map(toAckView),
        page: data.page,
      }));
    },
  });
};

const KNOWN_FIELDS = [
  'title',
  'body',
  'startDate',
  'endDate',
  'scopeCode',
  'targetWorkOrderId',
] as const;

export const useNoticeCreate = (
  onSuccess: (created: NoticeView) => void,
): MasterWriteResult<NoticeCreate> => {
  const { client } = useApiClient();

  return useMasterWrite<NoticeCreate, Notice>({
    request: (body, headers) =>
      client.POST('/app/notices', {
        params: { header: { 'Idempotency-Key': headers['Idempotency-Key'] } },
        body,
      }),
    etagPath: null,
    invalidateKeys: [noticeKeys.all],
    knownFields: KNOWN_FIELDS,
    /* 작성만 하는 쓰기다 — 게시는 따로 누른다. 잘못 쓴 초안은 고칠 수 있다. */
    keyLifetime: 'per-attempt',
    onSuccess: (data) => {
      onSuccess(toNoticeView(data));
    },
  });
};

export const useNoticeUpdate = (
  noticeId: number | null,
  onSuccess: () => void,
): MasterWriteResult<NoticeCreate> => {
  const { client } = useApiClient();

  return useMasterWrite<NoticeCreate, Notice>({
    request: (body, headers) =>
      client.PUT('/app/notices/{noticeId}', {
        params: {
          path: { noticeId: noticeId ?? 0 },
          header: {
            'Idempotency-Key': headers['Idempotency-Key'],
            'If-Match': requireIfMatch(headers),
          },
        },
        body,
      }),
    etagPath: noticeId === null ? null : noticeDetailPath(noticeId),
    invalidateKeys: [noticeKeys.all],
    knownFields: KNOWN_FIELDS,
    keyLifetime: 'per-attempt',
    onSuccess,
  });
};

/**
 * 게시 — **되돌릴 수 없다.** 게시하면 본문이 잠기고, 이미 확인한 사람이 생긴다.
 *
 * ⛔ 본문이 없는 액션이라 멱등 키 수명을 `until-applied` 로 두지 않는다 — 고쳐서 다시 보낼
 * 것이 없는데 키가 남으면 뒤엣것이 통하지 않는다.
 */
export const useNoticePublish = (
  noticeId: number | null,
  onSuccess: () => void,
): MasterWriteResult<Record<string, never>> => {
  const { client } = useApiClient();

  return useMasterWrite<Record<string, never>, Notice>({
    request: (_body, headers) =>
      client.POST('/app/notices/{noticeId}:publish', {
        params: {
          path: { noticeId: noticeId ?? 0 },
          header: {
            'Idempotency-Key': headers['Idempotency-Key'],
            'If-Match': requireIfMatch(headers),
          },
        },
      }),
    etagPath: noticeId === null ? null : noticeDetailPath(noticeId),
    invalidateKeys: [noticeKeys.all],
    knownFields: [],
    keyLifetime: 'per-attempt',
    onSuccess,
  });
};

/** 종료 — 지우지 않고 종료일을 당긴다. 확인 이력이 남아야 한다. */
export const useNoticeClose = (
  noticeId: number | null,
  onSuccess: () => void,
): MasterWriteResult<Record<string, never>> => {
  const { client } = useApiClient();

  return useMasterWrite<Record<string, never>, Notice>({
    request: (_body, headers) =>
      client.POST('/app/notices/{noticeId}:close', {
        params: {
          path: { noticeId: noticeId ?? 0 },
          header: {
            'Idempotency-Key': headers['Idempotency-Key'],
            'If-Match': requireIfMatch(headers),
          },
        },
      }),
    etagPath: noticeId === null ? null : noticeDetailPath(noticeId),
    invalidateKeys: [noticeKeys.all],
    knownFields: [],
    keyLifetime: 'per-attempt',
    onSuccess,
  });
};

/**
 * 읽은 사람이 스스로 누르는 확인.
 *
 * ⛔ 잠금 토큰을 싣지 않는다 — 계약이 요구하지 않는다. 확인은 공지를 고치는 일이 아니라
 * 내 이름으로 한 줄을 더하는 일이다.
 */
export const useAcknowledge = (
  noticeId: number | null,
  onSuccess: () => void,
): MasterWriteResult<Record<string, never>> => {
  const { client } = useApiClient();

  return useMasterWrite<Record<string, never>, undefined>({
    request: (_body, headers) =>
      client.POST('/app/notices/{noticeId}:acknowledge', {
        params: {
          path: { noticeId: noticeId ?? 0 },
          header: { 'Idempotency-Key': headers['Idempotency-Key'] },
        },
      }),
    etagPath: null,
    invalidateKeys: [noticeKeys.all],
    knownFields: [],
    keyLifetime: 'per-attempt',
    onSuccess,
  });
};

/**
 * 확인하지 **않고** 닫았다를 기록한다.
 *
 * ⭐ **확인과 닫음을 나누는 이유는 「확인하지 않았다」가 이력에 남아야 하기 때문이다** —
 * 남기려면 닫은 것도 기록해야 한다.
 *
 * ⚠ **확인을 요구한 공지에는 이 호출이 거부된다.** 그 공지는 닫을 수 없다 — 화면이 먼저
 * 잠그고 사유를 적는다.
 */
export const useDismiss = (
  noticeId: number | null,
  onSuccess: () => void,
): MasterWriteResult<Record<string, never>> => {
  const { client } = useApiClient();

  return useMasterWrite<Record<string, never>, undefined>({
    request: (_body, headers) =>
      client.POST('/app/notices/{noticeId}:dismiss', {
        params: {
          path: { noticeId: noticeId ?? 0 },
          header: { 'Idempotency-Key': headers['Idempotency-Key'] },
        },
      }),
    etagPath: null,
    invalidateKeys: [noticeKeys.all],
    knownFields: [],
    keyLifetime: 'per-attempt',
    onSuccess,
  });
};
