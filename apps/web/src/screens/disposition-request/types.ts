import type { components, paths } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';

import { stageOf, type Stage } from './codes';

/**
 * W-04-07 화면 슬라이스의 계약.
 *
 * ⭐ 이 화면은 계약 두 벌을 부른다 — 진입 목록·부적합 등록·의뢰는 **제품출하(04)**, 처분 목록은
 * **품질(03)**이다. 경로 앞머리가 `/quality/**`로 같아 한 계약처럼 보이지만 정본 파일이 다르다
 * (공유계약 B-13 — 부적합은 04 소유, 처분 결정은 03 소유).
 *
 * 이 파일은 이 화면이 소유한다. 다른 화면 슬라이스의 같은 이름 파일을 참조하지 않는다.
 */
export type DispositionCandidate = components['schemas']['DispositionCandidate'];
export type Nonconformance = components['schemas']['Nonconformance'];
export type NonconformanceLot = components['schemas']['NonconformanceLot'];
export type NonconformanceCreate = components['schemas']['NonconformanceCreate'];
export type DispositionRequest = components['schemas']['DispositionRequest'];
export type DispositionDecision = components['schemas']['DispositionDecision'];
export type PageMeta = components['schemas']['PageMeta'];

export type CandidateListResponse =
  paths['/quality/disposition-candidates']['get']['responses']['200']['content']['application/json'];
export type NonconformanceListResponse =
  paths['/quality/nonconformances']['get']['responses']['200']['content']['application/json'];
export type DecisionListResponse =
  paths['/quality/disposition-decisions']['get']['responses']['200']['content']['application/json'];

const quantityFormat = new Intl.NumberFormat('ko-KR', { maximumFractionDigits: 6 });

/** RFC 3339 앞부분만 자른다 — `Date`로 파싱하면 실행 환경 시간대가 서버 벽시계를 옮긴다. */
const DATE_TIME_PATTERN = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/i;
const DATE_PATTERN = /^(\d{4}-\d{2}-\d{2})/;

export const formatQty = (value: number | null | undefined): string =>
  value === null || value === undefined || !Number.isFinite(value)
    ? messages.dispositionRequest.values.unknownQty
    : quantityFormat.format(value);

export const formatDateTime = (value: string): string => {
  const matched = DATE_TIME_PATTERN.exec(value);
  return matched === null ? value : `${matched[1] ?? ''} ${matched[2] ?? ''}`;
};

export const formatDate = (value: string | null | undefined): string => {
  if (value === null || value === undefined || value === '') {
    return messages.dispositionRequest.values.notAvailable;
  }
  const matched = DATE_PATTERN.exec(value);
  return matched === null ? value : (matched[1] ?? value);
};

/**
 * 진입 목록의 한 줄 — **두 소스를 한 모양으로 접는다.**
 *
 * 「전체」·「부적합 없음」은 판정 대상 목록(LOT 단위)에서, 「의뢰 전·판정 대기·판정 완료」는
 * 부적합 목록(부적합 단위)에서 온다(요구서 §3-7 첫째·둘째 행). 화면은 두 모양을 따로 그리지 않는다 —
 * 어느 쪽이든 「무엇을 골라 무엇을 할 수 있는가」가 같아야 사용자가 소스를 의식하지 않는다.
 */
export interface TargetRow {
  /** 목록 안 유일 키. 두 소스가 섞이지 않으므로 소스별 식별자로 충분하다 */
  key: string;
  /** 부적합을 만들 수 있는 LOT. 부적합이 여러 LOT에 걸치면 `null` — 이 화면은 LOT 하나만 등록한다 */
  lotId: number | null;
  lotNo: string;
  itemId: number;
  itemText: string;
  quantity: number | null;
  qtyText: string;
  uomId: number;
  warehouseId: number | null;
  warehouseName: string | null;
  sourceCode: DispositionCandidate['sourceCode'];
  receiptNo: string | null;
  receivedAtText: string | null;
  partnerName: string | null;
  inspectionResultId: number | null;
  nonconformanceId: number | null;
  nonconformanceNo: string | null;
  /** 단계 — 모르는 상태 코드면 `null`이고 `stageCodeText`가 코드를 그대로 든다(G-9) */
  stage: Stage | null;
  stageCodeText: string;
}

