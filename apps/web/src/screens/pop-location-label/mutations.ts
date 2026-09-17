import { createIdempotencyKey } from '@omf-mes/api-client';
import { useMutation, useQueryClient, type UseMutationResult } from '@tanstack/react-query';

import { useApiClient } from '../../patterns/api-context';
import { useMasterWrite, type MasterWriteResult } from '../../patterns/master';
import {
  fetchLabelRendition,
  resolveLabelRenditionFormat,
} from '../../patterns/pop-label-rendition';
import { runRequest } from '../../patterns/request';
import { hasPrintBridge, sendToPrinter, type PrintAttempt } from '../../patterns/pop-print';
import { popLocationLabelKeys } from './queries';
import { DOCUMENT_TYPE_CODE, type DocumentIssue, type DocumentIssueCreate } from './types';

/**
 * 발행 · 재발행.
 *
 * ⭐ **대상을 한 번에 보낸다**(계약: 한 트랜잭션 · 하나라도 실패하면 전건 실패). 위치마다 나눠
 * 부르면 절반만 발행된 상태가 생기고, 회차가 이미 오른 위치와 아닌 위치가 섞인다.
 *
 * ⛔ **회차를 화면이 세지 않는다.** 본문에 회차를 싣지 않고, 서버가 매겨 돌려준 값을 그대로 보인다.
 *
 * ⛔ **낙관적 잠금을 걸지 않는다**(`etagPath: null`). 발행 기록은 새 행이 쌓이는 자원이라 고쳐
 * 쓰는 대상이 아니고, 계약도 이 오퍼레이션에 `If-Match` 를 두지 않았다.
 *
 * ⭐ **멱등 키의 수명은 `until-applied`** — 되돌릴 수 없는 쓰기다(결정 10). 통신이 끊긴 뒤 다시
 * 누르면 서버가 다른 쓰기로 보고 **회차를 한 번 더 올린다.** 보낼 값이 바뀌면 지문이 새 키를 준다.
 *
 * ⚠ **사번 헤더는 인증이 아니라 귀속이다.** 단말 토큰이 이것을 대신하지 않으므로, 부르는 쪽이
 * 사번을 확보한 뒤에만 발행을 연다.
 */
export interface LocationLabelWriteOptions {
  workerNo: string;
  onSuccess: (issued: DocumentIssue[]) => void;
}

/** 인라인으로 낼 수 있는 필드 — 이 화면이 입력칸을 가진 것만이다. */
const KNOWN_FIELDS = ['reissueReasonCode', 'printerName'] as const;

export const useLocationLabelWrite = ({
  workerNo,
  onSuccess,
}: LocationLabelWriteOptions): MasterWriteResult<DocumentIssueCreate> => {
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
    /* 발행하면 대상의 발행 횟수가 오른다 — 「발행됨 N회」가 다시 읽혀야 맞는다. */
    invalidateKeys: [popLocationLabelKeys.summaries],
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
  /** 어느 위치의 라벨이었나. 실패한 줄을 사용자가 짚을 수 있게 남긴다. */
  targetId: number;
  attempt: PrintAttempt;
  /** 인쇄 결과를 서버에 보고했는가. 통로가 없어 시도하지 않았으면 보고하지 않는다. */
  reported: boolean;
}

export interface PrintFlowResult {
  reports: PrintReport[];
}

/**
 * 발행 뒤의 걸음 — **그린 것을 받아, 셸이 보낸 뒤, 결과를 보고한다.**
 *
 * ⭐ **건별로 돈다.** 발행은 한 트랜잭션이지만 **그리기·인쇄는 그 밖이라 건별 실패가 정상이다**
 *    (출력물 요구서 §4-2 B-8 — 「rendition 은 발행 기록 1건당 1회라 N 건이면 N 번 부르고 건별
 *    실패가 정상」). 그래서 한 건이 실패해도 나머지를 계속 찍는다.
 *
 * ⛔ **인쇄 실패로 발행을 되돌리지 않는다.** 계약이 보고 경로를 따로 둔 이유가 그것이다 —
 *    실패는 재발행으로 처리하고, 그 재발행의 사유가 「인쇄 실패」다(공유계약 B-14).
 *
 * ⚠ **보고가 실패해도 예외로 올리지 않는다.** 보고는 사용자가 시킨 일이 아니라 화면이 뒤따라
 *    하는 일이라, 여기서 던지면 **발행이 실패한 것처럼 보인다.** 실패한 사실은 결과에 담는다.
 */
