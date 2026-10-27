import type { ApiClient, ApiError } from '@omf-mes/api-client';
import { createIdempotencyKey } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';
import { useQueryClient, type QueryClient } from '@tanstack/react-query';
import { useCallback, useRef, useState } from 'react';

import { useApiClient } from '../../patterns/api-context';
import { renditionShell } from '../../patterns/pop-print';
import { runRequest, toApiError } from '../../patterns/request';

import { DOCUMENT_TYPE_CODE, IQC_DOCUMENT_TYPE_CODE } from './codes';
import { toIssueFailure } from './failure';
import { toDocumentIssueBody, toLotCreateBody, toPrintReportBody } from './issue-request';
import { buildMaterialLotLabelBytes } from './label-tspl';
import { receiptWhen } from './pending';
import { fetchFreshLines, receiptKeys, rowKeys, type IssuedView } from './queries';

import { toIssueView, type IssueView, type TargetRow } from './types';

const tLabel = messages.popMaterialLotLabel.label;

type Client = ApiClient['client'];

/**
 * 등록·인쇄가 어디까지 갔는가 — **다섯 걸음이고 한 트랜잭션이 아니다.**
 *
 * ```
 * register  POST /trace/lots                                    LOT 을 만든다
 * issue     POST /app/document-issues                           발행 기록을 만든다(회차는 서버)
 * render    (화면)                                              80 × 30 라벨을 직접 짠다
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
  /**
   * ⛔ **이 결과가 «어느 줄의 것인가».** 결과를 줄과 묶지 않으면, 끝난 뒤 다른 자재를 고른
   * 사람이 **남의 결과를 자기 것으로 읽는다** — 「인쇄했습니다」가 아직 찍지 않은 자재 밑에
   * 선다. 쉬는 중이면 `null`.
   */
  lineId: number | null;
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
  /**
   * ⚠ **라벨이 실제로 나왔는가.** 셸이 인쇄를 마친 뒤에도 결과 보고가 실패할 수 있는데
   * (`report` 걸음), 그것을 「끝내지 못했다」로만 말하면 작업자가 **같은 라벨을 한 장 더 찍는다.**
   * 종이는 이미 나왔다는 사실을 결과가 들고 있어야 그 말을 할 수 있다.
   */
  hasPrintedLabel: boolean;
  /** 만들어진 발행 기록. `issue` 를 넘겼을 때만 있다. */
  issue: IssueView | null;
  /**
   * ⛔ **이번 실행이 쓴(또는 만든) LOT.** 실패한 장을 다시 보낼 때 이 값을 줄에 실어야 한다 — 표의 줄은
   *    시작할 때 찍어 둔 것이라 `lotId` 가 비어 있고, 그대로 보내면 같은 자재에 LOT 이 하나 더 생긴다.
   */
  lotId: number | null;
  error: ApiError | null;
  /**
   * IQC 라벨(omf-all-around#110) — IQC 대상 자재의 첫 발행과, 검사 대기 LOT 의 재인쇄에서 찍는다. 대상이 아니면 `null`.
   * ⭐ 자재 라벨의 성패와 따로 센다 — IQC 라벨이 실패해도 자재 라벨은 나왔다. 자재 라벨이 안 나왔으면
   *   IQC 라벨은 시도하지 않고 `notPrinted` 다(화면이 «둘 다 안 나왔다»를 따로 말한다).
   */
  iqcLabel: 'printed' | 'failed' | 'notPrinted' | null;
}

