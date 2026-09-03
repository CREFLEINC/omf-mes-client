import type { ApiClient, ApiError } from '@omf-mes/api-client';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useRef, useState } from 'react';

import { useApiClient } from '../../patterns/api-context';
import { runRequest, toApiError } from '../../patterns/request';
import { RENDITION_FORMAT, type LabelKind } from './codes';
import { toDocumentIssueBody, toPrintReportBody } from './issue-request';
import { renditionShell } from './shell-print';
import { toIssueView, type IssueView, type TargetRow } from './types';

type Client = ApiClient['client'];

/**
 * 발행과 인쇄가 **한 흐름이 아니다** — 계약이 셋으로 갈라 두었다(공유계약 K-4 · 스펙 §5-5).
 *
 * ```
 * ① 발행 기록 저장   POST /app/document-issues                  ← 트랜잭션 «안»
 * ─────────────────────────────────────────────────────────────
 * ② 서버 렌더링      GET  /app/document-issues/{id}/rendition    ← 밖
 * ③ 물리 인쇄        window.pop.rendition.save(...)              ← 밖
 * ④ 결과 보고        POST /app/document-issues/{id}:report-print ← 밖
 * ```
 *
 * ⛔ **①이 성공했는데 ③이 실패할 수 있다.** 그것이 오류가 아니라 계약이 만든 **정상 상태**다 —
 * 기록은 남고 종이만 안 나온다. 되돌리지 않고 **재발행**으로 처리하며, 그 재발행의 사유가
 * 「인쇄 실패」다.
 *
 * ⭐ **화면 순서는 「발행 → 미리보기 → 인쇄」다.** 그리기 경로가 발행 기록 번호를 받으므로
 * **발행 전 미리보기는 이번 계약에 없다**(착수 이슈 §6 · 요구서 §3-4).
 */
export type IssueStep = 'issue' | 'render' | 'print' | 'report';

/**
 * 흐름이 지금 어디 있는가.
 *
 * | 상태 | 뜻 | 다음에 할 수 있는 것 |
 * | --- | --- | --- |
 * | `idle` | 아직 발행하지 않았다 | 발행 |
 * | `issuing` | 기록을 만들고 그린 것을 받는 중 | — |
 * | `issued` | **기록이 남았다.** 미리보기를 볼 수 있다 | 미리보기 · 인쇄 |
 * | `printing` | 셸로 보내고 결과를 보고하는 중 | — |
 * | `printed` | 끝났다 | 새 대상 고르기 |
 */
export type IssuePhase = 'idle' | 'issuing' | 'issued' | 'printing' | 'printed';

/** 발행된 라벨 한 장 — **기록과 그림이 짝이다.** */
export interface IssuedLabel {
  issue: IssueView;
  /**
   * 서버가 그린 바이트. **미리보기와 인쇄가 같은 것을 쓴다** — 두 번 받으면 서버가 두 번
   * 그리고, 그 사이 무언가 달라지면 **본 것과 나온 것이 달라진다.**
   */
  bytes: Uint8Array;
  /** 미리보기 `<img>` 의 주소. 해제 책임이 이 훅에 있다(놓으면 단말 메모리에 쌓인다). */
  previewUrl: string;
}

export interface IssueRunResult {
  /** 인쇄까지 끝난 장수. 멈췄으면 거기까지의 수다. */
  printed: number;
  /** 멈춘 걸음. 끝까지 갔으면 `null`. */
  failedAt: IssueStep | null;
  /** 멈춘 사유. 서버 보고에도 같은 문자열이 실린다. */
  failureReason: string | null;
  error: ApiError | null;
}

const IDLE_RESULT: IssueRunResult = {
  printed: 0,
  failedAt: null,
  failureReason: null,
  error: null,
};

/** 인쇄를 못 한 사유 — 서버 보고에 그대로 실린다. `FAILED` 인데 사유가 없으면 422 다. */
const NO_SHELL_REASON = '셸 인쇄 통로가 없는 단말에서 실행됐습니다.';

const createIssues = async (
  client: Client,
  input: { kind: LabelKind; rows: readonly TargetRow[] } & {
    printerName: string | null;
    reissueReasonCode: string | null;
  },
  workerNo: string,
): Promise<IssueView[]> => {
  const data = await runRequest(() =>
    client.POST('/app/document-issues', {
      params: { header: { 'Idempotency-Key': crypto.randomUUID(), 'X-Worker-No': workerNo } },
      body: toDocumentIssueBody(input),
    }),
  );

  /*
   * ⛔ **비어 온 것을 성공으로 삼지 않는다.** 기록 없이 다음 걸음으로 가면 인쇄할 식별자가
   * 없는데 화면은 진행 중으로 보인다 — 그 자리에서 멈추는 편이 낫다.
   */
  if (data.items.length === 0) throw new Error('발행 기록이 비어 왔습니다.');

  return data.items.map(toIssueView);
};

