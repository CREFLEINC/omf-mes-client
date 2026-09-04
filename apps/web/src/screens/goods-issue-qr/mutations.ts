import { useMutation, useQueryClient, type UseMutationResult } from '@tanstack/react-query';

import { useApiClient } from '../../patterns/api-context';
import { useMasterWrite, type MasterWriteResult } from '../../patterns/master';
import { runRequest } from '../../patterns/request';
import { hasPrintBridge, sendToPrinter, type PrintAttempt } from './pop-print';
import { goodsIssueQrKeys } from './queries';
import type { DocumentIssue, DocumentIssueCreate } from './types';

/**
 * 발행 · 재발행.
 *
 * ⭐ **대상을 한 번에 보낸다**(계약: 한 트랜잭션 · 하나라도 실패하면 전건 실패). 라인마다 나눠
 * 부르면 절반만 발행된 상태가 생기고, 그 상태에서 회차가 이미 오른 라인과 아닌 라인이 섞인다.
 *
 * ⛔ **회차를 화면이 세지 않는다**(스펙 §5-5). 본문에 회차를 싣지 않고, 서버가 매겨 응답으로
 * 돌려준 값을 그대로 보인다.
 *
 * ⛔ **낙관적 잠금을 걸지 않는다**(`etagPath: null`). 발행 기록은 새 행이 쌓이는 자원이라
 * 고쳐 쓰는 대상이 아니고, 계약도 이 오퍼레이션에 `If-Match` 를 두지 않았다.
 *
 * ⭐ **멱등 키의 수명은 `until-applied`** — 되돌릴 수 없는 쓰기다. 통신이 끊긴 뒤 다시 누르면
 * 서버가 다른 쓰기로 보고 **회차를 한 번 더 올린다.** 보낼 값이 바뀌면 지문이 새 키를 준다.
 *
 * ⚠ **사번 헤더는 인증이 아니라 귀속이다.** 단말 토큰이 이것을 대신하지 않으므로, 부르는 쪽이
 * 사번을 확보한 뒤에만 발행을 연다.
 */
export interface DocumentIssueWriteOptions {
  workerNo: string;
  onSuccess: (issued: DocumentIssue[]) => void;
}

/** 인라인으로 낼 수 있는 필드 — 이 화면이 입력칸을 가진 것만이다. */
const KNOWN_FIELDS = ['reissueReasonCode'] as const;

export const useDocumentIssueWrite = ({
  workerNo,
  onSuccess,
}: DocumentIssueWriteOptions): MasterWriteResult<DocumentIssueCreate> => {
  const { client } = useApiClient();

  return useMasterWrite<DocumentIssueCreate, { items: DocumentIssue[]; issuedCount: number }>({
    request: (body, headers) =>
      client.POST('/app/document-issues', {
        params: {
          header: {
            'Idempotency-Key': headers['Idempotency-Key'],
            'X-Worker-No': workerNo,
          },
        },
        body,
      }),
    etagPath: null,
    /* 발행하면 대상의 발행 횟수가 오른다 — 목록의 「발행됨 N회」가 다시 읽혀야 맞는다. */
    invalidateKeys: [goodsIssueQrKeys.summaries],
    knownFields: KNOWN_FIELDS,
    keyLifetime: 'until-applied',
    onSuccess: (data) => {
      onSuccess(data.items);
    },
  });
};

/** 인쇄 한 건의 결과 — 화면이 「무엇이 어디까지 됐는지」를 이 값으로 말한다. */
export interface PrintReport {
  documentIssueLogId: number;
  attempt: PrintAttempt;
  /** 인쇄 결과를 서버에 보고했는가. 통로가 없어 인쇄를 시도하지 않았으면 보고하지 않는다. */
  reported: boolean;
}

/** 인쇄 결과 보고가 실패해도 발행 기록은 남는다 — 그 사실을 화면이 구분해 말한다. */
export interface PrintFlowResult {
  reports: PrintReport[];
}

