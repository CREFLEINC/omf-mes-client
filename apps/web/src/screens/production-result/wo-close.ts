import type { components, WorkOrderForward, WorkSessionForward } from '@omf-mes/api-client';
import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';

import { useApiClient } from '../../patterns/api-context';
import { useMasterWrite, type MasterWriteResult } from '../../patterns/master';
import { runRequest, runRequestWithResponse } from '../../patterns/request';
import { RUNNING_STATUS_CODE } from '../work-hold-register/types';
import { buildSessionEnd } from './session';

type WorkOrderClose = components['schemas']['WorkOrderClose'];
type WorkSessionEnd = components['schemas']['WorkSessionEnd'];

/** 서버 마감 전이가 받는 출발 상태. */
export const CLOSABLE_STATUSES: readonly string[] = ['IN_PROGRESS', 'SUSPENDED', 'COMPLETED'];

const closeKeys = {
  target: (workOrderId: number) => ['production-flow', 'close-target', workOrderId] as const,
  openLots: (workOrderId: number) => ['production-flow', 'close-open-lots', workOrderId] as const,
  sessions: (workOrderId: number) => ['production-flow', 'close-sessions', workOrderId] as const,
};

export interface CloseTarget {
  workOrder: WorkOrderForward;
  /** 이 응답의 잠금 값. 마감은 이것을 `If-Match` 로 싣는다 */
  etag: string | null;
}

/**
 * 창을 열 때 다시 읽는 마감 대상. 마감은 `If-Match` 가 필수라, 판정과 잠금 값이 같은 응답에서
 * 와야 한다. 잠금 값은 경로마다 하나만 보관되어 화면의 상세 조회가 다시 읽히면 바뀌므로, 이
 * 응답의 ETag 를 직접 잡아 둔다 — 창이 보인 판정과 다른 판의 잠금 값으로 마감하지 않게.
 */
export const useCloseTarget = (
  workOrderId: number,
  enabled: boolean,
): UseQueryResult<CloseTarget> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: closeKeys.target(workOrderId),
    enabled,
    staleTime: 0,
    queryFn: async () => {
      const { data, response } = await runRequestWithResponse(() =>
        client.GET('/production/work-orders/{workOrderId}', {
          params: {
            path: { workOrderId },
            query: { withProgress: true, withPreIssuedLots: true },
          },
        }),
      );

      return { workOrder: data as WorkOrderForward, etag: response.headers.get('ETag') };
    },
  });
};

const OPEN_LOT_PAGE_SIZE = 100;

/** 마감해도 그대로 남는 진행 중(ACTIVE·미완료) LOT 번호. 실적 없는 대기 슬롯은 폐번되므로 뺀다. */
export interface CloseOpenLots {
  lotNos: string[];
  /** 받은 쪽 밖에 더 있을 수 있는 미완료 LOT 수. 진행 중인지는 모른다 */
  uncheckedCount: number;
}

export const useCloseOpenLots = (
  workOrderId: number,
  enabled: boolean,
): UseQueryResult<CloseOpenLots> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: closeKeys.openLots(workOrderId),
    enabled,
    queryFn: async () => {
      const data = await runRequest(() =>
        client.GET('/trace/lots', {
          params: {
            query: { workOrderId, completed: false, page: 1, size: OPEN_LOT_PAGE_SIZE },
          },
        }),
      );

      return {
        lotNos: data.items
          .filter((lot) => lot.lifecycleStatusCode === 'ACTIVE')
          .map((lot) => lot.lotNo),
        uncheckedCount: Math.max(0, data.page.total - data.items.length),
      };
    },
  });
};

export interface CloseAttempt {
  body: WorkOrderClose;
  etag: string;
}

/**
 * 작업지시 마감. 되돌릴 수 없는 전이라 멱등 키는 적용될 때까지 같은 값을 쓴다.
 * ⛔ 오프라인 큐에 싣지 않는다 — `If-Match` 가 필수라 큐가 잠금 값을 실어 보낼 수 없다.
 */
