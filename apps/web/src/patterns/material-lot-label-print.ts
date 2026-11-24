import type { ApiClient, components, MaterialPackage } from '@omf-mes/api-client';
import { createIdempotencyKey } from '@omf-mes/api-client';

import { buildMaterialLotLabelBytes, type MaterialLotLabelFields } from './label/lot-label-tspl';
import { formatPackage } from './package-qty';
import type { renditionShell } from './pop-print';
import { runRequest } from './request';

/**
 * 자재 LOT 라벨 한 장의 걸음 — **발행 기록 → 라벨 짜기 → 셸 인쇄 → 결과 보고**.
 *
 * ⭐ POP 자재 LOT 라벨(P-01-01)에서 꺼냈다(008 · omf-all-around#289 · plan C1). 분할 LOT 라벨(P-01-02)도
 *    같은 양식·같은 발행 기록으로 찍는다(spec FR-007 — QR = LOT 번호). 동작은 P-01-01 그대로다.
 * ⭐ 걸음을 엮는 일(멱등 키 붙잡기 · 묶음 · 멈춤)은 화면마다 다르므로 여기 두지 않는다.
 * ⛔ 서버 렌디션은 부르지 않는다 — 라벨은 POP 이 직접 짠다(`label/lot-label-tspl` 머리말).
 */

type Client = ApiClient['client'];

export type DocumentIssueCreateBody = components['schemas']['DocumentIssueCreate'];
export type PrintOutcomeReportBody = components['schemas']['PrintOutcomeReport'];

/**
 * ⚠ **자리표시다.** 「자재LOT 라벨」을 뜻하는 문서 유형 코드 문자열이 아직 정해지지 않았다
 * (`omf-mes#145` — 업무 코드 51종의 값 목록 확정 대기).
 *
 * 착수 이슈 #139 §4 가 이 항목의 처리 방법을 **「자리표시 상수 + 안내」**로 지정했다. 값이
 * 확정되면 이 줄 하나만 바꾼다 — 화면·요청 조립 코드는 건드릴 것이 없다.
 */
export const DOCUMENT_TYPE_CODE = 'MATERIAL_LOT_LABEL';

/**
 * ⚠ **자리표시다.** 발행 대상이 LOT 임을 뜻하는 코드 문자열이 아직 정해지지 않았다 — 계약
 * `DocumentTarget.targetTypeCode` 가 「값 문자열은 아직 확정되지 않았다」로 명시한다.
 *
 * 위와 같은 이유로 이 줄 하나만 바꾸면 된다.
 */
export const DOCUMENT_TARGET_TYPE_CODE = 'LOT';

export interface DocumentIssueInput {
  lotId: number;
  /** 고른 프린터. 배정이 정해지기 전에는 서버 기본값에 맡긴다(`null`). */
  printerName: string | null;
  /**
   * 재발행 사유. **회차가 2 이상이면 서버가 필수로 요구한다** — 없으면 422 다.
   *
   * ⛔ 화면이 회차를 세어 이 값의 필요 여부를 판정하지 않는다. 「재인쇄」를 누른 흐름에서만
   * 채우고, 나머지는 비운다 — 신규 기록에 사유가 붙으면 이력이 거짓이 된다.
   */
  reissueReasonCode: string | null;
}

/**
 * 발행 기록 본문 — 보내는 본문을 만드는 **유일한 지점**이다(순수 함수).
 *
 * ⛔ **인쇄하지 않는다.** 이 호출은 기록만 만들고, 그린 것을 받아 보내는 것은 다음 걸음이다.
 * 프린터가 죽어도 기록은 남는다 — 그래야 「실제로는 안 나온 라벨」이 나온 것으로 남지 않는다.
 *
 * ⛔ **`terminalId` 를 싣지 않는다.** 계약에서 삭제됐다(변경 통지 #601 §1-2) — 단말은 서버가
 * 요청을 인증한 단말 토큰에서 푼다. ⚠ 없는 키를 보내도 서버가 오류를 내지 않을 수 있어,
 * 지우지 않으면 조용히 무시된 채 아무도 모른다.
 *
 * 대상은 **한 건**이다. 계약은 여러 건을 한 트랜잭션으로 받지만 화면은 LOT 하나씩 찍는다 —
 * 「하나라도 실패하면 전건 실패」라는 계약 조항이 걸릴 자리가 없다.
 */