/**
 * 발행 뒤의 두 걸음 — **그린 것을 받아, 셸이 보낸 뒤, 결과를 보고한다**(스펙 §5-5 · K-4).
 *
 * ⛔ **인쇄 실패로 발행을 되돌리지 않는다.** 계약이 보고 경로를 따로 둔 이유가 그것이다 —
 * 실패는 재발행으로 처리하고, 그 재발행의 사유가 「인쇄 실패」다.
 *
 * ⚠ **보고가 실패해도 예외로 올리지 않는다.** 보고는 사용자가 시킨 일이 아니라 화면이 뒤따라
 * 하는 일이라, 여기서 던지면 **발행이 실패한 것처럼 보인다.** 실패한 사실은 결과에 담는다.
 */
export const usePrintFlow = (
  workerNo: string | null,
): UseMutationResult<PrintFlowResult, Error, DocumentIssue[]> => {
  const { client } = useApiClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (issued: DocumentIssue[]): Promise<PrintFlowResult> => {
      const reports: PrintReport[] = [];

      for (const record of issued) {
        const attempt = await printOne(client, record);
        const reported =
          attempt.kind === 'noBridge' || workerNo === null
            ? false
            : await reportOne(client, workerNo, record.documentIssueLogId, attempt);

        reports.push({ documentIssueLogId: record.documentIssueLogId, attempt, reported });
      }

      return { reports };
    },
    onSettled: () => {
      /* 인쇄 결과가 발행 기록에 붙는다 — 목록의 마지막 인쇄 결과가 다시 읽혀야 맞는다. */
      void queryClient.invalidateQueries({ queryKey: goodsIssueQrKeys.summaries });
    },
  });
};

type Client = ReturnType<typeof useApiClient>['client'];

/** 라벨 파일에 붙는 이름 — 무엇을 몇 회차로 찍은 것인지 셸의 파일 이름에서 알아볼 수 있게 한다. */
const printLabel = (record: DocumentIssue): string =>
  `${record.documentTypeCode}-${String(record.target.targetId)}-${String(record.issueSeq)}`;

const printOne = async (client: Client, record: DocumentIssue): Promise<PrintAttempt> => {
  /*
   * ⭐ **보낼 곳이 없으면 그림을 받지도 않는다.** 셸 밖(관리웹 브라우저)에서 이 화면을 열면
   * 인쇄 통로가 없으므로, 받아 봐야 버릴 이미지를 내려받게 된다.
   */
  if (!hasPrintBridge()) return { kind: 'noBridge' };

  let bytes: Uint8Array;

  try {
    const blob = await runRequest(() =>
      client.GET('/app/document-issues/{documentIssueLogId}/rendition', {
        params: {
          path: { documentIssueLogId: record.documentIssueLogId },
          query: { format: 'png' },
        },
        parseAs: 'arrayBuffer',
      }),
    );

    bytes = new Uint8Array(blob as ArrayBuffer);
  } catch (cause) {
    /* 그림을 못 받은 것도 인쇄 실패다 — 종이는 나오지 않았고, 기록은 남아 있다. */
    return { kind: 'failed', reason: cause instanceof Error ? cause.message : String(cause) };
  }

  return sendToPrinter(bytes, printLabel(record), 'png');
};

/**
 * 보고할 수 있는 결과는 둘뿐이다 — **찍었다 / 찍히지 않았다.** 통로가 없어 시도조차 하지 않은
 * 것은 여기 오지 않는다(그것은 보고할 결과가 아니라 보고할 것이 없는 상태다).
 */
type ReportableAttempt = Exclude<PrintAttempt, { kind: 'noBridge' }>;

const reportOne = async (
  client: Client,
  workerNo: string,
  documentIssueLogId: number,
  attempt: ReportableAttempt,
): Promise<boolean> => {
  try {
    await runRequest(() =>
      client.POST('/app/document-issues/{documentIssueLogId}:report-print', {
        params: {
          path: { documentIssueLogId },
          header: { 'Idempotency-Key': crypto.randomUUID(), 'X-Worker-No': workerNo },
        },
        body:
          attempt.kind === 'printed'
            ? { outcome: 'SUCCEEDED' }
            : { outcome: 'FAILED', failureReason: attempt.reason },
      }),
    );

    return true;
  } catch {
    return false;
  }
};