export const useWorkOrderCloseWrite = ({
  workOrderId,
  workerNo,
  onSuccess,
}: {
  workOrderId: number;
  workerNo: string;
  onSuccess: () => void;
}): MasterWriteResult<CloseAttempt> => {
  const { client } = useApiClient();

  return useMasterWrite<CloseAttempt, components['schemas']['WorkOrder']>({
    request: (variables, headers) =>
      client.POST('/production/work-orders/{workOrderId}:close', {
        params: {
          path: { workOrderId },
          header: {
            'Idempotency-Key': headers['Idempotency-Key'],
            'If-Match': variables.etag,
            'X-Worker-No': workerNo,
          },
        },
        body: variables.body,
      }),
    /* 잠금 값은 창이 판정을 읽은 응답의 것을 싣는다(`useCloseTarget`) — 보관소의 최신 값이 아니다. */
    etagPath: null,
    invalidateKeys: [['production-flow'], ['production-result']],
    knownFields: [],
    keyLifetime: 'until-applied',
    onSuccess,
  });
};

/** 마감 전에 보는 이 작업지시의 열린 세션 한 건. */
export interface CloseSessionView {
  workSessionId: number;
  terminalId: number;
  terminalCode: string | null;
  workerName: string | null;
  workerNo: string | null;
  isRunning: boolean;
}

const OPEN_SESSION_PAGE_SIZE = 50;

/**
 * 이 작업지시의 열린(중단 포함) 세션 — 단말을 가리지 않는다. 다른 단말이나 이 단말의 중단 세션이
 * 남아 있으면 서버가 마감을 거부하므로, 이 단말 세션을 끝내기 «전에» 그것부터 본다.
 */
export const useCloseSessions = (
  workOrderId: number,
  enabled: boolean,
): UseQueryResult<CloseSessionView[]> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: closeKeys.sessions(workOrderId),
    enabled,
    staleTime: 0,
    queryFn: async () => {
      const data = await runRequest(() =>
        client.GET('/production/work-sessions', {
          params: {
            query: { open: true, workOrderId, page: 1, size: OPEN_SESSION_PAGE_SIZE },
          },
        }),
      );

      return (data.items as WorkSessionForward[])
        .filter((session) => (session.endedAt ?? '') === '')
        .map((session) => ({
          workSessionId: session.workSessionId,
          terminalId: session.terminalId,
          terminalCode: session.terminalCode ?? null,
          workerName: session.workerName ?? null,
          workerNo: session.workerNo ?? null,
          isRunning: session.statusCode === RUNNING_STATUS_CODE,
        }));
    },
  });
};

export interface CloseSessionPlan {
  /** 마감 전에 이 단말이 끝낼 진행 중 세션. 없으면 null */
  ownSessionId: number | null;
  /** 이 단말이 끝낼 수 없어 마감을 막는 세션(다른 단말, 이 단말의 중단 세션) */
  blockers: CloseSessionView[];
}

export const planCloseSessions = (
  sessions: readonly CloseSessionView[],
  terminalId: number | null,
): CloseSessionPlan => {
  const own =
    sessions.find((session) => session.terminalId === terminalId && session.isRunning) ?? null;

  return {
    ownSessionId: own?.workSessionId ?? null,
    blockers: sessions.filter((session) => session !== own),
  };
};

interface SessionEndAttempt {
  workSessionId: number;
  body: WorkSessionEnd;
}

/**
 * 세션 끝내기 실패 — 응답 모양이 아니라 상태 코드로 가른다. 권한·없음 응답도 오류 봉투로 와서
 * 모양으로 가르면 검증 오류에 섞인다. 서버가 까닭을 준 그 밖의 거부는 서버 문구를 그대로 보인다.
 */
export type CloseEndFailure = 'forbidden' | 'notFound' | 'server' | 'other';

export interface CloseSequence {
  start: (attempt: CloseAttempt, ownSessionId: number | null) => void;
  reset: () => void;
  /** 보내는 중이거나, 이미 끝난 세션을 확인하려고 다시 읽는 중 */
  isSaving: boolean;
  /** 이 단말 세션을 끝내지 못했다. 이미 끝나 있던 것(STATE_LOCKED)은 실패가 아니다 */
  endFailure: CloseEndFailure | null;
  endError: MasterWriteResult<SessionEndAttempt>['error'];
  closeError: MasterWriteResult<CloseAttempt>['error'];
  /** 이 단말 세션은 끝났는데 마감은 되지 않았다 — 따로 알린다 */
  endedButNotClosed: boolean;
}

