import type { components } from '@omf-mes/api-client';

import {
  DOCUMENT_TARGET_TYPE_CODE,
  DOCUMENT_TYPE_CODE,
  LOT_NUMBER_SOURCE_CODE,
  LOT_SOURCE_TYPE_CODE,
  LOT_TYPE_CODE,
} from './codes';
import type { TargetRow } from './types';

export type LotCreateBody = components['schemas']['LotCreate'];
export type DocumentIssueCreateBody = components['schemas']['DocumentIssueCreate'];
export type PrintOutcomeReportBody = components['schemas']['PrintOutcomeReport'];

/**
 * 보내는 본문을 만드는 **유일한 지점**이다.
 *
 * 화면 컴포넌트 안에서 본문을 조립하면 무엇을 보내는지 렌더 코드에 묻혀 보이지 않고,
 * 값 하나가 빠져도 테스트로 잡을 자리가 없다. 여기 있는 것은 전부 순수 함수다.
 */

/** 계약의 `date-time` 에서 날짜 조각만 뗀다. 이 화면이 소유한다. */
const toDateOnly = (occurredAt: string): string => occurredAt.slice(0, 10);

/**
 * LOT 등록 본문.
 *
 * ⭐ **원천 짝이 이 본문의 핵심이다** — `sourceTypeCode` 는 「입하 라인」을 뜻하는 값이고
 * `sourceId` 는 그 **라인** 식별자다(변경 통지 #664). 건 식별자를 넣으면 계보가 「이 전표
 * 어딘가에서 왔다」까지만 거슬러 가고, 한번 그렇게 쌓인 LOT 은 나중에 고치기 어렵다.
 *
 * ⛔ **`lotNo` 를 싣지 않는다.** 번호는 서버가 매긴다(`numberSourceCode = MES`) — 보내면 400 이다.
 *
 * ⛔ **보류를 화면이 걸지 않는다.** 자재 LOT 은 등록 즉시 검사 대기로 서버가 잡는다(MLOT #5).
 *
 * ⚠ **업무일자는 발생 시각에서 뗀다.** 야간조 경계 같은 산출 규칙이 정의돼 있지 않아 실행
 * 시각의 날짜를 그대로 쓰지 않고, **이 등록이 일어난 시각**의 날짜를 쓴다.
 */
export const toLotCreateBody = (row: TargetRow, occurredAt: string): LotCreateBody => ({
  numberSourceCode: LOT_NUMBER_SOURCE_CODE,
  itemId: row.itemId,
  lotTypeCode: LOT_TYPE_CODE,
  plantId: row.plantId,
  initialQty: row.receivedQty,
  uomId: row.uomId,
  sourceTypeCode: LOT_SOURCE_TYPE_CODE,
  sourceId: row.inboundReceiptLineId,
  businessDate: toDateOnly(occurredAt),
  occurredAt,
});

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
 * 발행 기록 본문.
 *
 * ⛔ **인쇄하지 않는다.** 이 호출은 기록만 만들고, 그린 것을 받아 보내는 것은 다음 걸음이다.
 * 프린터가 죽어도 기록은 남는다 — 그래야 「실제로는 안 나온 라벨」이 나온 것으로 남지 않는다.
 *
 * ⛔ **`terminalId` 를 싣지 않는다.** 계약에서 삭제됐다(변경 통지 #601 §1-2) — 단말은 서버가
 * 요청을 인증한 단말 토큰에서 푼다. ⚠ 없는 키를 보내도 서버가 오류를 내지 않을 수 있어,
 * 지우지 않으면 조용히 무시된 채 아무도 모른다.
 *
 * 대상은 **한 건**이다. 계약은 여러 건을 한 트랜잭션으로 받지만 이 화면은 고른 자재 하나를
 * 찍는다 — 「하나라도 실패하면 전건 실패」라는 계약 조항이 걸릴 자리가 없다.
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
