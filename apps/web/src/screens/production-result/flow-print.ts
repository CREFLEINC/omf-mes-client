import { createIdempotencyKey } from '@omf-mes/api-client';
import { useCallback, useRef, useState } from 'react';

import { useApiClient } from '../../patterns/api-context';
import {
  fetchLabelRendition,
  labelRenditionFormat,
  type LabelRenditionFormat,
} from '../../patterns/pop-label-rendition';
import { runRequest } from '../../patterns/request';

export interface PrintTarget {
  documentIssueLogId: number;
  label: string;
}

export type PrintPhase =
  | 'idle'
  | 'sending'
  | 'succeeded'
  | 'renditionFailed'
  | 'printFailed'
  | 'reportFailed'
  | 'shellUnavailable';

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
  retryReport: () => Promise<void>;
  reset: () => void;
  isShellAvailable: boolean;
}

interface PendingSuccessReport {
  target: PrintTarget;
  remainingTargets: readonly PrintTarget[];
  printed: number;
}

/** 발행 기록마다 렌디션→물리 인쇄→결과 보고를 순서대로 실행한다. */
export const useLabelPrintRunner = (workerNo: string | null): LabelPrintRunner => {
  const { client } = useApiClient();
  const [state, setState] = useState<PrintState>(IDLE);
  const reportKeys = useRef(new Map<string, string>());
  const pendingSuccessReport = useRef<PendingSuccessReport | null>(null);
  const isExecuting = useRef(false);
  const format = labelRenditionFormat();

  const executeOnce = useCallback(async (operation: () => Promise<void>): Promise<void> => {
    if (isExecuting.current) return;

    isExecuting.current = true;
    try {
      await operation();
    } finally {
      isExecuting.current = false;
    }
  }, []);

  const reportKeyFor = useCallback((issueId: number, failed: boolean): string => {
    const slot = `${String(issueId)}:${failed ? 'FAILED' : 'SUCCEEDED'}`;
    const existing = reportKeys.current.get(slot);
    if (existing !== undefined) return existing;

    const key = createIdempotencyKey();
    reportKeys.current.set(slot, key);

    return key;
  }, []);

  const report = useCallback(
    async (target: PrintTarget, failureReason: string | null): Promise<void> => {
      if (workerNo === null) throw new Error('사번이 없어 인쇄 결과를 보고할 수 없습니다.');

      await runRequest(() =>
        client.POST('/app/document-issues/{documentIssueLogId}:report-print', {
          params: {
            path: { documentIssueLogId: target.documentIssueLogId },
            header: {
              'Idempotency-Key': reportKeyFor(target.documentIssueLogId, failureReason !== null),
              'X-Worker-No': workerNo,
            },
          },
          body:
            failureReason === null
              ? { outcome: 'SUCCEEDED' }
              : { outcome: 'FAILED', failureReason },
        }),
      );
    },
    [client, reportKeyFor, workerNo],
  );

  const continueRun = useCallback(
    async (targets: readonly PrintTarget[], alreadyPrinted: number): Promise<void> => {
      if (targets.length === 0) {
        pendingSuccessReport.current = null;
        setState({ phase: 'succeeded', printed: alreadyPrinted, reason: null });
        return;
      }

      const shell = shellOf();
      if (shell === null || workerNo === null) {
        setState({ phase: 'shellUnavailable', printed: alreadyPrinted, reason: null });
        return;
      }

      setState({ phase: 'sending', printed: alreadyPrinted, reason: null });
      let printed = alreadyPrinted;

      for (const [index, target] of targets.entries()) {
        let failureReason: string | null = null;
        let failurePhase: 'renditionFailed' | 'printFailed' | null = null;
        let rendition: ArrayBuffer | null = null;

        try {
          /*
           * ⛔ **서버에 이 경로가 없다**(`patterns/pop-label-rendition` 머리말 · 대응표 P1
           * 「미구현 5건」). `client.GET` 을 부르지 않고 항상 거부하는 대역을 부른다 — 아래는
           * 원래도 «렌디션 실패» 갈래로 실패 사유를 실어 보고하던 자리라 그대로 태운다.
           */
          rendition = await fetchLabelRendition();
        } catch (error) {
          failureReason = reasonOf(error);
          failurePhase = 'renditionFailed';
        }

        if (rendition !== null) {
          try {
            await shell.save(
              new Uint8Array(rendition),
              target.label,
              new Date().toISOString(),
              format,
            );
            printed += 1;
          } catch (error) {
            failureReason = reasonOf(error);
            failurePhase = 'printFailed';
          }
        }

        try {
          await report(target, failureReason);
        } catch (error) {
          if (failurePhase === null) {
            pendingSuccessReport.current = {
              target,
              remainingTargets: targets.slice(index + 1),
              printed,
            };
            setState({ phase: 'reportFailed', printed, reason: reasonOf(error) });
            return;
          }
        }

        if (failurePhase !== null) {
          setState({ phase: failurePhase, printed, reason: failureReason });
          return;
        }
      }

      pendingSuccessReport.current = null;
      setState({ phase: 'succeeded', printed, reason: null });
    },
    [client, format, report, workerNo],
  );

  const run = useCallback(
    async (targets: readonly PrintTarget[]): Promise<void> => {
      await executeOnce(async () => {
        pendingSuccessReport.current = null;
        await continueRun(targets, 0);
      });
    },
    [continueRun, executeOnce],
  );

  const retryReport = useCallback(async (): Promise<void> => {
    await executeOnce(async () => {
      const pending = pendingSuccessReport.current;
      if (pending === null) return;

      setState({ phase: 'sending', printed: pending.printed, reason: null });

      try {
        await report(pending.target, null);
      } catch (error) {
        setState({ phase: 'reportFailed', printed: pending.printed, reason: reasonOf(error) });
        return;
      }

      pendingSuccessReport.current = null;
      await continueRun(pending.remainingTargets, pending.printed);
    });
  }, [continueRun, executeOnce, report]);

  return {
    state,
    run,
    retryReport,
    reset: () => {
      pendingSuccessReport.current = null;
      setState(IDLE);
    },
    isShellAvailable: shellOf() !== null,
  };
};
