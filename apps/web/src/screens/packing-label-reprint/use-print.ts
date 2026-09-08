import { useCallback, useRef, useState } from 'react';

import { useApiClient } from '../../patterns/api-context';
import { runRequest } from '../../patterns/request';
import {
  LABEL_RENDITION_FORMAT,
  printAll,
  renditionShell,
  type PrintOutcome,
  type PrintTarget,
} from './print';

/**
 * 인쇄 절차를 화면에 붙인다 — ③ 세 걸음의 진행 상태와 실행.
 *
 * ⚠ **`useMasterWrite` 를 쓰지 않는다.** 그 부품의 `write` 는 값을 돌려주지 않아 「보내고
 * 결과를 보고한다」를 장마다 이어 붙일 수 없다. 사람이 누르는 저장이 아니라 절차라서 형태가
 * 다르다 — 대신 멱등 키·오류 정규화 같은 규약은 여기서도 그대로 지킨다.
 */

export type PrintPhase = 'idle' | 'sending' | 'succeeded' | 'failed' | 'shellUnavailable';

export interface PrintState {
  phase: PrintPhase;
  /** 실제로 나간 장수. 실패했어도 여기까지는 나왔다 */
  printed: number;
  /** 실패 사유. 서버·셸이 준 말이다 */
  reason: string | null;
  /**
   * 이번에 인쇄하려던 것들.
   *
   * ⭐ **다시 인쇄가 여기서 나온다.** 실패 뒤 복구는 「다시 «인쇄»」이지 「다시 «발행»」이 아니라
   * (다시 발행하면 회차가 또 오른다), 부르는 쪽이 발행 결과를 따로 들고 있지 않아도 되게
   * 이 상태가 대상을 기억한다.
   */
  targets: readonly PrintTarget[];
}

const IDLE: PrintState = { phase: 'idle', printed: 0, reason: null, targets: [] };

export interface PrintRunner {
  state: PrintState;
  /** 인쇄를 시작한다. 셸이 없으면 보내지 않고 사유만 남긴다 */
  run: (targets: readonly PrintTarget[]) => Promise<void>;
  reset: () => void;
}

export const usePrintRunner = (workerNo: string | null): PrintRunner => {
  const { client } = useApiClient();
  const [state, setState] = useState<PrintState>(IDLE);

  /**
   * 결과 보고의 멱등 키를 **보고 한 건마다 하나로 고정**한다.
   *
   * ⛔ 재시도마다 새 키를 만들면 같은 보고가 다른 쓰기로 나가, 서버가 「이미 보고된 건」으로
   * 되돌린 422 를 화면이 「보고 실패」로 읽는다.
   */
  const reportKeys = useRef(new Map<string, string>());

  const reportKeyFor = useCallback((documentIssueLogId: number, failed: boolean): string => {
    const slot = `${String(documentIssueLogId)}:${failed ? 'FAILED' : 'SUCCEEDED'}`;
    const existing = reportKeys.current.get(slot);

    if (existing !== undefined) return existing;

    const created = crypto.randomUUID();
    reportKeys.current.set(slot, created);

    return created;
  }, []);

  const run = useCallback(
    async (targets: readonly PrintTarget[]): Promise<void> => {
      const shell = renditionShell();

      if (shell === null) {
        /* 셸 밖(브라우저)이다. 발행은 이미 끝났고 인쇄만 여기서 할 수 없다. */
        setState({ phase: 'shellUnavailable', printed: 0, reason: null, targets });
        return;
      }

      if (workerNo === null) {
        /* 결과 보고가 사번을 요구한다 — 보낼 수 없는 절차를 시작하지 않는다. */
        setState({ phase: 'shellUnavailable', printed: 0, reason: null, targets });
        return;
      }

      setState({ phase: 'sending', printed: 0, reason: null, targets });

      const outcome: PrintOutcome = await printAll(targets, {
        fetchRendition: async (documentIssueLogId) => {
          const data = await runRequest<ArrayBuffer>(() =>
            client.GET('/app/document-issues/{documentIssueLogId}/rendition', {
              params: {
                path: { documentIssueLogId },
                query: { format: LABEL_RENDITION_FORMAT },
              },
              parseAs: 'arrayBuffer',
            }),
          );

          return new Uint8Array(data);
        },
        send: async (bytes, label) => {
          await shell.save(bytes, label, new Date().toISOString(), LABEL_RENDITION_FORMAT);
        },
        report: async (documentIssueLogId, failureReason) => {
          await runRequest(() =>
            client.POST('/app/document-issues/{documentIssueLogId}:report-print', {
              params: {
                header: {
                  'Idempotency-Key': reportKeyFor(documentIssueLogId, failureReason !== null),
                  'X-Worker-No': workerNo,
                },
                path: { documentIssueLogId },
              },
              body:
                failureReason === null
                  ? { outcome: 'SUCCEEDED' }
                  : { outcome: 'FAILED', failureReason },
            }),
          );
        },
      });

      setState(
        outcome.ok
          ? { phase: 'succeeded', printed: outcome.printed, reason: null, targets }
          : {
              phase: 'failed',
              printed: outcome.printed,
              reason: outcome.reason,
              /*
               * ⭐ **나간 것을 빼고 남긴다.** 실패 지점부터 이어 인쇄해야 이미 나온 라벨을
               * 다시 찍지 않는다 — 종이가 두 장 나오면 어느 것이 유효한지 현장이 알 수 없다.
               */
              targets: targets.slice(outcome.printed),
            },
      );
    },
    [client, reportKeyFor, workerNo],
  );

  const reset = useCallback(() => {
    setState(IDLE);
  }, []);

  return { state, run, reset };
};
