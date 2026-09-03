import { DOCUMENT_TARGET_TYPE_CODE, DOCUMENT_TYPE_CODE } from './codes';
import type { DocumentIssueCreate } from './types';

/**
 * 발행 요청을 조립하고 **보낼 수 있는지**를 판정한다.
 *
 * 조립과 판정을 화면에서 떼어 두는 이유는 하나다 — 「재발행인데 사유가 없다」를 화면이
 * 눈으로만 막으면 그 규칙에 감지기를 걸 자리가 없다. 서버는 이 경우 **422** 를 낸다.
 */

/**
 * 이 LOT 이 **재발행 대상인가.**
 *
 * ⛔ **「모른다」를 신규로 보지 않는다.** 발행 현황 조회가 실패했을 때 `null` 이 오는데(`types.ts`),
 * 그것을 0 으로 다루면 이미 찍힌 LOT 을 사유 없이 다시 찍는다 — 서버가 422 로 막지만 화면은
 * 그때까지 「보낼 수 있다」고 말한 셈이 된다.
 */
export type ReissueVerdict = 'new' | 'reissue' | 'unknown';

export const judgeReissue = (issueCount: number | null): ReissueVerdict => {
  if (issueCount === null) return 'unknown';

  return issueCount > 0 ? 'reissue' : 'new';
};

/** 발행을 열 수 없는 사유. `null` 이면 보낼 수 있다. */
export type IssueBlock =
  | 'noTarget'
  | 'noWorker'
  | 'gateDenied'
  | 'gateUnknown'
  | 'noPrinter'
  | 'printerUnknown'
  | 'shellUnavailable'
  | 'issueCountUnknown'
  | 'reissueReasonMissing';

export interface IssueGuardInput {
  lotId: number | null;
  workerNo: string | null;
  /** 단말 게이팅 판정이 통과인가. 「모른다」는 통과가 아니다(F-6) */
  gate: 'allowed' | 'denied' | 'unknown';
  printer: 'ready' | 'none' | 'unknown';
  /** 실제 프린터 전달 통로. 브라우저에서는 발행 기록도 만들지 않는다 */
  shellAvailable: boolean;
  verdict: ReissueVerdict;
  /** 사용자가 고른 재발행 사유. 신규 발행에서는 쓰이지 않는다 */
  reissueReasonCode: string | null;
}

/**
 * 보낼 수 있는가 — **막는 사유를 하나 고른다.**
 *
 * 순서가 규정이다: 대상 → 사번 → 게이팅 → 회차 판정 → 사유. 앞의 것이 없으면 뒤를 물을 수
 * 없다(사번 없이 게이팅을 말해 봐야 사용자가 할 일이 달라지지 않는다).
 */
export const guardIssue = ({
  lotId,
  workerNo,
  gate,
  printer,
  shellAvailable,
  verdict,
  reissueReasonCode,
}: IssueGuardInput): IssueBlock | null => {
  if (lotId === null) return 'noTarget';
  if (workerNo === null) return 'noWorker';
  if (gate === 'denied') return 'gateDenied';
  if (gate === 'unknown') return 'gateUnknown';
  if (printer === 'none') return 'noPrinter';
  if (printer === 'unknown') return 'printerUnknown';
  if (!shellAvailable) return 'shellUnavailable';
  if (verdict === 'unknown') return 'issueCountUnknown';
  if (verdict === 'reissue' && reissueReasonCode === null) return 'reissueReasonMissing';

  return null;
};

export interface IssueRequestInput {
  lotId: number;
  /** 재발행일 때만 싣는다 — 신규 기록에 사유가 붙으면 이력이 거짓이 된다(계약 명시) */
  reissueReasonCode: string | null;
  /** 머리에 보이는 프린터. 없으면 서버가 정한다 */
  printerName: string | null;
}

/**
 * 발행 요청 본문.
 *
 * ⭐ **대상은 LOT 하나다** — LOT 당 한 장(스펙 §8-3). 계약은 1000 건까지 받지만 이 화면이
 * 한 번에 보내는 것은 고른 LOT 하나뿐이다.
 *
 * ⛔ **`targetTypeCode` 를 지어내지 않는다.** 값은 `codes.ts` 한 곳에 있고 계약 enum 이 닫았다.
 *
 * ⛔ **신규 발행에 재발행 사유를 싣지 않는다.** 서버는 회차 2 이상인 기록에만 이 값을 남기지만,
 * 보내는 쪽에서 섞으면 「무엇을 보냈는지」가 화면 기록과 어긋난다.
 */
export const buildIssueRequest = ({
  lotId,
  reissueReasonCode,
  printerName,
}: IssueRequestInput): DocumentIssueCreate => ({
  documentTypeCode: DOCUMENT_TYPE_CODE,
  targets: [{ targetTypeCode: DOCUMENT_TARGET_TYPE_CODE, targetId: lotId, lotId }],
  ...(reissueReasonCode === null ? {} : { reissueReasonCode }),
  ...(printerName === null ? {} : { printerName }),
});
