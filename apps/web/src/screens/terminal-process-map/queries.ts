import type { components } from '@omf-mes/api-client';
import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { useApiClient } from '../../patterns/api-context';
import { requireIfMatch, useMasterWrite, type MasterWriteResult } from '../../patterns/master';
import { runRequest } from '../../patterns/request';
import type { TerminalFilters } from './filters';
import {
  toProcessRowView,
  toTerminalView,
  toTokenView,
  type ProcessRowView,
  type TerminalListResult,
  type TerminalView,
  type TokenView,
} from './types';

/**
 * 이 화면의 오퍼레이션.
 *
 * ⭐ **잠금 토큰이 두 축으로 갈린다.**
 * - 단말 자체를 고치거나 중지할 때는 **단말 상세**가 준 토큰을 싣는다.
 * - 기능 구성을 통째로 바꿀 때는 **기능 구성 조회**가 준 토큰을 싣는다.
 *
 * 착수 이슈는 「기능 구성 표에 버전 칸이 없으니 단말 쪽 버전을 실어라」고 적었지만, 그 뒤
 * 계약이 기능 구성 조회 200 에 `ETag` 를 신설했다. **바꾸는 자원이 스스로 판 번호를 가지면
 * 그것을 쓴다** — 단말 쪽 버전은 다른 사람이 구성 표만 고쳤을 때 움직이지 않아, 정작 막아야
 * 할 충돌을 못 막는다. 이 차이는 완료 보고에 어긋남으로 남긴다.
 *
 * 경로 리터럴은 이 파일에만 둔다 — `openapi-fetch`가 경로를 리터럴 타입으로 요구해 문자열
 * 변수로 넘기면 타입 검사가 풀린다.
 */

type Terminal = components['schemas']['Terminal'];
type TerminalCreate = components['schemas']['TerminalCreate'];
type TerminalUpdate = components['schemas']['TerminalUpdate'];
type TerminalProcessReplace = components['schemas']['TerminalProcessReplace'];
type TerminalRegistrationToken = components['schemas']['TerminalRegistrationToken'];

export const PAGE_SIZE = 20;

export const terminalKeys = {
  all: ['terminal-process-map'] as const,
  list: (filters: TerminalFilters) =>
    ['terminal-process-map', 'list', filters.q, filters.includeInactive, filters.page] as const,
  terminal: (terminalId: number | null) =>
    ['terminal-process-map', 'terminal', terminalId ?? 0] as const,
  processes: (terminalId: number | null) =>
    ['terminal-process-map', 'processes', terminalId ?? 0] as const,
};

/** 단말 상세 경로 — **단말을 고치는 쓰기의 잠금 토큰이 여기 보관된다.** */
export const terminalDetailPath = (terminalId: number): string =>
  `/mdm/terminals/${String(terminalId)}`;

/** 기능 구성 조회 경로 — **구성을 통째로 바꾸는 쓰기의 잠금 토큰이 여기 보관된다.** */
export const processesPath = (terminalId: number): string =>
  `/mdm/terminals/${String(terminalId)}/processes`;

export const useTerminals = (filters: TerminalFilters): UseQueryResult<TerminalListResult> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: terminalKeys.list(filters),
    queryFn: () =>
      runRequest(() =>
        client.GET('/mdm/terminals', {
          params: {
            query: {
              ...(filters.q === '' ? {} : { q: filters.q }),
              /* 끄면 보내지 않는다 — 기본이 「사용 중만」이다. */
              ...(filters.includeInactive ? { includeInactive: true } : {}),
              page: filters.page,
              size: PAGE_SIZE,
            },
          },
        }),
      ).then((data) => ({
        items: data.items.map(toTerminalView),
        page: data.page,
      })),
  });
};

/** 고른 단말의 상세. 단말을 고치는 쓰기가 실을 잠금 토큰이 여기서 온다. */
export const useTerminalDetail = (terminalId: number | null): UseQueryResult<TerminalView> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: terminalKeys.terminal(terminalId),
    enabled: terminalId !== null,
    queryFn: () => {
      if (terminalId === null) throw new Error('단말을 고르기 전에는 상세를 조회하지 않습니다.');

      return runRequest(() =>
        client.GET('/mdm/terminals/{terminalId}', { params: { path: { terminalId } } }),
      ).then(toTerminalView);
    },
  });
};

/**
 * 고른 단말의 기능 구성.
 *
 * ⭐ **0건이 정상인 단말이 있다** — 창고 전용 단말은 공정 행이 없다. 빈 결과를 오류로 그리지
 * 않고, 「전부 금지」로도 「전부 허용」으로도 읽지 않는다.
 */
export const useTerminalProcesses = (
  terminalId: number | null,
): UseQueryResult<ProcessRowView[]> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: terminalKeys.processes(terminalId),
    enabled: terminalId !== null,
    queryFn: () => {
      if (terminalId === null) throw new Error('단말을 고르기 전에는 구성을 조회하지 않습니다.');

      return runRequest(() =>
        client.GET('/mdm/terminals/{terminalId}/processes', { params: { path: { terminalId } } }),
      ).then((data) => data.items.map(toProcessRowView));
    },
  });
};

const TERMINAL_FIELDS = [
  'terminalCode',
  'plantId',
  'terminalTypeCode',
  'statusCode',
  'equipmentId',
] as const;