const itemTextOf = (code: string | null | undefined, name: string | null | undefined): string => {
  const parts = [code, name].filter((part): part is string => part !== null && part !== undefined);
  return parts.length === 0 ? messages.dispositionRequest.values.notAvailable : parts.join(' · ');
};

export const toCandidateRow = (candidate: DispositionCandidate): TargetRow => {
  const stage = stageOf(candidate.nonconformanceStatusCode);

  return {
    key: `lot:${String(candidate.lotId)}`,
    lotId: candidate.lotId,
    lotNo: candidate.lotNo,
    itemId: candidate.itemId,
    itemText: itemTextOf(candidate.itemCode, candidate.itemName),
    quantity: candidate.quantity,
    qtyText: formatQty(candidate.quantity),
    uomId: candidate.uomId,
    warehouseId: candidate.warehouseId,
    warehouseName: candidate.warehouseName ?? null,
    sourceCode: candidate.sourceCode,
    receiptNo: candidate.receiptNo ?? null,
    receivedAtText:
      candidate.receivedAt === null || candidate.receivedAt === undefined
        ? null
        : formatDate(candidate.receivedAt),
    partnerName: candidate.partnerName ?? null,
    inspectionResultId: candidate.inspectionResultId ?? null,
    nonconformanceId: candidate.nonconformanceId ?? null,
    nonconformanceNo: candidate.nonconformanceNo ?? null,
    stage,
    stageCodeText: candidate.nonconformanceStatusCode ?? '',
  };
};

/**
 * 부적합 한 건을 같은 줄 모양으로. LOT이 하나면 그 LOT을, 여럿이면 «LOT n건»으로 적고 `lotId`는
 * 비운다 — 이 화면의 등록은 LOT 하나 단위라(§8-6 판정 ①) 여러 LOT 부적합에는 새로 등록할 것이 없다.
 */
export const toNonconformanceRow = (nonconformance: Nonconformance): TargetRow => {
  const [first] = nonconformance.lots;
  const single = nonconformance.lots.length === 1 ? first : undefined;
  const stage = stageOf(nonconformance.statusCode);

  return {
    key: `nc:${String(nonconformance.nonconformanceId)}`,
    lotId: single?.lotId ?? null,
    lotNo:
      single?.lotNo ??
      (nonconformance.lots.length === 0
        ? messages.dispositionRequest.values.notAvailable
        : messages.dispositionRequest.target.lotCount(nonconformance.lots.length)),
    itemId: nonconformance.itemId,
    itemText: messages.dispositionRequest.values.notAvailable,
    quantity: nonconformance.affectedQtyTotal,
    qtyText: formatQty(nonconformance.affectedQtyTotal),
    uomId: nonconformance.uomId,
    warehouseId: null,
    warehouseName: null,
    sourceCode: nonconformance.sourceCode,
    receiptNo: null,
    receivedAtText: null,
    partnerName: null,
    inspectionResultId: nonconformance.inspectionResultId ?? null,
    nonconformanceId: nonconformance.nonconformanceId,
    nonconformanceNo: nonconformance.nonconformanceNo,
    stage,
    stageCodeText: nonconformance.statusCode,
  };
};

export interface DecisionRow {
  dispositionDecisionId: number;
  dispositionTypeCode: DispositionDecision['dispositionTypeCode'];
  qtyText: string;
  uomId: number;
  reason: string;
  decidedAtText: string;
  hasApproval: boolean;
}

export const toDecisionRow = (decision: DispositionDecision): DecisionRow => ({
  dispositionDecisionId: decision.dispositionDecisionId,
  dispositionTypeCode: decision.dispositionTypeCode,
  qtyText: formatQty(decision.decisionQty),
  uomId: decision.uomId,
  reason: decision.reason,
  decidedAtText: formatDateTime(decision.decidedAt),
  hasApproval: decision.approvalRequestId !== null && decision.approvalRequestId !== undefined,
});