/**
 * 서버가 그린 라벨을 받는다.
 *
 * ⚠ **발행 기록 «한 건당» 한 번이다.** 발행은 한 트랜잭션이지만 그리기는 그 밖이라 **건별
 * 실패가 정상이다**(요구서 §4-2 B-8) — 여기서 한 장이 실패해도 앞서 나온 장은 유효하다.
 */
const fetchRendition = async (client: Client, documentIssueLogId: number): Promise<Uint8Array> => {
  const data = await runRequest(() =>
    client.GET('/app/document-issues/{documentIssueLogId}/rendition', {
      params: { path: { documentIssueLogId }, query: { format: RENDITION_FORMAT } },
      parseAs: 'arrayBuffer',
    }),
  );

  return new Uint8Array(data as unknown as ArrayBuffer);
};

const reportPrint = async (
  client: Client,
  documentIssueLogId: number,
  failureReason: string | null,
  workerNo: string,
): Promise<void> => {
  await runRequest(() =>
    client.POST('/app/document-issues/{documentIssueLogId}:report-print', {
      params: {
        path: { documentIssueLogId },
        header: { 'Idempotency-Key': crypto.randomUUID(), 'X-Worker-No': workerNo },
      },
      body: toPrintReportBody(failureReason),
    }),
  );
};

export interface IssueCommand {
  kind: LabelKind;
  rows: readonly TargetRow[];
  printerName: string | null;
  reissueReasonCode: string | null;
}

export interface LabelIssueHandle {
  phase: IssuePhase;
  /** 지금 어느 걸음인가. 쉬는 중이면 `null`. */
  step: IssueStep | null;
  /** 발행된 라벨들. `issued` 이후에만 채워진다. */
  labels: IssuedLabel[];
  result: IssueRunResult;
  issue: (command: IssueCommand) => void;
  retryRendition: () => void;
  print: () => void;
  reset: () => void;
}

export interface LabelIssueOptions {
  /**
   * 귀속 사번. **없으면 부르지 않는다** — 서버가 거부한다(공유계약 D-5).
   *
   * ⛔ **모르면 `null` 이다.** 빈 문자열로 떨어뜨리지 않는다 — 빈 값은 서버에 「사번이 있다」로
   * 나가고, 거절이 화면이 아니라 서버에서 난다.
   */
  workerNo: string | null;
}

/**
 * 발행 한 번과 그 뒤의 인쇄를 끌고 간다.
 *
 * ⛔ **발행과 인쇄를 한 호출로 묶지 않는다**(스펙 §6). 묶으면 인쇄가 실패했을 때 기록까지
 * 없던 일로 만들고 싶어지는데, 계약에 **발행 취소 경로가 없다** — 기록 전용이다.
 */
