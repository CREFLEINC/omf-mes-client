import { createIdempotencyKey } from '@omf-mes/api-client';
import { useCallback, useRef, useState } from 'react';

import { useApiClient } from '../../patterns/api-context';
import {
  fetchLabelRendition,
  resolveLabelRenditionFormat,
} from '../../patterns/pop-label-rendition';
import { renditionShell } from '../../patterns/pop-print';
import { runRequest } from '../../patterns/request';

export interface PrintTarget {
  documentIssueLogId: number;
  label: string;
  /**
   * 화면이 직접 짠 라벨 명령(TSPL). **있으면 서버 렌디션을 부르지 않고 이것을 찍는다.**
   *
   * ⭐ 생산 LOT 라벨이 쓴다 — 서버 판은 100 × 60 mm 좌표라 80 × 30 mm 라벨지에서 잘렸다
   *   (`label-tspl` 머리말 · 사용자 지시 2026-09-16). 인식표는 아직 서버 판 그대로라 비운다.
   */
  command?: string;
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

/**
 * 화면이 짠 라벨 명령을 셸에 넘길 바이트로 바꾼다.
 *
 * ⚠ **TSPL 은 ASCII 다** — 자리에 못 들어갈 글자는 명령을 짜는 쪽에서 이미 걸러 둔다
 *   (`pop-material-lot-label/label-tspl` 의 `escapeTspl`).
 */
const commandBytes = (command: string): ArrayBuffer => {
  const bytes = new TextEncoder().encode(command);

  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
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

  const executeOnce = useCallback(async (operation: () => Promise<void>): Promise<void> => {
    if (isExecuting.current) return;

    isExecuting.current = true;
    try {
      await operation();
    } finally {
      isExecuting.current = false;
    }
  }, []);

  /**
   * 이 보고에 실을 멱등 키.
   *
   * ⭐ **같은 내용을 다시 보내는 것만 같은 키다.** 서버의 멱등 규칙은 「같은 키 · 다른 본문」을
   *    409 로 거절한다. 실패 보고는 본문에 사유(`failureReason`)를 싣는데 그 사유가 시도마다
   *    다를 수 있어, 성공·실패 두 슬롯으로만 가르면 **두 번째 실패 보고가 통째로 거절된다**
   *    (WIP-CHAIN-01 D6 실측 2026-09-15: 인쇄 실패 → 재시도 → `:report-print` 409).
   *    사유까지 슬롯에 넣어, 같은 사유의 되풀이는 흡수되고 다른 사유는 새 키로 나간다.
   *
   * ⛔ **시도마다 무조건 새 키를 뽑지 않는다.** 그러면 끊긴 자리에서 같은 보고를 다시 보낼 때
   *    서버가 두 건으로 세어, 멱등키를 둔 뜻이 사라진다.
   */
  const reportKeyFor = useCallback((issueId: number, failureReason: string | null): string => {
    const slot = `${String(issueId)}:${failureReason ?? 'SUCCEEDED'}`;
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
              'Idempotency-Key': reportKeyFor(target.documentIssueLogId, failureReason),
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

      const shell = renditionShell();
      if (shell === null || workerNo === null) {
        setState({ phase: 'shellUnavailable', printed: alreadyPrinted, reason: null });
        return;
      }

      setState({ phase: 'sending', printed: alreadyPrinted, reason: null });
      let printed = alreadyPrinted;

      /*
       * ⭐ **형식을 한 번 정해 요청과 저장이 같은 값을 쓴다.** 셸에 명령형(RAW) 자리가 없는데
       * `tspl` 을 받으면 인쇄가 「보낼 프린터를 찾을 수 없다」로 멎고, 라벨을 못 붙여 스캔·마감이
       * 통째로 막힌다(WIP-CHAIN-01 D6 실측 · macOS 셸). 서버는 두 형식을 다 그려 준다.
       *
       * ⚠ 실행 «안»에서 묻는다 — 훅이 설 때 굳혀 두면 통로가 뒤늦게 선 단말에서 옛 판정이 남는다.
       */
      const format = await resolveLabelRenditionFormat();

      for (const [index, target] of targets.entries()) {
        let failureReason: string | null = null;
        let failurePhase: 'renditionFailed' | 'printFailed' | null = null;
        let rendition: ArrayBuffer | null = null;

        try {
          /*
           * ⭐ **생산 LOT 라벨은 배포본에서도 부른다.** 서버가 그림을 그려 준다(실측 2026-09-15).
           * 종류를 밝히지 않으면 `fetchLabelRendition` 이 「아직 준비되지 않은 종류」로 보고 요청
           * 전에 막아, 인쇄가 서지 못해 라벨 스캔 칸이 열리지 않는다 — 그러면 LOT 마감으로 가는
           * 길이 통째로 사라진다(WIP-CHAIN-01 D1).
           *
           * ⭐ **화면이 직접 짠 라벨은 이 요청을 건너뛴다**(`PrintTarget.command`). 서버 판은
           * 100 × 60 mm 좌표라 80 × 30 mm 라벨지에서 잘렸다(실기 2026-09-16 · 사용자 지시).
           */
          rendition =
            target.command === undefined
              ? await fetchLabelRendition(
                  client,
                  target.documentIssueLogId,
                  format,
                  'PRODUCTION_LOT_LABEL',
                )
              : commandBytes(target.command);
        } catch (error) {
          failureReason = reasonOf(error);
          failurePhase = 'renditionFailed';
        }

        if (rendition !== null) {
          try {
            /*
             * ⛔ **화면이 짠 라벨은 언제나 `tspl` 이다.** 형식은 바이트가 정하지 셸 사정이
             *    정하지 않는다 — `format` 을 그대로 넘기면 RAW 자리가 없는 셸에서 TSPL 명령이
             *    `label.png` 로 저장돼 그림 대지에 얹히고, **깨진 라벨이 나오는데 앱은 성공으로
             *    보고한다.** 자재 LOT 라벨도 같은 이유로 `'tspl'` 을 고정해 보낸다
             *    (`pop-material-lot-label/mutations.ts`).
             */
            await shell.save(
              new Uint8Array(rendition),
              target.label,
              new Date().toISOString(),
              target.command === undefined ? format : 'tspl',
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
    [client, report, workerNo],
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
    isShellAvailable: renditionShell() !== null,
  };
};