export const useTerminalCreate = (
  onSuccess: (created: TerminalView) => void,
): MasterWriteResult<TerminalCreate> => {
  const { client } = useApiClient();

  return useMasterWrite<TerminalCreate, Terminal>({
    request: (body, headers) =>
      client.POST('/mdm/terminals', {
        params: { header: { 'Idempotency-Key': headers['Idempotency-Key'] } },
        body,
      }),
    /* 새 단말에는 잠글 앞선 값이 없다. */
    etagPath: null,
    invalidateKeys: [terminalKeys.all],
    knownFields: TERMINAL_FIELDS,
    /* 되돌릴 수 있는 쓰기다 — 잘못 만든 단말은 중지할 수 있다. */
    keyLifetime: 'per-attempt',
    onSuccess: (data) => {
      onSuccess(toTerminalView(data));
    },
  });
};

export const useTerminalUpdate = (
  terminalId: number | null,
  onSuccess: () => void,
): MasterWriteResult<TerminalUpdate> => {
  const { client } = useApiClient();

  return useMasterWrite<TerminalUpdate, Terminal>({
    request: (body, headers) =>
      client.PUT('/mdm/terminals/{terminalId}', {
        params: {
          path: { terminalId: terminalId ?? 0 },
          header: {
            'Idempotency-Key': headers['Idempotency-Key'],
            'If-Match': requireIfMatch(headers),
          },
        },
        body,
      }),
    etagPath: terminalId === null ? null : terminalDetailPath(terminalId),
    invalidateKeys: [terminalKeys.all],
    knownFields: TERMINAL_FIELDS,
    keyLifetime: 'per-attempt',
    onSuccess,
  });
};

/**
 * 사용 중지. 지우지 않고 끈다 — 그 단말이 남긴 기록이 참조로 남아 있다.
 *
 * ⛔ 본문이 없는 액션이라 멱등 키 수명을 `until-applied` 로 두지 않는다 — 그러면 고쳐서 다시
 * 보낼 것이 없는데도 같은 키가 남아 뒤엣것이 통하지 않는다.
 */
export const useTerminalDeactivate = (
  terminalId: number | null,
  onSuccess: () => void,
): MasterWriteResult<Record<string, never>> => {
  const { client } = useApiClient();

  return useMasterWrite<Record<string, never>, Terminal>({
    request: (_body, headers) =>
      client.POST('/mdm/terminals/{terminalId}:deactivate', {
        params: {
          path: { terminalId: terminalId ?? 0 },
          header: {
            'Idempotency-Key': headers['Idempotency-Key'],
            'If-Match': requireIfMatch(headers),
          },
        },
      }),
    etagPath: terminalId === null ? null : terminalDetailPath(terminalId),
    invalidateKeys: [terminalKeys.all],
    knownFields: [],
    keyLifetime: 'per-attempt',
    onSuccess,
  });
};

/**
 * 기능 구성 저장 — **단말 하나의 구성을 통째로 바꾼다.**
 *
 * ⭐ 잠금 토큰은 **기능 구성 조회**가 준 것이다. 바꾸는 자원이 스스로 판 번호를 갖기 때문이고,
 * 빠진 행이 지워지는 저장이라 「내가 본 표 위에 적는다」가 반드시 참이어야 한다.
 */
export const useProcessesReplace = (
  terminalId: number | null,
  onSuccess: () => void,
): MasterWriteResult<TerminalProcessReplace> => {
  const { client } = useApiClient();

  return useMasterWrite<
    TerminalProcessReplace,
    { items: components['schemas']['TerminalProcess'][] }
  >({
    request: (body, headers) =>
      client.PUT('/mdm/terminals/{terminalId}/processes', {
        params: {
          path: { terminalId: terminalId ?? 0 },
          header: {
            'Idempotency-Key': headers['Idempotency-Key'],
            'If-Match': requireIfMatch(headers),
          },
        },
        body,
      }),
    etagPath: terminalId === null ? null : processesPath(terminalId),
    invalidateKeys: [terminalKeys.all],
    knownFields: ['items'],
    /*
     * ⭐ 되돌릴 수 없는 쓰기다 — 빠진 행이 지워지고 그 행을 화면이 되살릴 수 없다. 통신이
     * 끊긴 뒤 다시 눌렀을 때 같은 저장이 두 번 적용되지 않도록 키를 붙들어 둔다.
     */
    keyLifetime: 'until-applied',
    onSuccess,
  });
};

/**
 * 등록 토큰 발급.
 *
 * ⭐ **재발급하면 이전에 등록한 기기가 모두 끊긴다** — 계약이 세대 번호를 올리고 이전 토큰을
 * 거부한다. 화면은 그 사실을 누르기 전에 말한다.
 *
 * ⛔ 잠금 토큰을 싣지 않는다 — 계약이 요구하지 않는다. 발급은 앞선 값을 고치는 일이 아니다.
 */
export const useTokenIssue = (
  terminalId: number | null,
  onSuccess: (token: TokenView) => void,
): MasterWriteResult<Record<string, never>> => {
  const { client } = useApiClient();

  return useMasterWrite<Record<string, never>, TerminalRegistrationToken>({
    request: (_body, headers) =>
      client.POST('/mdm/terminals/{terminalId}:issue-token', {
        params: {
          path: { terminalId: terminalId ?? 0 },
          header: { 'Idempotency-Key': headers['Idempotency-Key'] },
        },
      }),
    etagPath: null,
    invalidateKeys: [terminalKeys.all],
    knownFields: [],
    keyLifetime: 'per-attempt',
    onSuccess: (data) => {
      onSuccess(toTokenView(data));
    },
  });
};