export interface IssueCommand {
  row: TargetRow;
  /** 고른 프린터. 배정이 정해지기 전에는 서버 기본값에 맡긴다. */
  printerName: string | null;
  /** 재인쇄일 때만 채운다. 신규 발행에 사유가 붙으면 이력이 거짓이 된다. */
  reissueReasonCode: string | null;
  /** 라벨 수량 옆에 적을 단위 코드. 화면이 이름을 못 풀었으면 `null`. */
  uomCode: string | null;
  /**
   * 이미 등록된 LOT 의 품질 상태. 재인쇄가 IQC 라벨을 함께 찍을지 이것으로 가른다. 모르면 `null` —
   * 사유를 실은 IQC 대상 줄이면 보내기 전에 LOT 상세로 한 번 묻는다(`lotStatusOf`).
   */
  lotStatusCode: string | null;
  /** 라벨의 공급사 줄 — 화면이 「이름 (코드)」로 지어 준다. 못 풀었으면 `null`(그 줄을 비운다). */
  supplierText: string | null;
  /**
   * 보내기 직전에 이 보기의 줄을 다시 받아 **아직 그 보기에 있는지** 본다(`fetchFreshLines`). 다른 단말이
   * 먼저 찍었으면 보내지 않고 「이미 발행됨」으로 둔다. 실패한 장을 다시 보내는 것처럼 보기가 바뀐 줄은 싣지 않는다.
   */
  verify?: IssuedView;
  /**
   * 셸에게 «이 프린터로 보내라»고 실을 이름 — 셸이 고른 프린터를 받을 때(`selectable`)만 채운다.
   * 없거나 `null` 이면 싣지 않는다(셸이 지금처럼 기동 시 지정값 → OS 기본으로 보낸다).
   */
  shellPrinterName?: string | null;
}

/** 셸 인쇄의 다섯째 인자 — 고른 프린터가 있을 때만 싣는다(옛 호출 모양을 그대로 둔다). */
const printerArgs = (shellPrinterName: string | null | undefined): [] | [string] =>
  shellPrinterName === null || shellPrinterName === undefined ? [] : [shellPrinterName];

/** IQC 라벨을 붙일 수 있는 LOT 상태 — 서버 IQC_LABEL 자격(수입검사 대기)과 같다. */
const IQC_PENDING_LOT_STATUS = 'INSPECTION_PENDING';

/** 인쇄를 못 한 사유 — 서버 보고에 그대로 실린다. `FAILED` 인데 사유가 없으면 422 다. */
const NO_SHELL_REASON = '셸 인쇄 통로가 없는 단말에서 실행됐습니다.';