export const useLabelIssue = ({ workerNo }: LabelIssueOptions): LabelIssueHandle => {
  const { client } = useApiClient();
  const queryClient = useQueryClient();
  const [phase, setPhase] = useState<IssuePhase>('idle');
  const [step, setStep] = useState<IssueStep | null>(null);
  const [labels, setLabels] = useState<IssuedLabel[]>([]);
  const [result, setResult] = useState<IssueRunResult>(IDLE_RESULT);
  /*
   * ⛔ **한 번에 하나만 나간다.** 단추의 비활성만으로는 막지 못한다 — 그 값은 다음 렌더에서야
   * 반영되므로, 장갑 낀 손이 빠르게 두 번 누르면 **같은 렌더에서 두 번** 들어온다. 그러면
   * 발행이 두 번 나가 회차가 하나 더 오르고, 그것을 되돌릴 화면이 없다.
   */
  const isRunning = useRef(false);
  const issued = useRef<IssueView[]>([]);
  /* 미리보기 주소는 화면이 놓아도 브라우저가 놓지 않는다 — 이 훅이 끝까지 들고 있다가 푼다. */
  const urls = useRef<string[]>([]);

  const releaseUrls = useCallback(() => {
    for (const url of urls.current) URL.revokeObjectURL(url);
    urls.current = [];
  }, []);

  useEffect(() => releaseUrls, [releaseUrls]);

  const reset = useCallback(() => {
    releaseUrls();
    setPhase('idle');
    setStep(null);
    setLabels([]);
    issued.current = [];
    setResult(IDLE_RESULT);
  }, [releaseUrls]);

  const issue = useCallback(
    (command: IssueCommand) => {
      /*
       * ⛔ **사번을 모르면 아무것도 부르지 않는다**(공유계약 D-5 · F-6). 단추도 함께 막혀
       * 있지만 판정을 나가는 자리에 두어, 다른 경로가 생겨도 빈 사번이 새지 않게 한다.
       */
      if (workerNo === null || command.rows.length === 0) return;
      if (isRunning.current) return;

      isRunning.current = true;

      const execute = async (): Promise<void> => {
        let at: IssueStep = 'issue';

        try {
          setPhase('issuing');
          setStep('issue');
          const issues = await createIssues(client, command, workerNo);
          issued.current = issues;

          at = 'render';
          setStep('render');

          const rendered: IssuedLabel[] = [];

          for (const one of issues) {
            const bytes = await fetchRendition(client, one.documentIssueLogId);
            const previewUrl = URL.createObjectURL(
              new Blob([bytes as BlobPart], { type: 'image/png' }),
            );
            urls.current.push(previewUrl);
            rendered.push({ issue: one, bytes, previewUrl });
          }

          setLabels(rendered);
          setResult(IDLE_RESULT);
          setPhase('issued');
        } catch (cause) {
          /*
           * ⚠ **기록이 남았는데 그리기에서 멈춘 상태가 있다.** 그것을 「발행 실패」로 말하면
           * 사용자가 다시 눌러 회차가 하나 더 오른다 — 어디서 멈췄는지를 그대로 남긴다.
           */
          setResult({
            printed: 0,
            failedAt: at,
            failureReason: null,
            error: toApiError(cause),
          });
          setPhase(at === 'issue' ? 'idle' : 'issued');
        } finally {
          isRunning.current = false;
          setStep(null);
        }
      };

      void execute();
    },
    [client, workerNo],
  );

  const retryRendition = useCallback(() => {
    if (issued.current.length === 0 || isRunning.current) return;

    isRunning.current = true;

    const execute = async (): Promise<void> => {
      try {
        setPhase('issuing');
        setStep('render');
        releaseUrls();
        const rendered: IssuedLabel[] = [];

        for (const one of issued.current) {
          const bytes = await fetchRendition(client, one.documentIssueLogId);
          const previewUrl = URL.createObjectURL(
            new Blob([bytes as BlobPart], { type: 'image/png' }),
          );
          urls.current.push(previewUrl);
          rendered.push({ issue: one, bytes, previewUrl });
        }

        setLabels(rendered);
        setResult(IDLE_RESULT);
        setPhase('issued');
      } catch (cause) {
        setLabels([]);
        setResult({
          printed: 0,
          failedAt: 'render',
          failureReason: null,
          error: toApiError(cause),
        });
        setPhase('issued');
      } finally {
        isRunning.current = false;
        setStep(null);
      }
    };

    void execute();
  }, [client, releaseUrls]);

  const print = useCallback(() => {
    if (workerNo === null || labels.length === 0) return;
    if (isRunning.current) return;

    isRunning.current = true;

    const execute = async (): Promise<void> => {
      let printed = 0;

      setPhase('printing');

      try {
        const shell = renditionShell();

        for (const label of labels) {
          setStep('print');

          /*
           * ⛔ **통로가 없는 것을 인쇄 성공으로 보고하지 않는다.** 기록은 이미 남았으므로
           * 실패로 보고해야 「나오지 않은 라벨」이 나온 것으로 남지 않는다(공유계약 F-6).
           */
          const failureReason =
            shell === null
              ? NO_SHELL_REASON
              : await shell
                  .save(
                    label.bytes,
                    `label-${String(label.issue.documentIssueLogId)}`,
                    new Date().toISOString(),
                    RENDITION_FORMAT,
                  )
                  .then(() => null)
                  .catch((cause: unknown) =>
                    cause instanceof Error ? cause.message : '셸 인쇄가 실패했습니다.',
                  );

          setStep('report');
          await reportPrint(client, label.issue.documentIssueLogId, failureReason, workerNo);

          /*
           * ⭐ **첫 실패에서 멈춘다.** 프린터가 죽은 상태로 남은 장을 계속 밀면 실패 보고만
           * 쌓이고 사용자는 그 사이 아무것도 할 수 없다. 발행 기록은 이미 모든 대상에
           * 남았으므로, 멈춘 뒤 남은 장도 「인쇄 실패」 사유의 재발행으로 이어받는다.
           */
          if (failureReason !== null) {
            setResult({ printed, failedAt: 'print', failureReason, error: null });
            setPhase('printed');

            return;
          }

          printed += 1;
        }

        setResult({ printed, failedAt: null, failureReason: null, error: null });
        setPhase('printed');
      } catch (cause) {
        /*
         * ⚠ **보고 실패가 인쇄 성공을 뒤집지 않는다.** 종이는 이미 나왔다 — 그 사실을 실패
         * 사유로 올리되 「인쇄되지 않았다」고 말하지 않는다.
         */
        setResult({ printed, failedAt: 'report', failureReason: null, error: toApiError(cause) });
        setPhase('printed');
      } finally {
        isRunning.current = false;
        setStep(null);
        // 회차가 올랐다 — 목록의 「최근 발행 · 회차」 칸을 다시 읽어야 다음 조작이 옳다.
        await queryClient.invalidateQueries({ queryKey: ['shipping-packing-label', 'summary'] });
        await queryClient.invalidateQueries({ queryKey: ['shipping-packing-label', 'history'] });
      }
    };

    void execute();
  }, [client, labels, queryClient, workerNo]);

  return { phase, step, labels, result, issue, retryRendition, print, reset };
};
