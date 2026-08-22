import { messages } from '@omf-mes/i18n';

import type { Concession, ConcessionListResponse } from './types';

export type ConcessionCardinality =
  { kind: 'none' } | { kind: 'one'; concessionId: number } | { kind: 'unsafe' };

export const toConcessionCardinality = (
  approvalRequestId: number,
  response: ConcessionListResponse,
): ConcessionCardinality => {
  if (response.page.total === 0 && response.items.length === 0) return { kind: 'none' };

  const candidate = response.items[0];
  if (
    response.page.total === 1 &&
    response.items.length === 1 &&
    candidate?.approvalRequestId === approvalRequestId
  ) {
    return { kind: 'one', concessionId: candidate.concessionId };
  }

  return { kind: 'unsafe' };
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
  concessionNo: string;
  approvedQty: string;
  consumedQty: string;
  uom: string;
  validity: string;
  statusCode: string;
  usable: string;
  remarks: string;
  workOrder: string;
  process: string;
  customer: string;
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
    concessionNo: nonBlank(source.concessionNo, t.concessionNoUnknown),
    approvedQty: String(source.approvedQty),
    consumedQty: String(source.consumedQty),
    uom: referenceText(references.uom),
    validity: `${source.validFrom} – ${source.validTo ?? t.openEnded}`,
    statusCode: nonBlank(source.statusCode, t.statusUnknown),
    usable,
    remarks:
      source.remarks === undefined || source.remarks.trim() === ''
        ? t.remarksEmpty
        : source.remarks,
    workOrder: restrictionText(source, 'allowedWorkOrderId', references.workOrder),
    process: restrictionText(source, 'allowedProcessId', references.process),
    customer: restrictionText(source, 'allowedCustomerId', references.customer),
  };
};