const createLot = async (
  client: Client,
  row: TargetRow,
  occurredAt: string,
  workerNo: string,
  idempotencyKey: string,
): Promise<number> => {
  const data = await runRequest(() =>
    client.POST('/trace/lots', {
      params: {
        header: { 'Idempotency-Key': idempotencyKey, 'X-Worker-No': workerNo },
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
  idempotencyKey: string,
  documentTypeCode: typeof DOCUMENT_TYPE_CODE = DOCUMENT_TYPE_CODE,
): Promise<IssueView> => {
  const data = await runRequest(() =>
    client.POST('/app/document-issues', {
      params: {
        header: { 'Idempotency-Key': idempotencyKey, 'X-Worker-No': workerNo },
      },
      body: toDocumentIssueBody(input, documentTypeCode),
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
 * 인쇄할 라벨을 **POP 이 직접 짠다**(사용자 지시 2026-09-14 · `label-tspl` 머리말).
 *
 * ⭐ 라벨 양식은 2026-10-24 개편안 승인본이다(omf-all-around#184) — QR 왼쪽, 품목코드·수량을 크게,
 *    품명·공급사·입하일. 한글·베트남어가 든 줄은 그림으로 찍는다(위치 라벨과 같은 길).
 * ⭐ 서버 렌디션은 100 × 60 mm 좌표라 현장의 80 × 30 mm 라벨지에서 잘렸다. 라벨에 실을 값만
 *   서버에서 받는다 — 품번·품명은 품목 상세, LOT 번호는 발행 기록(없으면 LOT 상세)에서.
 *
 * ⛔ **값을 못 받으면 짜지 않는다.** 빈 품번·LOT 으로 찍힌 라벨은 나온 것처럼 보이지만 쓸 수 없다 —
 *    `render` 걸음의 실패로 멈춘다.
 */
const buildLabel = async (
  client: Client,
  input: {
    row: TargetRow;
    issue: IssueView;
    lotId: number;
    uomCode: string | null;
    supplierText: string | null;
  },
  kind: 'material' | 'iqc' = 'material',
): Promise<Uint8Array> => {
  const { row, issue, lotId, uomCode, supplierText } = input;

  const item = await runRequest(() =>
    client.GET('/mdm/items/{itemId}', { params: { path: { itemId: row.itemId } } }),
  );

  const lotNo =
    issue.lotNo ??
    (await runRequest(() => client.GET('/trace/lots/{lotId}', { params: { path: { lotId } } }))).lot
      .lotNo;
  const received = receiptWhen(row.receiptDatetime);

  return buildMaterialLotLabelBytes({
    itemCode: item.item.itemCode,
    itemName: item.item.itemName,
    lotNo,
    qty: row.receivedQty,
    uomCode,
    issueSeq: issue.issueSeq,
    supplier: supplierText,
    receipt: received === null ? null : tLabel.received(received.date),
    kind,
  });
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
        header: { 'Idempotency-Key': createIdempotencyKey(), 'X-Worker-No': workerNo },
      },
      body: toPrintReportBody(failureReason),
    }),
  );
};

/**
 * IQC 라벨 한 장 — 발행 기록 → 라벨 짜기 → 셸 인쇄 → 결과 보고(자재 라벨과 같은 네 걸음).
 * ⛔ 실패를 던지지 않는다 — 자재 라벨은 이미 나왔고 그 결과를 덮으면 안 된다. 실패는 `failed` 로 알리고,
 *    보고까지 갔으면 서버에도 실패로 남는다.
 */
/** 서버가 「재발행 사유가 필요합니다」로 거절했는가 — 그 문서의 2회차 이상이라는 뜻이다. */
const needsReissueReason = (cause: unknown): boolean => {
  const error = toApiError(cause);

  return (
    error.kind === 'validation' &&
    error.errors.some((item) => item.field === 'reissueReasonCode' && item.code === 'REQUIRED')
  );
};

/**
 * IQC 라벨 발행 기록. 재인쇄에서 왔으면(`reissueReasonCode`) **먼저 사유 없이** 부른다 — IQC 라벨은
 * 자재 라벨과 회차를 따로 세서, 자재 라벨 재인쇄가 IQC 라벨의 «첫» 발행일 수 있다(자재 라벨이 안 나와
 * IQC 라벨을 건너뛴 경우). 그때 사유를 실으면 첫 발행이 재발행으로 남는다. 서버가 사유를 요구하면
 * (2회차 이상) 같은 사유로 다시 부른다.
 */
const createIqcIssue = async (
  client: Client,
  input: { lotId: number; printerName: string | null; reissueReasonCode: string | null },
  workerNo: string,
): Promise<IssueView> => {
  const issueWith = (reissueReasonCode: string | null) =>
    createIssue(
      client,
      { lotId: input.lotId, printerName: input.printerName, reissueReasonCode },
      workerNo,
      createIdempotencyKey(),
      IQC_DOCUMENT_TYPE_CODE,
    );

  try {
    return await issueWith(null);
  } catch (cause) {
    if (input.reissueReasonCode === null || !needsReissueReason(cause)) throw cause;

    return issueWith(input.reissueReasonCode);
  }
};

const printIqcLabel = async (
  client: Client,
  input: {
    row: TargetRow;
    lotId: number;
    uomCode: string | null;
    supplierText: string | null;
    printerName: string | null;
    reissueReasonCode: string | null;
    shellPrinterName?: string | null;
  },
  workerNo: string,
  shell: NonNullable<ReturnType<typeof renditionShell>>,
): Promise<'printed' | 'failed'> => {
  try {
    const issue = await createIqcIssue(client, input, workerNo);
    const bytes = await buildLabel(client, { ...input, issue }, 'iqc');
    const failureReason = await shell
      .save(
        bytes,
        `iqc-${String(issue.documentIssueLogId)}`,
        new Date().toISOString(),
        'tspl',
        ...printerArgs(input.shellPrinterName),
      )
      .then(() => null)
      .catch((cause: unknown) =>
        cause instanceof Error ? cause.message : '셸 인쇄가 실패했습니다.',
      );
    try {
      await reportPrint(client, issue.documentIssueLogId, failureReason, workerNo);
    } catch {
      // 결과 보고만 실패했다 — 종이가 나왔으면 「나오지 않았다」고 말하지 않는다(재인쇄로 한 장 더 나간다).
    }
    return failureReason === null ? 'printed' : 'failed';
  } catch {
    return 'failed';
  }
};

/** 발행 사이에 붙잡아 두는 멱등 키 — 줄마다(`useBatchIssue` 머리말). */
interface IssueKeys {
  lot: Map<number, string>;
  issue: Map<number, { key: string; signature: string }>;
}

interface IssueDeps {
  client: Client;
  queryClient: QueryClient;
  workerNo: string;
  keys: IssueKeys;
  onStep: (step: IssueStep) => void;
}

/**
 * 사유를 실은 IQC 대상 줄의 LOT 상태 — 화면이 모르면 보내기 전에 한 번 묻는다.
 *
 * ⭐ 인쇄가 실패한 장을 다시 보낼 때 표의 줄은 시작할 때 찍어 둔 것이라 상태를 모른다. 묻지 않으면
 *    검사 대기 LOT 의 IQC 라벨이 빠진다. 못 물으면 `null` — 그때는 IQC 라벨을 찍지 않는다(서버도 막는다).
 */
const lotStatusOf = async (client: Client, lotId: number): Promise<string | null> => {
  try {
    const data = await runRequest(() =>
      client.GET('/trace/lots/{lotId}', { params: { path: { lotId } } }),
    );

    return data.lot.statusCode;
  } catch {
    return null;
  }
};

/**
 * 한 줄의 등록·인쇄를 끝까지 몬다 — 결과를 던지지 않고 돌려준다.
 *
 * ⛔ **`lotId` 가 이미 있는 줄에는 등록을 부르지 않는다.** 부르면 같은 자재에 LOT 이 둘 생기고
 *    되돌릴 화면이 없다(변경 통지 #534 §3). 판정은 줄의 `lotId` 로 한다.
 * ⛔ **인쇄에 실패해도 발행 기록을 되돌리지 않는다.** 실패는 보고하고 재발행으로 처리한다 — 그 재발행의
 *    사유가 「인쇄 실패」다(계약 명시).
 */
const issueOne = async (deps: IssueDeps, command: IssueCommand): Promise<IssueRunResult> => {
  const { client, queryClient, workerNo, keys, onStep } = deps;
  const { row, printerName, reissueReasonCode, uomCode, shellPrinterName, supplierText } = command;
  let hasCreatedLot = false;
  let hasPrintedLabel = false;
  let issue: IssueView | null = null;
  let lotId = row.lotId;
  /*
   * ⛔ **멈춘 자리는 이 변수로 센다.** 걸음 표시는 그리기 위한 것이라 다음 렌더에서야 반영되고,
   * 잡은 자리에서 상태 변수를 읽으면 **한 걸음 뒤진 값**이 나온다.
   */
  let at: IssueStep = 'register';

  const enter = (next: IssueStep): void => {
    at = next;
    onStep(next);
  };

  try {
    enter('register');

    if (lotId === null) {
      /*
       * 등록의 멱등 키 — **적용될 때까지 줄마다 같은 값을 쓴다.** 매번 새 키면 통신이 끊긴 뒤 다시 보낸
       * 등록을 서버가 «다른 쓰기»로 보아 LOT 이 하나 더 생긴다.
       */
      const key = keys.lot.get(row.inboundReceiptLineId) ?? createIdempotencyKey();
      keys.lot.set(row.inboundReceiptLineId, key);

      lotId = await createLot(client, row, new Date().toISOString(), workerNo, key);
      hasCreatedLot = true;
      // 적용됐다 — 이 줄의 키는 제 몫을 다했다. 남겨 두면 다음 등록이 옛 키로 나간다.
      keys.lot.delete(row.inboundReceiptLineId);
      // 줄에 LOT 이 붙었다 — 그 건의 줄을 다시 읽어야 다음 조작이 옳은 줄을 본다.
      await queryClient.invalidateQueries({ queryKey: receiptKeys.lines(row.inboundReceiptId) });
    }

    enter('issue');
    /*
     * 발행의 멱등 키 — **같은 본문을 다시 보낼 때만 같은 값을 쓴다**(스펙 §5-2). 본문을 가르는 값이
     * 하나라도 다르면 다른 쓰기다 — 사유 없는 발행이 재인쇄로 둔갑하는 길을 막는다.
     */
    const signature = `${String(lotId)}|${printerName ?? ''}|${reissueReasonCode ?? ''}`;
    const held = keys.issue.get(row.inboundReceiptLineId);
    const issueKey = held?.signature === signature ? held.key : createIdempotencyKey();
    keys.issue.set(row.inboundReceiptLineId, { key: issueKey, signature });

    issue = await createIssue(
      client,
      { lotId, printerName, reissueReasonCode },
      workerNo,
      issueKey,
    );
    // 기록이 남았다 — 다음 재인쇄는 새 회차라 새 키여야 한다.
    keys.issue.delete(row.inboundReceiptLineId);

    enter('render');
    const bytes = await buildLabel(client, { row, issue, lotId, uomCode, supplierText });

    enter('print');
    const shell = renditionShell();

    /*
     * ⛔ **통로가 없는 것을 인쇄 성공으로 보고하지 않는다.** 기록은 이미 남았으므로 실패로 보고해야
     * 「나오지 않은 라벨」이 나온 것으로 남지 않는다.
     */
    const failureReason =
      shell === null
        ? NO_SHELL_REASON
        : await shell
            .save(
              bytes,
              `lot-${String(issue.documentIssueLogId)}`,
              new Date().toISOString(),
              'tspl',
              ...printerArgs(shellPrinterName),
            )
            .then(() => null)
            .catch((cause: unknown) =>
              cause instanceof Error ? cause.message : '셸 인쇄가 실패했습니다.',
            );

    hasPrintedLabel = failureReason === null;

    enter('report');
    await reportPrint(client, issue.documentIssueLogId, failureReason, workerNo);

    /*
     * IQC 라벨(omf-all-around#110) — IQC 대상 자재면 자재 라벨 뒤에 한 장 더. 재인쇄는 LOT 이 아직
     * 검사 대기일 때만 함께 찍는다(2단계 검증 2026-10-16). 판정이 끝난 LOT 에는 붙일 일이 없고 서버도 막는다.
     */
    const lotStatusCode =
      row.inspectionRequired && reissueReasonCode !== null && command.lotStatusCode === null
        ? await lotStatusOf(client, lotId)
        : command.lotStatusCode;
    const wantsIqcLabel =
      row.inspectionRequired &&
      (reissueReasonCode === null || lotStatusCode === IQC_PENDING_LOT_STATUS);
    const iqcLabel = !wantsIqcLabel
      ? null
      : failureReason !== null || shell === null
        ? 'notPrinted'
        : await printIqcLabel(
            client,
            {
              row,
              lotId,
              uomCode,
              supplierText,
              printerName,
              reissueReasonCode,
              shellPrinterName,
            },
            workerNo,
            shell,
          );

    return {
      lineId: row.inboundReceiptLineId,
      isPrinted: failureReason === null,
      failedAt: failureReason === null ? null : 'print',
      hasCreatedLot,
      hasPrintedLabel,
      issue,
      lotId,
      error: null,
      iqcLabel,
    };
  } catch (cause) {
    return {
      lineId: row.inboundReceiptLineId,
      isPrinted: false,
      failedAt: at,
      hasCreatedLot,
      hasPrintedLabel,
      issue,
      lotId,
      error: toApiError(cause),
      iqcLabel: null,
    };
  }
};

/**
 * 한 장이 이렇게 끝나면 **남은 장을 보내지 않는다** — 프린터가 응답하지 않았거나(셸 통로 없음 포함),
 * 이 단말에 발행 권한이 없다. 다음 장도 같은 답이 온다.
 *
 * ⭐ 그 밖의 실패(검사기준 없음 · 등록 지연 · 발행할 수 없는 LOT)는 **그 줄만의 사정**이라 나머지는 계속
 *    보낸다(개편안 결정 2026-10-24).
 */
export const stopsBatch = (result: IssueRunResult): boolean => {
  const failure = toIssueFailure(result);

  return failure === 'printFailed' || failure === 'issueForbidden';
};

export interface IssueRunOptions {
  /**
   * 귀속 사번. **없으면 부르지 않는다** — 서버가 거부한다(공유계약 D-5).
   *
   * ⛔ **모르면 `null` 이다.** 빈 문자열로 떨어뜨리지 않는다 — 빈 값은 서버에 「사번이 있다」로
   * 나가고, 거절이 화면이 아니라 서버에서 난다.
   */
  workerNo: string | null;
}

export interface BatchIssueHandle {
  /** 고른 줄을 차례로 보낸다. 이미 돌고 있으면 무시한다. */
  run: (commands: readonly IssueCommand[]) => void;
  /** 지금 장까지 끝내고 멈춘다. 남은 장은 `notRun` 으로 남는다. */
  stop: () => void;
  /** 결과를 걷는다 — 「확인」. 돌고 있으면 무시한다. */
  reset: () => void;
  isRunning: boolean;
  isStopping: boolean;
  /** 지금 보내는 줄. 쉬는 중이면 `null`. */
  currentLineId: number | null;
  step: IssueStep | null;
  /** 이번 묶음에서 보내기로 한 줄의 차례. 「확인」 전까지 다시 보내도 자리를 지킨다. */
  order: readonly number[];
  results: ReadonlyMap<number, IssueRunResult>;
  /** 보내기 직전에 보니 다른 단말이 먼저 찍었다 — 보내지 않았다. */
  skipped: ReadonlySet<number>;
  /** 멈춤·프린터 고장으로 보내지 않은 줄. */
  notRun: ReadonlySet<number>;
}

const without = <T>(set: ReadonlySet<T>, drop: readonly T[]): Set<T> => {
  const next = new Set(set);

  for (const value of drop) next.delete(value);

  return next;
};

/**
 * 라벨 여러 장을 **한 번에, 한 장씩 차례로** 보낸다(개편안 승인 2026-10-24 · omf-all-around#184).
 *
 * ⭐ 서버를 바꾸지 않는다 — 한 장마다 하는 일(등록 → 발행 기록 → 라벨 짜기 → 인쇄 → 결과 보고)은 옛
 *    화면 그대로다. 묶음은 그것을 줄마다 되풀이하고 결과를 줄마다 남길 뿐이다.
 *
 * ⛔ **한 번에 하나만 돈다.** 단추의 비활성만으로는 막지 못한다 — 장갑 낀 손이 빠르게 두 번 누르면
 *    **같은 렌더에서 두 번** 들어온다. 그러면 같은 줄의 등록이 두 번 나가 LOT 이 둘 생긴다.
 */
export const useBatchIssue = ({ workerNo }: IssueRunOptions): BatchIssueHandle => {
  const { client } = useApiClient();
  const queryClient = useQueryClient();
  const running = useRef(false);
  const stopRequested = useRef(false);
  /*
   * 멱등 키는 묶음을 넘어 붙잡아 둔다 — 실패한 장을 다시 보낼 때(같은 줄 · 같은 본문) 같은 키로
   * 나가야 서버가 같은 쓰기로 본다(`issueOne` 머리말).
   */
  const keys = useRef<IssueKeys>({ lot: new Map(), issue: new Map() });

  const [isRunning, setIsRunning] = useState(false);
  const [isStopping, setIsStopping] = useState(false);
  const [currentLineId, setCurrentLineId] = useState<number | null>(null);
  const [step, setStep] = useState<IssueStep | null>(null);
  const [order, setOrder] = useState<readonly number[]>([]);
  const [results, setResults] = useState<ReadonlyMap<number, IssueRunResult>>(new Map());
  const [skipped, setSkipped] = useState<ReadonlySet<number>>(new Set());
  const [notRun, setNotRun] = useState<ReadonlySet<number>>(new Set());

  const run = useCallback(
    (commands: readonly IssueCommand[]) => {
      /*
       * ⛔ **사번을 모르면 아무것도 부르지 않는다**(공유계약 D-5 · F-6). 단추도 함께 막혀
       * 있지만 판정을 나가는 자리에 두어, 다른 경로가 생겨도 빈 사번이 새지 않게 한다.
       */
      if (workerNo === null || commands.length === 0) return;
      if (running.current) return;

      running.current = true;
      stopRequested.current = false;
      setIsRunning(true);
      setIsStopping(false);

      const ids = commands.map((command) => command.row.inboundReceiptLineId);

      setOrder((previous) => [...previous, ...ids.filter((id) => !previous.includes(id))]);
      setResults((previous) => {
        const next = new Map(previous);

        for (const id of ids) next.delete(id);

        return next;
      });
      setSkipped((previous) => without(previous, ids));
      setNotRun((previous) => without(previous, ids));

      const execute = async (): Promise<void> => {
        const deps: IssueDeps = {
          client,
          queryClient,
          workerNo,
          keys: keys.current,
          onStep: setStep,
        };
        const touchedReceipts = new Set<number>();

        try {
          const queue = await verifyCommands(queryClient, client, commands, (gone) => {
            setSkipped((previous) => new Set([...previous, ...gone]));
          });

          for (const [index, command] of queue.entries()) {
            const rest = queue.slice(index).map((left) => left.row.inboundReceiptLineId);

            if (stopRequested.current) {
              setNotRun((previous) => new Set([...previous, ...rest]));
              break;
            }

            setCurrentLineId(command.row.inboundReceiptLineId);
            touchedReceipts.add(command.row.inboundReceiptId);

            const result = await issueOne(deps, command);

            setResults((previous) =>
              new Map(previous).set(command.row.inboundReceiptLineId, result),
            );

            if (stopsBatch(result)) {
              setNotRun((previous) => new Set([...previous, ...rest.slice(1)]));
              break;
            }
          }
        } finally {
          running.current = false;
          stopRequested.current = false;
          setIsRunning(false);
          setIsStopping(false);
          setCurrentLineId(null);
          setStep(null);
          // 줄의 발행 여부가 바뀌었다 — 끝나면 언제나 다시 읽는다. 건의 줄은 건드린 건만.
          await queryClient.invalidateQueries({ queryKey: rowKeys.all });
          await queryClient.invalidateQueries({ queryKey: receiptKeys.lists });
          for (const receiptId of touchedReceipts) {
            await queryClient.invalidateQueries({ queryKey: receiptKeys.lines(receiptId) });
          }
        }
      };

      void execute();
    },
    [client, queryClient, workerNo],
  );

  const stop = useCallback(() => {
    if (!running.current) return;

    stopRequested.current = true;
    setIsStopping(true);
  }, []);

  const reset = useCallback(() => {
    if (running.current) return;

    setOrder([]);
    setResults(new Map());
    setSkipped(new Set());
    setNotRun(new Set());
  }, []);

  return {
    run,
    stop,
    reset,
    isRunning,
    isStopping,
    currentLineId,
    step,
    order,
    results,
    skipped,
    notRun,
  };
};

/**
 * 보내기 직전 확인 — `verify` 를 단 줄은 그 보기를 **지금** 다시 받아, 다른 단말이 먼저 찍은 줄은 빼고
 * (`onGone`) 남은 줄은 서버가 아는 지금 `lotId` 로 맞춘다.
 *
 * ⚠ 확인을 못 했으면(조회 실패) 받은 줄 그대로 보낸다 — 같은 줄의 두 번째 LOT 은 서버가 막는다.
 */
const verifyCommands = async (
  queryClient: QueryClient,
  client: Client,
  commands: readonly IssueCommand[],
  onGone: (lineIds: number[]) => void,
): Promise<IssueCommand[]> => {
  const fresh = new Map<IssuedView, Map<number, { lotId: number | null }>>();

  for (const view of ['unissued', 'issued'] as const) {
    const targets = commands.filter((command) => command.verify === view);

    if (targets.length === 0) continue;

    try {
      fresh.set(
        view,
        await fetchFreshLines(
          queryClient,
          client,
          targets.map((command) => command.row.inboundReceiptId),
          view,
        ),
      );
    } catch {
      /* 확인을 못 했다 — 받은 줄 그대로 보낸다. */
    }
  }

  const queue: IssueCommand[] = [];
  const gone: number[] = [];

  for (const command of commands) {
    const lines = command.verify === undefined ? undefined : fresh.get(command.verify);
    const line = lines?.get(command.row.inboundReceiptLineId);

    if (lines !== undefined && line === undefined) {
      gone.push(command.row.inboundReceiptLineId);
    } else {
      queue.push(
        line === undefined ? command : { ...command, row: { ...command.row, lotId: line.lotId } },
      );
    }
  }

  if (gone.length > 0) onGone(gone);

  return queue;
};
