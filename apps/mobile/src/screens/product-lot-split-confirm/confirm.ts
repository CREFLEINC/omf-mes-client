import type { ApiError } from '@omf-mes/api-client';

import type { ProductLotSplit } from './queries';

/**
 * M-04-05 판정 — 화면에서 떼어 시험한다.
 */

export type SplitRole = 'parent' | 'child';

/** 스캔한 번호가 이 분리의 어느 쪽인가. 둘 다 아니면 null(짝이 아닌 라벨). */
export const roleOf = (split: ProductLotSplit, lotNo: string): SplitRole | null =>
  split.parentLot.lotNo === lotNo ? 'parent' : split.childLot.lotNo === lotNo ? 'child' : null;

export const lotOf = (split: ProductLotSplit, role: SplitRole) =>
  role === 'parent' ? split.parentLot : split.childLot;

export const otherRole = (role: SplitRole): SplitRole => (role === 'parent' ? 'child' : 'parent');

export type ConfirmFailure = 'already' | 'wrong' | 'offline' | 'failed';

/**
 * 확인 요청의 거절을 가른다 — 409 ALREADY_CONFIRMED(다른 PDA 가 먼저) · 400 INVALID(짝 아님) · 연결 끊김.
 */
export const confirmFailureOf = (error: ApiError): ConfirmFailure => {
  if (error.kind === 'network') return 'offline';
  if ((error.kind === 'conflict' || error.kind === 'http') && error.code === 'ALREADY_CONFIRMED') {
    return 'already';
  }
  if (error.kind === 'validation' && error.errors.some((item) => item.code === 'INVALID')) {
    return 'wrong';
  }

  return 'failed';
};
