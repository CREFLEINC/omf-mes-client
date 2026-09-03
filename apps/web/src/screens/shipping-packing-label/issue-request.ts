import type { components } from '@omf-mes/api-client';

import { targetTypeCodeOf, type LabelKind } from './codes';
import type { TargetRow } from './types';

export type DocumentIssueCreateBody = components['schemas']['DocumentIssueCreate'];
export type PrintOutcomeReportBody = components['schemas']['PrintOutcomeReport'];

/**
 * 보내는 본문을 만드는 **유일한 지점**이다.
 *
 * 화면 컴포넌트 안에서 본문을 조립하면 무엇을 보내는지 렌더 코드에 묻혀 보이지 않고, 값
 * 하나가 빠져도 테스트로 잡을 자리가 없다. 여기 있는 것은 전부 순수 함수다.
 */

export interface DocumentIssueInput {
  kind: LabelKind;
  /** 고른 대상들. **한 트랜잭션이다** — 하나라도 실패하면 전건 실패다(계약 명시). */
  rows: readonly TargetRow[];
  /** 고른 프린터. 고르지 않았으면 서버 기본값에 맡긴다. */
  printerName: string | null;
  /** 재발행일 때만 채운다. 신규 기록에 사유가 붙으면 이력이 거짓이 된다. */
  reissueReasonCode: string | null;
}

/**
 * 발행 기록 본문.
 *
 * ⛔ **인쇄하지 않는다.** 이 호출은 기록만 만들고, 그린 것을 받아 보내는 것은 다음 걸음이다.
 * 프린터가 죽어도 기록은 남는다 — 그래야 「실제로는 안 나온 라벨」이 나온 것으로 남지 않는다
 * (공유계약 K-4 · 스펙 §5-5).
 *
 * ⛔ **회차를 싣지 않는다.** 서버가 매긴다 — 같은 대상을 다른 단말에서도 찍으므로 화면이
 * 센 값은 곧 틀린다(스펙 §5-4).
 *
 * ⛔ **`terminalId` 를 싣지 않는다.** 단말은 서버가 요청을 인증한 단말 토큰에서 푼다
 * (계약 명시). 없는 키를 보내도 서버가 조용히 무시할 수 있어, 지우지 않으면 아무도 모른다.
 *
 * ⚠ **재발행 사유는 «한 번만» 받는다.** 신규와 재발행이 섞여 들어와도 서버는 회차가 2 이상인
 * 기록에만 그 값을 남긴다(계약 명시) — 화면이 대상마다 나눠 보내지 않는다.
 *
 * ⚠ **포장 라벨은 `lotId` 를 비운다.** 한 포장에 여러 LOT 이 섞여 하나로 정할 수 없다
 * (스펙 §5-3 · 공유계약 A-21). 비우는 것이 결손이 아니라 결정이다.
 */
export const toDocumentIssueBody = ({
  kind,
  rows,
  printerName,
  reissueReasonCode,
}: DocumentIssueInput): DocumentIssueCreateBody => ({
  documentTypeCode: kind,
  /*
   * ⛔ **같은 대상을 두 번 싣지 않는다.** 목록 줄은 배분인데 서버로 나가는 것은 LOT 이라
   * (`issueTargetId`), 한 LOT 이 여러 배분으로 갈린 출하에서는 **줄 둘이 같은 대상**이 된다.
   * 그대로 보내면 한 트랜잭션에 같은 대상이 두 번 실려 회차가 한 번에 두 번 오르거나
   * `uq_document_issue_log` 에 걸려 **전건 실패**한다 — 고를 수 있었던 대상까지 못 나간다.
   * 발행 취소 경로가 없어 어느 쪽도 되돌릴 수 없다.
   */
  targets: [...new Map(rows.map((row) => [row.issueTargetId, row])).values()].map((row) => ({
    targetTypeCode: targetTypeCodeOf(kind),
    targetId: row.issueTargetId,
    ...(row.lotId === null ? {} : { lotId: row.lotId }),
  })),
  ...(reissueReasonCode === null ? {} : { reissueReasonCode }),
  ...(printerName === null ? {} : { printerName }),
});

/**
 * 인쇄 결과 보고 본문.
 *
 * ⛔ **실패를 삼키지 않는다.** 보고하지 않으면 발행 기록이 곧 인쇄 성공으로 읽혀, 나오지
 * 않은 라벨이 나온 것으로 남는다. 실패는 되돌리지 않고 **재발행**으로 처리한다 — 그 재발행의
 * 사유가 「인쇄 실패」다(스펙 §5-5).
 *
 * ⚠ `FAILED` 인데 사유가 없으면 422 다 — 사유를 반드시 함께 싣는다.
 */
export const toPrintReportBody = (failureReason: string | null): PrintOutcomeReportBody =>
  failureReason === null ? { outcome: 'SUCCEEDED' } : { outcome: 'FAILED', failureReason };
