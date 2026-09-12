import type { components } from '@omf-mes/api-client';

import {
  labelRenditionFormat,
  type LabelRenditionFormat,
} from '../../patterns/pop-label-rendition';
export type HandlingUnit = components['schemas']['HandlingUnit'];
export type HandlingUnitContent = components['schemas']['HandlingUnitContent'];
export type HandlingUnitRepackEvent = components['schemas']['HandlingUnitRepackEvent'];
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

/**
 * 포장 유형 값이 사는 공통코드 그룹.
 *
 * ⛔ **코드를 그대로 세우지 않는다**(#1045) — 《대상 포장》의 유형 칸에 `BOX` 가 서 있었다.
 * 같은 값을 다른 화면은 「박스」로 쓴다.
 */
export const HANDLING_UNIT_TYPE_GROUP_CODE = 'HANDLING_UNIT_TYPE';

/** 물리 인쇄 실패 뒤에는 같은 기록을 다시 보내지 않고 새 회차를 발행한다(K-7). */
export const PRINT_FAILURE_REASON_CODE = 'PRINT_FAILURE';

/** 라벨은 이미지다. 성적서(`pdf`)는 이 화면의 출력물이 아니다. */
/**
 * 라벨 형식. **셸이 있으면 명령형(`tspl`)** 으로 받아 프린터가 자기 글꼴로 찍게 한다 —
 * 그림으로 받으면 드라이버가 픽셀로 그려, 명령으로 뽑은 라벨과 다른 물건으로 보인다
 * (`patterns/pop-label-rendition` 머리말 · 사용자 지시 2026-09-08).
 */

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

/** 분할 뒤 원 번호를 유지한 포장. 사용자가 라벨 재출력 여부를 고른다(§5-2·§5-3). */
export interface RemainderCandidate {
  handlingUnit: HandlingUnit;
  standing: IssueStanding;
}

/**
 * 재발행 사유가 필요한가.
 *
 * ⛔ **모를 때는 이 함수가 추측하지 않는다.** 요약을 못 받은 채 사유를 강제하면 최초 기록에
 * 사유가 붙어 이력이 거짓이 된다. 호출 화면이 발행 자체를 막고 요약 재시도를 제공한다.
 */
export const needsReason = (standing: IssueStanding): boolean =>
  standing.issueCount !== null && standing.issueCount > 0;