/**
 * 마감 전송 순서 — 이 단말의 진행 중 세션을 끝내고(`:end`) 마감한다(`:close`).
 *
 * ⭐ 끝낸 시각은 한 번의 시도에 정해 두고 다시 시도해도 같은 값을 보낸다 — 멱등 키가 보낸 값으로
 *    정해지므로, 시각이 바뀌면 재시도가 새 종료로 읽힌다.
 * ⭐ `:end` 가 STATE_LOCKED 면 이미 끝난 세션이다(관리웹 강제 종료 등). 세션을 다시 읽어 막는
 *    세션이 없을 때만 마감으로 넘어간다.
 */
export const useCloseSequence = ({
  workOrderId,
  workerNo,
  onClosed,
  recheckSessions,
}: {
  workOrderId: number;
  workerNo: string;
  onClosed: () => void;
  recheckSessions: () => Promise<CloseSessionPlan | null>;
}): CloseSequence => {
  const { client } = useApiClient();
  const attempt = useRef<SessionEndAttempt | null>(null);
  const pendingClose = useRef<CloseAttempt | null>(null);
  const [endedSessionId, setEndedSessionId] = useState<number | null>(null);
  const [isRechecking, setIsRechecking] = useState(false);

  const closeWrite = useWorkOrderCloseWrite({ workOrderId, workerNo, onSuccess: onClosed });
  const proceedToClose = (workSessionId: number) => {
    setEndedSessionId(workSessionId);
    if (pendingClose.current !== null) closeWrite.write(pendingClose.current);
  };
  const endWrite = useMasterWrite<SessionEndAttempt, components['schemas']['WorkSession']>({
    request: (variables, headers) =>
      client.POST('/production/work-sessions/{workSessionId}:end', {
        params: {
          path: { workSessionId: variables.workSessionId },
          header: { 'Idempotency-Key': headers['Idempotency-Key'], 'X-Worker-No': workerNo },
        },
        body: variables.body,
      }),
    etagPath: null,
    invalidateKeys: [['production-flow', 'work-session']],
    knownFields: [],
    keyLifetime: 'until-applied',
    onSuccess: (session) => proceedToClose(session.workSessionId),
  });

  const endError = endWrite.error;
  const alreadyEnded = endError?.kind === 'stateLocked';
  const handled = useRef<SessionEndAttempt | null>(null);
  const recheckRef = useRef(recheckSessions);
  recheckRef.current = recheckSessions;
  const proceedRef = useRef(proceedToClose);
  proceedRef.current = proceedToClose;
  useEffect(() => {
    const current = attempt.current;
    if (!alreadyEnded || current === null || handled.current === current) return;
    handled.current = current;
    setIsRechecking(true);
    void recheckRef.current().then((plan) => {
      setIsRechecking(false);
      if (plan !== null && plan.blockers.length === 0) proceedRef.current(current.workSessionId);
    });
  }, [alreadyEnded]);

  const start = (next: CloseAttempt, ownSessionId: number | null) => {
    pendingClose.current = next;
    if (ownSessionId === null || ownSessionId === endedSessionId) {
      closeWrite.write(next);
      return;
    }
    if (attempt.current?.workSessionId !== ownSessionId) {
      attempt.current = { workSessionId: ownSessionId, body: buildSessionEnd(new Date()) };
    }
    endWrite.write(attempt.current);
  };

  const endStatus = endError !== null && 'status' in endError ? endError.status : undefined;
  const endFailure: CloseEndFailure | null =
    endError === null || alreadyEnded
      ? null
      : endStatus === 403
        ? 'forbidden'
        : endStatus === 404
          ? 'notFound'
          : endError.kind === 'validation'
            ? 'server'
            : 'other';

  return {
    start,
    reset: () => {
      attempt.current = null;
      pendingClose.current = null;
      handled.current = null;
      setEndedSessionId(null);
      setIsRechecking(false);
      endWrite.reset();
      closeWrite.reset();
    },
    isSaving: endWrite.isSaving || closeWrite.isSaving || isRechecking,
    endFailure,
    endError: endFailure === 'server' ? endError : null,
    closeError: closeWrite.error,
    endedButNotClosed: endedSessionId !== null && closeWrite.error !== null,
  };
};
