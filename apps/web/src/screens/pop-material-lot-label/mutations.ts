import type { ApiClient, ApiError } from '@omf-mes/api-client';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useState } from 'react';

import { useApiClient } from '../../patterns/api-context';
import { runRequest, toApiError } from '../../patterns/request';
import { toDocumentIssueBody, toLotCreateBody, toPrintReportBody } from './issue-request';
import { receiptKeys } from './queries';
import { popShell } from './shell-print';
import { toIssueView, type IssueView, type TargetRow } from './types';

type Client = ApiClient['client'];

/**
 * 등록·인쇄가 어디까지 갔는가 — **다섯 걸음이고 한 트랜잭션이 아니다.**
 *
 * ```
 * register  POST /trace/lots                                    LOT 을 만든다
 * issue     POST /app/document-issues                           발행 기록을 만든다(회차는 서버)
 * render    GET  /app/document-issues/{id}/rendition            서버가 그린 것을 받는다
 * print     window.pop.rendition.save(...)                      셸이 보낸다
 * report    POST /app/document-issues/{id}:report-print         결과를 보고한다
 * ```
 *
 * ⛔ **어느 걸음에서 멈췄는지가 다음에 할 일을 정한다.** 「실패」로 뭉뚱그리면 사용자가 처음부터
 * 다시 눌러 LOT 이 둘 생긴다.
 */
export type IssueStep = 'register' | 'issue' | 'render' | 'print' | 'report';

/**
 * 한 번의 등록·인쇄가 남긴 것.
 *
 * ⭐ **성공만 결과가 아니다.** 중간에 멈춘 것도 결과이고, 그 자리마다 사용자가 할 일이 다르다.
 */
export interface IssueRunResult {
  /** 끝까지 갔는가. 인쇄까지 성공하고 보고를 마쳤을 때만 참이다. */
  isPrinted: boolean;
  /** 멈춘 걸음. 끝까지 갔으면 `null`. */
  failedAt: IssueStep | null;
  /**
   * ⚠ **이번 실행이 LOT 을 만들었는가.** `register` 뒤에서 멈췄으면 참이다 —
   * 「LOT 은 생겼는데 라벨 기록은 없는」 상태이며 **오류가 아니라 표현 가능한 상태**다
   * (변경 통지 #534 §3). 다시 등록하면 같은 자재에 LOT 이 둘 생긴다.
   */
  hasCreatedLot: boolean;
  /** 만들어진 발행 기록. `issue` 를 넘겼을 때만 있다. */
  issue: IssueView | null;
  error: ApiError | null;
}

const IDLE: IssueRunResult = {
  isPrinted: false,
  failedAt: null,
  hasCreatedLot: false,
  issue: null,
  error: null,
};

export interface IssueCommand {
  row: TargetRow;
  /** 고른 프린터. 배정이 정해지기 전에는 서버 기본값에 맡긴다. */
  printerName: string | null;
  /** 재인쇄일 때만 채운다. 신규 발행에 사유가 붙으면 이력이 거짓이 된다. */
  reissueReasonCode: string | null;
}

/** 인쇄를 못 한 사유 — 서버 보고에 그대로 실린다. `FAILED` 인데 사유가 없으면 422 다. */
const NO_SHELL_REASON = '셸 인쇄 통로가 없는 단말에서 실행됐습니다.';

const createLot = async (
  client: Client,
  row: TargetRow,
  occurredAt: string,
  workerNo: string,
): Promise<number> => {
  const data = await runRequest(() =>
    client.POST('/trace/lots', {
      params: {
        header: { 'Idempotency-Key': crypto.randomUUID(), 'X-Worker-No': workerNo },
      },
      body: toLotCreateBody(row, occurredAt),
    }),
  );

  return data.lot.lotId;
};

const createIssue = async (
  client: Client,
  input: { lotId: number; printerName: string | null; reissueReasonCode: string | null },
  workerNo: string,
): Promise<IssueView> => {
  const data = await runRequest(() =>
    client.POST('/app/document-issues', {
      params: {
        header: { 'Idempotency-Key': crypto.randomUUID(), 'X-Worker-No': workerNo },
      },
      body: toDocumentIssueBody(input),
    }),
  );

  const created = data.items[0];

  /*
   * ⛔ **비어 온 것을 성공으로 삼지 않는다.** 기록 없이 다음 걸음으로 가면 인쇄할 식별자가
   * 없는데 화면은 진행 중으로 보인다 — 그 자리에서 멈추는 편이 낫다.
   */
  if (created === undefined) throw new Error('발행 기록이 비어 왔습니다.');

  return toIssueView(created);
};

/**
 * 서버가 그린 라벨을 받는다.
 *
 * ⛔ **형식은 서버가 정한 것을 그대로 쓴다** — 라벨은 이미지(`png`)다. 화면이 다시 그리지 않는다.
 */
