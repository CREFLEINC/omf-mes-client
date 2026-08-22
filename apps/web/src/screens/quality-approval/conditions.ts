import type { ConcessionListResponse } from './types';

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
