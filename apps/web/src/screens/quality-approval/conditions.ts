import { messages } from '@omf-mes/i18n';

import type { Concession, ConcessionListResponse } from './types';

/**
 * 결재 하나에 걸린 특채 조건. 005 다LOT 전량 특채(US4-4 · 계약 §10)는 같은 결재 · 같은 부적합의 자재 관리 LOT 마다 한 행이라,
 * 그 묶음도 조건 하나로 본다(`bundle` — 행 2개 이상일 때만). 보이는 조건은 첫 행의 것이고(묶음은 같은 조건으로 만든다), 적용은
 * 어느 행으로 불러도 묶음 전부가 적용된다(계약 `:apply`).
 */
export type ConcessionCardinality =
  | { kind: 'none' }
  | {
      kind: 'one';
      concessionId: number;
      bundle?: { lotCount: number; approvedQty: number; consumedQty: number };
    }
  | { kind: 'unsafe' };

export const toConcessionCardinality = (
  approvalRequestId: number,
  response: ConcessionListResponse,
): ConcessionCardinality => {
  if (response.page.total === 0 && response.items.length === 0) return { kind: 'none' };

  const items = response.items;
  const candidate = items[0];
  if (
    candidate === undefined ||
    response.page.total !== items.length ||
    items.some((item) => item.approvalRequestId !== approvalRequestId)
  ) {
    return { kind: 'unsafe' };
  }
  if (items.length === 1) return { kind: 'one', concessionId: candidate.concessionId };

  /* 묶음 — 같은 부적합이고 LOT 이 서로 다를 때만(같은 LOT 이 두 번이면 중복이라 특정하지 않는다 · G2 H2). */
  const sameNonconformance = items.every(
    (item) => item.nonconformanceId === candidate.nonconformanceId,
  );
  const distinctLots = new Set(items.map((item) => item.lotId)).size === items.length;
  if (!sameNonconformance || !distinctLots) return { kind: 'unsafe' };

  return {
    kind: 'one',
    concessionId: candidate.concessionId,
    bundle: {
      lotCount: items.length,
      approvedQty: items.reduce((sum, item) => sum + item.approvedQty, 0),
      consumedQty: items.reduce((sum, item) => sum + item.consumedQty, 0),
    },
  };
};

export type ConditionReferenceState =
  | { kind: 'named'; name: string }
  | { kind: 'loading' }
  | { kind: 'failed' }
  | { kind: 'unknown' }
  | { kind: 'truncated' };

export interface ConditionReferenceStates {
  uom: ConditionReferenceState;
  workOrder: ConditionReferenceState;
  process: ConditionReferenceState;
  customer: ConditionReferenceState;
}

export interface ExactReferenceSource {
  name: string | undefined;
  isError: boolean;
  isLoading: boolean;
}

export interface ListReferenceSource {
  entries: ReadonlyArray<{ id: number; name: string }>;
  total: number;
  isError: boolean;
  isLoading: boolean;
}

export const toExactReference = (source: ExactReferenceSource): ConditionReferenceState => {
  if (source.isError) return { kind: 'failed' };
  if (source.isLoading) return { kind: 'loading' };
  if (source.name === undefined || source.name.trim() === '') return { kind: 'unknown' };

  return { kind: 'named', name: source.name };
};

export const toListReference = (
  source: ListReferenceSource,
  targetId: number | null | undefined,
): ConditionReferenceState => {
  if (source.isError) return { kind: 'failed' };
  if (source.isLoading) return { kind: 'loading' };
  if (targetId === null || targetId === undefined) return { kind: 'unknown' };

  const matched = source.entries.find(({ id }) => id === targetId);
  if (matched !== undefined) {
    return matched.name.trim() === '' ? { kind: 'unknown' } : { kind: 'named', name: matched.name };
  }

  return source.total > source.entries.length ? { kind: 'truncated' } : { kind: 'unknown' };
};

export const UNKNOWN_CONDITION_REFERENCES: ConditionReferenceStates = {
  uom: { kind: 'unknown' },
  workOrder: { kind: 'unknown' },
  process: { kind: 'unknown' },
  customer: { kind: 'unknown' },
};

export interface ConcessionCardView {
  nonconformanceNo: string;
  concessionNo: string;
  approvedQty: string;
  consumedQty: string;
  /** 승인 수량 − 사용 수량(#193 수량 요약). 계약에 칸이 없어 화면이 뺀다 — 음수면 0 이다. */
  remainingQty: string;
  uom: string;
  validity: string;
  usable: string;
  remarks: string;
  workOrder: string;
  process: string;
  customer: string;
  /** 작업지시 · 공정 · 고객 셋 다 제한이 없는가 — 그러면 적용 제한을 한 줄로 줄인다(#193). */
  isUnrestricted: boolean;
}

const nonBlank = (value: string, fallback: string): string =>
  value.trim() === '' ? fallback : value;

const referenceText = (state: ConditionReferenceState): string => {
  const t = messages.qualityApproval.condition.reference;
  if (state.kind === 'named') return nonBlank(state.name, t.unknown);
  return t[state.kind];
};

type RestrictionAxis = 'allowedWorkOrderId' | 'allowedProcessId' | 'allowedCustomerId';

const restrictionText = (
  source: Concession,
  axis: RestrictionAxis,
  reference: ConditionReferenceState,
): string =>
  source[axis] === undefined || source[axis] === null
    ? messages.qualityApproval.condition.unrestricted
    : referenceText(reference);

export const toConcessionCardView = (
  source: Concession,
  references: ConditionReferenceStates,
): ConcessionCardView => {
  const t = messages.qualityApproval.condition;
  const usable =
    source.usable === true ? t.usable : source.usable === false ? t.unusable : t.usableUnknown;

  return {
    /* ⚠ 번호는 계약에서 선택 항목이다 — 없으면 그 사실을 적는다(§5-3 「모르는 값 ≠ 없는 값」). */
    nonconformanceNo: nonBlank(source.nonconformanceNo ?? '', t.nonconformanceNoUnknown),
    concessionNo: nonBlank(source.concessionNo, t.concessionNoUnknown),
    approvedQty: String(source.approvedQty),
    consumedQty: String(source.consumedQty),
    remainingQty: String(Math.max(0, source.approvedQty - source.consumedQty)),
    uom: referenceText(references.uom),
    validity: `${source.validFrom} ~ ${source.validTo ?? t.openEnded}`,
    usable,
    remarks:
      source.remarks === undefined || source.remarks.trim() === ''
        ? t.remarksEmpty
        : source.remarks,
    workOrder: restrictionText(source, 'allowedWorkOrderId', references.workOrder),
    process: restrictionText(source, 'allowedProcessId', references.process),
    customer: restrictionText(source, 'allowedCustomerId', references.customer),
    isUnrestricted: (
      ['allowedWorkOrderId', 'allowedProcessId', 'allowedCustomerId'] as const
    ).every((axis) => source[axis] === undefined || source[axis] === null),
  };
};
