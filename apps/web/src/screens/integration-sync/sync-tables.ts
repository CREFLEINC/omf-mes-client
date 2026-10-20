import type { ChipStatus } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from '@tanstack/react-query';

import { useApiClient } from '../../patterns/api-context';
import { runRequest, type ApiCallResult } from '../../patterns/request';
import { formatDateTime } from './message-status';

/**
 * ERP 받기 표 여덟의 상태와 「지금 읽기」(omf-mes-server#757 · 장부 P-81).
 *
 * ⚠ **계약 사본에 없는 경로 둘이다.** 서버가 계약보다 먼저 연 것이라 `@omf-mes/api-client` 생성 타입에
 * 없다. 응답 모양을 서버 `erp-sync-status.service.ts` 에서 **여기에 손으로 옮기고**, `openapi-fetch` 가
 * 경로를 리터럴 타입으로 요구하므로 이 두 경로만 받는 모양으로 클라이언트를 **좁혀 본다**
 * (`inbound-schedule/queries.ts` 와 같은 길). 실행은 같은 클라이언트가 한다 — 인증 쿠키·오류 정규화가 그대로 선다.
 *
 * 정본에 실려 `gen:api` 가 만들면 이 타입과 좁힘을 지우고 `client.GET`·`client.POST` 를 바로 부른다.
 *
 * **「지금 읽기」는 적어 두기만 한다.** 리스를 쥔 실행기가 10초 안에 그 표를 돌고, 다 돌면 요청 시각을
 * 지운다. 그래서 화면은 요청이 걸려 있거나 도는 중인 표가 있는 동안 목록을 몇 초마다 다시 읽어
 * 끝을 안다 — `requestedAt` 이 비고 `lastFinishedAt` 이 바뀌면 다 읽은 것이다.
 */

const t = messages.integrationSync.syncTables;

/** 마지막으로 끝난 회차의 결과. 서버가 이 둘만 쓴다. */
export const SYNC_RESULT = { succeeded: 'SUCCEEDED', failed: 'FAILED' } as const;

export interface SyncTableStatus {
  /** 연계 메시지의 인터페이스 코드(`IF-ERP-*-RECV`)와 같다. 「지금 읽기」 경로의 키다. */
  interfaceCode: string;
  name: string;
  /** `MASTER`(기준정보 · 12시간) · `ORDER`(전표 · 15분). */
  laneCode: string;
  laneName: string;
  /** 지금 이 표를 도는 중. */
  running: boolean;
  /** 「지금 읽기」가 걸려 있으면 그 시각. 실행기가 그 회차를 **마치면** 지운다. */
  requestedAt: string | null;
  lastStartedAt: string | null;
  /** 아래 결과 칸은 «마지막으로 끝난» 회차의 것이다 — 도는 중이면 그 앞 회차다. */
  lastFinishedAt: string | null;
  lastStatusCode: string | null;
  lastReadCount: number | null;
  lastAppliedCount: number | null;
  lastFailedCount: number | null;
  lastHeldCount: number | null;
  lastErrorMessage: string | null;
  /** 다음 주기 회차 예정. 실행기가 아직 한 번도 돌지 않았으면 null. */
  nextRunAt: string | null;
}

export interface SyncTablesResult {
  /** 이 서버에서 ERP 연동이 켜져 있는가. 꺼져 있으면 「지금 읽기」가 400 이다. */
  enabled: boolean;
  items: SyncTableStatus[];
}

export interface SyncRunAccepted {
  interfaceCode: string;
  requestedAt: string;
}

interface SyncTablesClient {
  GET: (path: '/integration/erp-sync/tables') => Promise<ApiCallResult<SyncTablesResult>>;
  POST: (
    path: '/integration/erp-sync/tables/{interfaceCode}:run',
    init: { params: { path: { interfaceCode: string } } },
  ) => Promise<ApiCallResult<SyncRunAccepted>>;
}

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
  const syncClient = client as unknown as SyncTablesClient;

  return useQuery({
    queryKey: syncTableKeys.all,
    queryFn: () => runRequest(() => syncClient.GET('/integration/erp-sync/tables')),
    refetchInterval: (query) => (isSyncBusy(query.state.data) ? SYNC_POLL_MS : false),
  });
};

/**
 * 「지금 읽기」. **멱등 키를 보내지 않는다** — 계약 밖 경로라 요구하지 않고, 이미 걸린 요청은 서버가
 * 처음 시각을 지켜 여러 번 눌러도 한 번 돈다. 받으면 목록을 다시 읽어 요청 시각을 보이고, 그때부터
 * `useSyncTables` 가 바쁜 동안 다시 읽는다.
 */
export const useRequestSyncRun = (): UseMutationResult<SyncRunAccepted, Error, string> => {
  const { client } = useApiClient();
  const queryClient = useQueryClient();
  const syncClient = client as unknown as SyncTablesClient;

  return useMutation({
    mutationFn: (interfaceCode: string) =>
      runRequest(() =>
        syncClient.POST('/integration/erp-sync/tables/{interfaceCode}:run', {
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
