import type { ChipStatus } from '@crefle/web-ui';
import type { components, paths } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';
import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from '@tanstack/react-query';

import { useApiClient } from '../../patterns/api-context';
import { runRequest } from '../../patterns/request';
import { formatDateTime } from '../integration-sync/message-status';

/**
 * ERP 받기 표 여덟의 상태와 「지금 읽기」(omf-mes-server#757 · 장부 P-81 · 계약 server #920).
 *
 * **「지금 읽기」는 적어 두기만 한다.** 리스를 쥔 실행기가 10초 안에 그 표를 돌고, 다 돌면 요청 시각을
 * 지운다. 그래서 화면은 요청이 걸려 있거나 도는 중인 표가 있는 동안 목록을 몇 초마다 다시 읽어
 * 끝을 안다 — `requestedAt` 이 비고 `lastFinishedAt` 이 바뀌면 다 읽은 것이다.
 */

const t = messages.erpInbound;

/** 마지막으로 끝난 회차의 결과. 서버가 이 둘만 쓴다. */
export const SYNC_RESULT = { succeeded: 'SUCCEEDED', failed: 'FAILED' } as const;

type ErpSyncTableStatus = components['schemas']['ErpSyncTableStatus'];

/**
 * 표 하나의 상태. 결과 칸(`last*`)은 «마지막으로 끝난» 회차의 것이다 — 도는 중이면 그 앞 회차다.
 * `lastStatusCode` 만 넓힌다 — 서버가 결과를 더해도 화면은 모르는 코드를 그대로 낸다.
 */
export type SyncTableStatus = Omit<ErpSyncTableStatus, 'lastStatusCode'> & {
  lastStatusCode: NonNullable<ErpSyncTableStatus['lastStatusCode']> | (string & {}) | null;
};

/** `enabled` 가 거짓이면 이 서버에서 ERP 연동이 꺼져 있어 「지금 읽기」가 400 이다. */
export type SyncTablesResult = Omit<components['schemas']['ErpSyncStatus'], 'items'> & {
  items: SyncTableStatus[];
};

export type SyncRunAccepted =
  paths['/integration/erp-sync/tables/{interfaceCode}:run']['post']['responses'][202]['content']['application/json'];

/** 요청이 걸려 있거나 도는 동안 다시 읽는 간격. 실행기가 10초마다 요청을 보므로 그보다 잘게 본다. */
export const SYNC_POLL_MS = 3000;

export const syncTableKeys = {
  all: ['erp-sync-tables'] as const,
};

/** 요청이 걸렸거나 도는 표가 하나라도 있는가 — 있는 동안만 다시 읽는다. */
export const isSyncBusy = (data: SyncTablesResult | undefined): boolean =>
  data?.items.some((item) => item.requestedAt !== null || item.running) ?? false;

/**
 * 표별 상태.
 *
 * **바쁠 때만 다시 읽는다.** 늘 읽으면 화면을 열어 둔 사람마다 서버에 요청이 쌓인다. 「지금 읽기」를
 * 누르지 않아도 주기 회차가 도는 중이면(`running`) 함께 따라간다 — 새로고침으로 들어와도 같다.
 */
export const useSyncTables = (): UseQueryResult<SyncTablesResult> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: syncTableKeys.all,
    queryFn: () => runRequest(() => client.GET('/integration/erp-sync/tables')),
    refetchInterval: (query) => (isSyncBusy(query.state.data) ? SYNC_POLL_MS : false),
  });
};

/**
 * 「지금 읽기」. **멱등 키를 보내지 않는다** — 계약이 요구하지 않고, 이미 걸린 요청은 서버가
 * 처음 시각을 지켜 여러 번 눌러도 한 번 돈다. 받으면 목록을 다시 읽어 요청 시각을 보이고, 그때부터
 * `useSyncTables` 가 바쁜 동안 다시 읽는다.
 */
export const useRequestSyncRun = (): UseMutationResult<SyncRunAccepted, Error, string> => {
  const { client } = useApiClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (interfaceCode: string) =>
      runRequest(() =>
        client.POST('/integration/erp-sync/tables/{interfaceCode}:run', {
          params: { path: { interfaceCode } },
        }),
      ),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: syncTableKeys.all }),
  });
};

export interface SyncStateView {
  tone: ChipStatus;
  label: string;
  /** 칩 아래 보조 한 줄 — 요청 시각이나 실패 사유. 없으면 null. */
  note: string | null;
}

/**
 * 상태 열. **지금 벌어지는 일이 지난 결과보다 먼저 읽힌다** — 도는 중 → 요청 대기 → 마지막 결과 순이다.
 *
 * 모르는 결과 코드에는 이름을 붙이지 않고 코드 그대로 낸다(값을 지어내지 않는다).
 */
export const toSyncStateView = (item: SyncTableStatus): SyncStateView => {
  if (item.running) return { tone: 'info', label: t.state.running, note: null };

  if (item.requestedAt !== null) {
    const at = formatDateTime(item.requestedAt);

    return { tone: 'info', label: t.state.requested, note: at === null ? null : t.requestedAt(at) };
  }

  switch (item.lastStatusCode) {
    case null:
      return { tone: 'idle', label: t.state.never, note: null };
    case SYNC_RESULT.succeeded:
      return { tone: 'success', label: t.state.succeeded, note: null };
    case SYNC_RESULT.failed:
      return { tone: 'error', label: t.state.failed, note: item.lastErrorMessage };
    default:
      return { tone: 'idle', label: item.lastStatusCode, note: item.lastErrorMessage };
  }
};

/**
 * 누른 표가 다 읽혔는가 — 서버가 알려 준 끝의 기준 그대로다(요청 시각이 비고 마지막 끝난 시각이 바뀌었다).
 *
 * `baseline` 은 누를 때 보이던 `lastFinishedAt` 이다. 요청 시각만 보고 끝으로 치면, 누른 직후 목록이
 * 아직 요청을 싣지 않은 순간을 「끝났다」로 읽는다.
 */
export const isRunFinished = (item: SyncTableStatus, baseline: string | null): boolean =>
  item.requestedAt === null && !item.running && item.lastFinishedAt !== baseline;