export const toDocumentIssueBody = ({
  lotId,
  printerName,
  reissueReasonCode,
}: DocumentIssueInput): DocumentIssueCreateBody => ({
  documentTypeCode: DOCUMENT_TYPE_CODE,
  targets: [{ targetTypeCode: DOCUMENT_TARGET_TYPE_CODE, targetId: lotId, lotId }],
  ...(reissueReasonCode === null ? {} : { reissueReasonCode }),
  ...(printerName === null ? {} : { printerName }),
});

/**
 * 인쇄 결과 보고 본문.
 *
 * ⛔ **실패를 삼키지 않는다.** 보고하지 않으면 발행 기록이 곧 인쇄 성공으로 읽혀, 나오지 않은
 * 라벨이 나온 것으로 남는다. 실패는 되돌리지 않고 **재발행**으로 처리한다.
 *
 * ⚠ `FAILED` 인데 사유가 없으면 422 다 — 사유를 반드시 함께 싣는다.
 */
export const toPrintReportBody = (failureReason: string | null): PrintOutcomeReportBody =>
  failureReason === null ? { outcome: 'SUCCEEDED' } : { outcome: 'FAILED', failureReason };

type DocumentIssueResponse = components['schemas']['DocumentIssue'];

/** 인쇄 결과. 계약의 enum 을 그대로 쓴다 — 보고 전에는 `PENDING` 이다. */
export type PrintOutcome = DocumentIssueResponse['printOutcome'];

/**
 * 화면이 다루는 발행 기록 한 건.
 *
 * **회차(`issueSeq`)는 서버가 매긴다.** ⛔ 화면이 세지 않는다 — 같은 대상을 다른 단말에서도
 * 찍으므로 화면이 센 값은 곧 틀린다(착수 이슈 #139 §6).
 */
export interface IssueView {
  documentIssueLogId: number;
  issueSeq: number;
  lotNo: string | null;
  printOutcome: PrintOutcome;
}

/** 응답 한 건을 화면 타입으로 옮기는 **유일한 지점**이다. */
export const toIssueView = (data: DocumentIssueResponse): IssueView => ({
  documentIssueLogId: data.documentIssueLogId,
  issueSeq: data.issueSeq,
  lotNo: data.lotNo ?? null,
  printOutcome: data.printOutcome,
});

