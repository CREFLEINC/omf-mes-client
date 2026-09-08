import { useCallback, useRef, useState } from 'react';

import { useApiClient } from '../../patterns/api-context';
import {
  labelRenditionFormat,
  type LabelRenditionFormat,
} from '../../patterns/pop-label-rendition';
import { runRequest } from '../../patterns/request';

export interface PrintTarget {
  documentIssueLogId: number;
  label: string;
}

export type PrintPhase = 'idle' | 'sending' | 'succeeded' | 'failed' | 'shellUnavailable';

export interface PrintState {
  phase: PrintPhase;
  printed: number;
  reason: string | null;
}

interface RenditionShell {
  save: (
    bytes: Uint8Array,
    label: string,
    now: string,
    format: LabelRenditionFormat | 'pdf',
  ) => Promise<string>;
}

interface ShellCarrier {
  pop?: { rendition?: RenditionShell };
}

const shellOf = (): RenditionShell | null => {
  if (typeof window === 'undefined') return null;

  const shell = (window as unknown as ShellCarrier).pop?.rendition;

  return typeof shell?.save === 'function' ? shell : null;
};

const reasonOf = (error: unknown): string =>
  error instanceof Error && error.message.trim() !== '' ? error.message : '인쇄 실패';

const IDLE: PrintState = { phase: 'idle', printed: 0, reason: null };

export interface LabelPrintRunner {
  state: PrintState;
  run: (targets: readonly PrintTarget[]) => Promise<void>;
  reset: () => void;
  isShellAvailable: boolean;
}

/** 발행 기록마다 렌디션→물리 인쇄→결과 보고를 순서대로 실행한다. */
export const useLabelPrintRunner = (workerNo: string | null): LabelPrintRunner => {
  const { client } = useApiClient();
  const [state, setState] = useState<PrintState>(IDLE);
  const reportKeys = useRef(new Map<string, string>());
  const format = labelRenditionFormat();

  const reportKeyFor = useCallback((issueId: number, failed: boolean): string => {
    const slot = `${String(issueId)}:${failed ? 'FAILED' : 'SUCCEEDED'}`;
    const existing = reportKeys.current.get(slot);
    if (existing !== undefined) return existing;

    const key = crypto.randomUUID();
    reportKeys.current.set(slot, key);

    return key;
  }, []);

  const run = useCallback(
    async (targets: readonly PrintTarget[]): Promise<void> => {
      const shell = shellOf();
      if (shell === null || workerNo === null) {
        setState({ phase: 'shellUnavailable', printed: 0, reason: null });
        return;
      }

      setState({ phase: 'sending', printed: 0, reason: null });
      let printed = 0;

      for (const target of targets) {
        let failureReason: string | null = null;

        try {
          const rendition = await runRequest<ArrayBuffer>(() =>
            client.GET('/app/document-issues/{documentIssueLogId}/rendition', {
              params: {
                path: { documentIssueLogId: target.documentIssueLogId },
                query: { format },
              },
              parseAs: 'arrayBuffer',
            }),
          );

          await shell.save(
            new Uint8Array(rendition),
            target.label,
            new Date().toISOString(),
            format,
          );
          printed += 1;
        } catch (error) {
          failureReason = reasonOf(error);
        }

        try {
          await runRequest(() =>
            client.POST('/app/document-issues/{documentIssueLogId}:report-print', {
              params: {
                path: { documentIssueLogId: target.documentIssueLogId },
                header: {
                  'Idempotency-Key': reportKeyFor(
                    target.documentIssueLogId,
                    failureReason !== null,
                  ),
                  'X-Worker-No': workerNo,
                },
              },
              body:
                failureReason === null
                  ? { outcome: 'SUCCEEDED' }
                  : { outcome: 'FAILED', failureReason },
            }),
          );
        } catch (error) {
          failureReason ??= reasonOf(error);
        }

        if (failureReason !== null) {
          setState({ phase: 'failed', printed, reason: failureReason });
          return;
        }
      }

      setState({ phase: 'succeeded', printed, reason: null });
    },
    [client, format, reportKeyFor, workerNo],
  );

  return {
    state,
    run,
    reset: () => {
      setState(IDLE);
    },
    isShellAvailable: shellOf() !== null,
  };
};