const fetchRendition = async (client: Client, documentIssueLogId: number): Promise<Uint8Array> => {
  const data = await runRequest(() =>
    client.GET('/app/document-issues/{documentIssueLogId}/rendition', {
      params: { path: { documentIssueLogId }, query: { format: 'png' } },
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

export interface IssueRunOptions {
  /**
   * 귀속 사번. **없으면 부르지 않는다** — 서버가 거부한다(공유계약 D-5). 화면이 이 값을
   * 확보하지 못한 상태를 비활성 + 사유로 보인다.
   */
  workerNo: string;
}

export interface IssueRunResultHandle {
  run: (command: IssueCommand) => void;
  isRunning: boolean;
  /** 지금 어느 걸음인가. 쉬는 중이면 `null`. */
  step: IssueStep | null;
  result: IssueRunResult;
  reset: () => void;
}

/**
 * 등록·인쇄 한 번을 끝까지 몬다.
 *
 * ⛔ **`lotId` 가 이미 있는 라인에는 등록을 부르지 않는다.** 부르면 같은 자재에 LOT 이 둘
 * 생기고 되돌릴 화면이 없다(변경 통지 #534 §3). 판정은 행의 `lotId` 로 한다.
 *
 * ⛔ **인쇄에 실패해도 발행 기록을 되돌리지 않는다.** 실패는 보고하고 **재발행**으로 처리한다 —
 * 그 재발행의 사유가 「인쇄 실패」다(계약 명시).
 */
export const useLabelIssue = ({ workerNo }: IssueRunOptions): IssueRunResultHandle => {
  const { client } = useApiClient();
  const queryClient = useQueryClient();
  const [step, setStep] = useState<IssueStep | null>(null);
  const [result, setResult] = useState<IssueRunResult>(IDLE);

  const reset = useCallback(() => {
    setStep(null);
    setResult(IDLE);
  }, []);

  const run = useCallback(
    (command: IssueCommand) => {
      const { row, printerName, reissueReasonCode } = command;

      const execute = async (): Promise<void> => {
        let hasCreatedLot = false;
        let issue: IssueView | null = null;
        /*
         * ⛔ **멈춘 자리는 이 변수로 센다.** `setStep` 은 그리기 위한 것이라 다음 렌더에서야
         * 반영되고, 잡은 자리에서 상태 변수를 읽으면 **한 걸음 뒤진 값**이 나온다.
         */
        let at: IssueStep = 'register';

        const enter = (next: IssueStep): void => {
          at = next;
          setStep(next);
        };

        try {
          enter('register');

          /*
           * 이미 등록된 라인은 등록을 건너뛰고 **인쇄만** 한다. 판정을 여기 한 곳에 두어,
           * 부르는 쪽이 실수로 다시 등록하는 경로를 만들지 못하게 한다.
           */
          let lotId = row.lotId;

          if (lotId === null) {
            lotId = await createLot(client, row, new Date().toISOString(), workerNo);
            hasCreatedLot = true;
            // 라인에 LOT 이 붙었다 — 목록을 다시 읽어야 다음 조작이 옳은 단추를 낸다.
            await queryClient.invalidateQueries({
              queryKey: receiptKeys.lines(row.inboundReceiptId),
            });
          }

          enter('issue');
          issue = await createIssue(client, { lotId, printerName, reissueReasonCode }, workerNo);

          enter('render');
          const bytes = await fetchRendition(client, issue.documentIssueLogId);

          enter('print');
          const shell = popShell();

          /*
           * ⛔ **통로가 없는 것을 인쇄 성공으로 보고하지 않는다.** 기록은 이미 남았으므로
           * 실패로 보고해야 「나오지 않은 라벨」이 나온 것으로 남지 않는다.
           */
          const failureReason =
            shell === null
              ? NO_SHELL_REASON
              : await shell.rendition
                  .save(
                    bytes,
                    `lot-${String(issue.documentIssueLogId)}`,
                    new Date().toISOString(),
                    'png',
                  )
                  .then(() => null)
                  .catch((cause: unknown) =>
                    cause instanceof Error ? cause.message : '셸 인쇄가 실패했습니다.',
                  );

          enter('report');
          await reportPrint(client, issue.documentIssueLogId, failureReason, workerNo);

          setResult({
            isPrinted: failureReason === null,
            failedAt: failureReason === null ? null : 'print',
            hasCreatedLot,
            issue,
            error: null,
          });
        } catch (cause) {
          setResult({
            isPrinted: false,
            failedAt: at,
            hasCreatedLot,
            issue,
            error: toApiError(cause),
          });
        } finally {
          setStep(null);
          // 목록의 라벨 발행 여부가 바뀌었을 수 있다 — 끝나면 언제나 다시 읽는다.
          await queryClient.invalidateQueries({ queryKey: receiptKeys.lists });
        }
      };

      void execute();
    },
    [client, queryClient, workerNo],
  );

  return { run, isRunning: step !== null, step, result, reset };
};