/** 발행 기록을 만든다(`POST /app/document-issues`) — 회차는 서버가 매긴다. */
export const createMaterialLotLabelIssue = async (
  client: Client,
  input: DocumentIssueInput,
  workerNo: string,
  idempotencyKey: string,
): Promise<IssueView> => {
  const data = await runRequest(() =>
    client.POST('/app/document-issues', {
      params: {
        header: { 'Idempotency-Key': idempotencyKey, 'X-Worker-No': workerNo },
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

/** 라벨 면에 실을 LOT 의 값 — 화면의 줄 타입이 이 모양을 갖추면 된다. */
export interface MaterialLotLabelLot {
  itemCode: string;
  itemName: string;
  lotNo: string;
  lotQty: number;
  /** 품목 기본 단위. */
  uomCode: string;
  /** 공급사 — 모르면(분할 LOT 의 원조 입하가 없음) 둘 다 `null` 이고 공급사 줄을 뺀다. */
  supplierCode: string | null;
  supplierName: string | null;
  /** 패키징 — 없으면 수량 줄 오른쪽이 빈다(분할 LOT 은 늘 없다 · 008 FR-007). */
  package: MaterialPackage | null;
}

/**
 * 인쇄할 라벨을 **POP 이 직접 짠다**(사용자 지시 2026-09-14 · `label/lot-label-tspl` 머리말).
 *
 * ⭐ 라벨 양식은 2026-10-24 개편안 승인본이다(omf-all-around#184) — QR 왼쪽, 품목코드·수량을 크게, 품명·공급사.
 * ⭐ 005 — 수량 줄 오른쪽 끝에 패키징(있으면 「봉지 10 × 100」)을 싣는다(FR-007). 입하 전에 찍으므로 옛 「입하일」은
 *    없다. 품목·공급사·수량·패키징은 목록 응답이 이미 싣고, LOT 번호는 발행 기록(없으면 줄)의 값이다.
 */
/**
 * 라벨에 싣는 값 — 인쇄(`drawMaterialLotLabel`)와 화면 미리보기가 **같은 값**을 쓴다(따로 짜면 본 것과 나온 것이 갈린다).
 */
export const materialLotLabelFieldsOf = (
  lot: MaterialLotLabelLot,
  issueSeq: number,
  lotNo: string = lot.lotNo,
): MaterialLotLabelFields => ({
  itemCode: lot.itemCode,
  itemName: lot.itemName,
  lotNo,
  qty: lot.lotQty,
  uomCode: lot.uomCode,
  issueSeq,
  supplier:
    lot.supplierName === null || lot.supplierCode === null
      ? null
      : `${lot.supplierName} (${lot.supplierCode})`,
  /* 라벨 인쇄는 코드 그대로 — 프린터 글꼴 · 칸 폭이 정해져 있다(화면 표기만 이름, G1 잔여). */
  receipt: formatPackage(lot.package === null ? null : { ...lot.package, uomName: null }),
});

export const drawMaterialLotLabel = (input: {
  lot: MaterialLotLabelLot;
  issue: IssueView;
}): Uint8Array => {
  const { lot, issue } = input;

  return buildMaterialLotLabelBytes(
    materialLotLabelFieldsOf(lot, issue.issueSeq, issue.lotNo ?? lot.lotNo),
  );
};

/** 인쇄를 못 한 사유 — 서버 보고에 그대로 실린다. `FAILED` 인데 사유가 없으면 422 다. */
export const NO_SHELL_REASON = '셸 인쇄 통로가 없는 단말에서 실행됐습니다.';

/**
 * 짠 라벨을 셸로 보낸다 — 실패 사유를 돌려주고(성공이면 `null`) **던지지 않는다.**
 *
 * ⛔ **통로가 없는 것을 인쇄 성공으로 보고하지 않는다.** 기록은 이미 남았으므로 실패로 보고해야
 *    「나오지 않은 라벨」이 나온 것으로 남지 않는다.
 *
 * `shellPrinterName` — 셸에게 «이 프린터로 보내라»고 실을 이름. 없거나 `null` 이면 싣지 않는다(옛 호출 모양 그대로).
 */
export const printMaterialLotLabel = async (
  shell: ReturnType<typeof renditionShell>,
  bytes: Uint8Array,
  name: string,
  shellPrinterName?: string | null,
): Promise<string | null> => {
  if (shell === null) return NO_SHELL_REASON;

  const printerArgs: [] | [string] =
    shellPrinterName === null || shellPrinterName === undefined ? [] : [shellPrinterName];

  return shell
    .save(bytes, name, new Date().toISOString(), 'tspl', ...printerArgs)
    .then(() => null)
    .catch((cause: unknown) =>
      cause instanceof Error ? cause.message : '셸 인쇄가 실패했습니다.',
    );
};

/** 인쇄 결과를 보고한다(`POST /app/document-issues/{id}:report-print`). */
export const reportMaterialLotLabelPrint = async (
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
