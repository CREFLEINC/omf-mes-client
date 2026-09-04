import { DOCUMENT_TYPE_CODE, TARGET_TYPE_CODE, type DocumentIssueCreate } from './types';

export interface IssueBodyInput {
  handlingUnitId: number;
  /** 고른 프린터. 아직 없으면 빈 문자열 */
  printerName: string;
  /** 고른 재발행 사유. 아직 없으면 빈 문자열 */
  reasonCode: string;
  /** 이 발행이 재발행인가(발행 현황이 정한다) */
  reasonRequired: boolean;
}

/**
 * 발행 요청 본문 — **대상은 포장 하나**다(스펙 §4-B).
 *
 * ⛔ **`lotId` 를 싣지 않는다.** 한 포장에 LOT 이 여럿일 수 있어 스펙이 그 칸을 「⛔ 비운다」로
 * 못박았다(§4-B) — 아무 LOT 이나 골라 채우면 발행 이력이 그 LOT 의 것으로 굳고, 나중에 LOT
 * 축으로 이력을 모아 볼 때 없는 관계가 생긴다.
 *
 * ⛔ **최초 발행에 재발행 사유를 싣지 않는다.** 계약이 「서버는 회차가 2 이상인 기록에만 이
 * 값을 남긴다 — 신규 기록에 재발행 사유가 붙으면 이력이 거짓이 된다」고 적었다.
 *
 * ⚠ **회차를 싣지 않는다.** 서버가 매긴다(계약 · 스펙 §6).
 */
export const issueBody = ({
  handlingUnitId,
  printerName,
  reasonCode,
  reasonRequired,
}: IssueBodyInput): DocumentIssueCreate => ({
  documentTypeCode: DOCUMENT_TYPE_CODE,
  targets: [{ targetTypeCode: TARGET_TYPE_CODE, targetId: handlingUnitId }],
  ...(printerName === '' ? {} : { printerName }),
  ...(reasonRequired && reasonCode !== '' ? { reissueReasonCode: reasonCode } : {}),
});