export const usePrintFlow = (
  workerNo: string | null,
): UseMutationResult<PrintFlowResult, Error, DocumentIssue[]> => {
  const { client } = useApiClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (issued: DocumentIssue[]): Promise<PrintFlowResult> => {
      const reports: PrintReport[] = [];

      /*
       * ⭐ **형식은 한 번만 고른다.** 셸에 「RAW 를 찍을 수 있는가」를 묻는 값이라 건마다 답이
       *    달라지지 않고, 건마다 물으면 수십 건에서 그만큼 왕복이 는다.
       */
      const format = await resolveLabelRenditionFormat();

      for (const record of issued) {
        const attempt = await printOne(client, record, format);
        const reported =
          attempt.kind === 'noBridge' || workerNo === null
            ? false
            : await reportOne(client, workerNo, record.documentIssueLogId, attempt);

        reports.push({
          documentIssueLogId: record.documentIssueLogId,
          targetId: record.target.targetId,
          attempt,
          reported,
        });
      }

      return { reports };
    },
    onSettled: () => {
      /* 인쇄 결과가 발행 기록에 붙는다 — 마지막 인쇄 결과가 다시 읽혀야 맞는다. */
      void queryClient.invalidateQueries({ queryKey: popLocationLabelKeys.summaries });
    },
  });
};

type Client = ReturnType<typeof useApiClient>['client'];
type LabelFormat = Awaited<ReturnType<typeof resolveLabelRenditionFormat>>;

/** 라벨 파일에 붙는 이름 — 무엇을 몇 회차로 찍은 것인지 셸의 파일 이름에서 알아볼 수 있게 한다. */
const printLabel = (record: DocumentIssue): string =>
  `${record.documentTypeCode}-${String(record.target.targetId)}-${String(record.issueSeq)}`;

/**
 * ⭐ **라벨은 서버가 그린다**(공유계약 K-5 · 출력물 요구서 §4). 단말마다 라벨이 달라지지 않게 하려는
 *    조항이고, 서식이 바뀔 때 **창고 단말을 다시 설치하지 않아도 되는** 실리도 함께 있다 — POP 은
 *    Electron 설치본이라 재배포가 무겁다.
 *
 * ⭐ **준비 목록에 이 종류를 넘긴다**(`READY_RENDITION_DOCUMENT_TYPES`). 목록의 규율은 「서버에
 *    있는 것만 적는다」이고, 이 종류는 **서버가 그린다**(확인 2026-09-17 · #1318). 넘기지 않으면
 *    배포본에서 `LabelRenditionNotReadyError` 로 **네트워크 요청 전에** 멎어, 서버가 그릴 준비를
 *    마쳤는데도 라벨이 한 장도 나오지 않는다.
 */
const printOne = async (
  client: Client,
  record: DocumentIssue,
  format: LabelFormat,
): Promise<PrintAttempt> => {
  /*
   * ⭐ **보낼 곳이 없으면 받지도 않는다.** 셸 밖에서 이 화면을 열면 인쇄 통로가 없으므로,
   *    받아 봐야 버릴 바이트를 서버에서 당기게 된다.
   */
  if (!hasPrintBridge()) return { kind: 'noBridge' };

  let bytes: ArrayBuffer;

  try {
    bytes = await fetchLabelRendition(
      client,
      record.documentIssueLogId,
      format,
      DOCUMENT_TYPE_CODE,
    );
  } catch (cause) {
    /* 받지 못한 것도 인쇄 실패다 — 종이는 나오지 않았고, 발행 기록은 남아 있다. */
    return { kind: 'failed', reason: cause instanceof Error ? cause.message : String(cause) };
  }

  return sendToPrinter(new Uint8Array(bytes), printLabel(record), format);
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
          /*
           * ⭐ **보고마다 새 키다.** 같은 키에 다른 본문(사유가 달라진 두 번째 실패 보고)을
           *    실으면 서버가 409 를 낸다 — 앞선 실패의 응답을 되돌려 주기 때문이다.
           */
          header: { 'Idempotency-Key': createIdempotencyKey(), 'X-Worker-No': workerNo },
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
