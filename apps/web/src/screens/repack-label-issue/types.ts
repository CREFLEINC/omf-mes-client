import type { components } from '@omf-mes/api-client';

/**
 * P-04-04 재구성 신규 라벨 발행 슬라이스의 계약.
 *
 * ## ⛔ 이 화면은 아직 반쪽이다
 *
 * 스펙은 네 구획(① 발행 대기 · ② 발번 · ③ 인쇄 대상 · ④ 프린터)을 그리는데, 여기 서 있는
 * 것은 **③·④ 와 발행·인쇄뿐**이다. ①·② 를 만들지 않은 것은 게을러서가 아니라 **계약이
 * 그것을 표현하지 못하기 때문**이다(`omf-mes#418`).
 *
 * - 새 포장은 이 화면이 만들기 전까지 취급 단위로 존재하지 않는다(`PUT …/contents` 설명이
 *   「신규 발번은 `POST /inventory/handling-units`(P-04-04)가 만든다」로 못박았다)
 * - 그런데 `HandlingUnitRepackEventLine.handlingUnitId` 가 **필수**라, 아직 만들지 않은 포장은
 *   이벤트 라인에 실릴 수 없다 ⇒ **「무엇을 몇 개 만들어야 하는가」를 알 수 없다**
 * - `HandlingUnitCreate` 에 `repackEventId` 가 없어 **「이미 처리한 건인가」도 판별할 수 없다**
 *
 * ⛔ **그 두 구획을 임시 구현으로 메우지 않는다.** 어떻게 조립해도 목록이 지워지지 않아
 * 같은 재구성을 반복 처리하게 된다.
 */
export type HandlingUnit = components['schemas']['HandlingUnit'];
export type HandlingUnitContent = components['schemas']['HandlingUnitContent'];
export type DocumentIssue = components['schemas']['DocumentIssue'];
export type DocumentIssueCreate = components['schemas']['DocumentIssueCreate'];
export type DocumentIssueBatchResult = components['schemas']['DocumentIssueBatchResponse'];
export type DocumentIssueSummary = components['schemas']['DocumentIssueSummary'];
export type CodeValue = components['schemas']['CodeValue'];
export type Printer = components['schemas']['Printer'];

/**
 * 이 화면이 찍는 출력물 — **포장 라벨 하나뿐**이다.
 *
 * 스펙 §4-B 가 문서 유형을 `PACKING_LABEL` 로 확정했다(2026-09-02 · 요구서 §3-8).
 */
export const DOCUMENT_TYPE_CODE = 'PACKING_LABEL';

/**
 * 발행 대상 유형 — **포장 단위**다(스펙 §4-B).
 *
 * ⭐ **LOT 이 아니다.** 한 포장에 LOT 이 여럿일 수 있어 라벨을 LOT 축으로 잡으면 한 상자에
 * 여러 장이 나온다. 같은 이유로 발행 요청의 `lotId` 를 **비운다**(스펙 §4-B 「대상 LOT ⛔ 비운다」).
 */
export const TARGET_TYPE_CODE = 'HANDLING_UNIT';

/**
 * 재발행 사유 값이 사는 공통코드 그룹.
 *
 * ⛔ **채번 식별자(`codeGroupId`)를 하드코딩하지 않는다** — 환경마다 다르다(계약 명시).
 */
export const REISSUE_REASON_GROUP_CODE = 'REISSUE_REASON';

/** 라벨은 이미지다. 성적서(`pdf`)는 이 화면의 출력물이 아니다. */
export const LABEL_RENDITION_FORMAT = 'png';

/**
 * 대상 포장의 내용물 한 줄.
 *
 * ⚠ **이름 셋이 각각 `null` 일 수 있다.** 내용물이 나르는 것은 내부 번호뿐이라 이름을 따로
 * 풀어야 하고, 그 조회가 늦거나 실패하면 그 칸만 빈다 — **번호로 메우지 않는다.**
 */
export interface PackingContentRow {
  handlingUnitContentId: number;
  lotId: number;
  itemId: number;
  qty: number;
  lotNo: string | null;
  itemCode: string | null;
  uomCode: string | null;
}

/** 한 포장에 담긴 LOT 수. 라벨은 포장 단위 한 장이지만, 몇 갈래가 들었는지는 보여야 한다. */
export const lotCount = (rows: readonly PackingContentRow[]): number =>
  new Set(rows.map((row) => row.lotId)).size;

/**
 * 이 포장의 발행 현황 — **회차를 화면이 세지 않는다**(스펙 §6 · 계약 「서버가 매긴다」).
 *
 * 화면이 이 값으로 정하는 것은 **「사유 칸을 요구할 것인가」 하나**다.
 */
export interface IssueStanding {
  /** 지금까지 발행된 횟수. 요약을 못 받았으면 `null` — 「모른다」와 「0」은 다르다 */
  issueCount: number | null;
  lastIssuedAt: string | null;
  lastPrintOutcome: DocumentIssueSummary['lastPrintOutcome'];
}

/**
 * 재발행 사유가 필요한가.
 *
 * ⛔ **모를 때는 요구하지 않는다.** 요약을 못 받은 채 사유를 강제하면 최초 발행조차 막히고,
 * 최초 기록에 사유가 붙으면 이력이 거짓이 된다(계약). 서버가 422 로 되돌리는 것이 정확한
 * 집행이고, 화면은 그 말을 사유 칸 아래에 놓는다.
 */
export const needsReason = (standing: IssueStanding): boolean =>
  standing.issueCount !== null && standing.issueCount > 0;
