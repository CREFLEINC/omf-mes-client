import type { ApiError, components } from '@omf-mes/api-client';

import type { Lot } from '../../patterns/lots';

export type ShipmentRequest = components['schemas']['ShipmentRequest'];
export type ShipmentRequestLine = components['schemas']['ShipmentRequestLine'];
export type ShipmentLinePick = components['schemas']['ShipmentLinePick'];

/**
 * 선출 정책. 품목 마스터가 품목마다 갖는다.
 *
 * 값으로 분기하는 것은 정렬 축 하나뿐이고, 모르는 값이 오면 정렬을 세우지 않고 그 사실을
 * 말한다. 값 목록이 아직 확정 전이라 아는 둘만 다루고 나머지를 통과로 두지 않는다.
 */
export const FEFO = 'FEFO';
export const FIFO = 'FIFO';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export interface Candidate {
  lot: Lot;
  availableQty: number;
  held: boolean;
}

/** 오늘부터 유효기간까지 남은 날. 유효기간이 없으면 셀 수 없다. */
export const remainingDays = (lot: Lot, today: Date): number | null => {
  if (lot.expiryDate === null || lot.expiryDate === undefined) {
    return null;
  }

  const expiry = Date.parse(lot.expiryDate);

  if (Number.isNaN(expiry)) {
    return null;
  }

  return Math.floor((expiry - today.getTime()) / MS_PER_DAY);
};

/**
 * 이 정책이 무엇으로 줄을 세우는가.
 *
 * FEFO 는 유효기간, FIFO 는 제조 시각이다. 모르는 정책이면 세울 축이 없다.
 */
export const sortFieldOf = (policy: string): 'expiryDate' | 'manufacturedAt' | null => {
  if (policy === FEFO) {
    return 'expiryDate';
  }

  return policy === FIFO ? 'manufacturedAt' : null;
};

export interface Ranked {
  /** 정책이 정한 순서대로. 앞엣것이 권장 1순위다. */
  ordered: Candidate[];
  /** 정렬 축의 값이 없어 어디에 놓을지 정해지지 않는 것. 섞지 않고 뒤에 따로 둔다. */
  unordered: Candidate[];
}

/**
 * 권장 순서를 세운다.
 *
 * 축의 값이 없는 줄을 섞으면 잘못된 순서를 권장으로 내놓고, 빼면 재고가 사라진 것처럼
 * 보인다. 뒤에 따로 두고 순서를 정할 수 없다고 적는다.
 */
export const rankCandidates = (candidates: Candidate[], policy: string): Ranked => {
  const field = sortFieldOf(policy);

  if (field === null) {
    return { ordered: [], unordered: [...candidates] };
  }

  const ordered: Candidate[] = [];
  const unordered: Candidate[] = [];

  for (const candidate of candidates) {
    const value = candidate.lot[field];

    if (value === null || value === undefined || value === '') {
      unordered.push(candidate);
    } else {
      ordered.push(candidate);
    }
  }

  ordered.sort((left, right) => String(left.lot[field]).localeCompare(String(right.lot[field])));

  return { ordered, unordered };
};

/** 배정 중 아직 집지 않은 몫. 서버가 누적 피킹을 유지하므로 화면은 빼기만 한다. */
export const remainingAllocated = (line: ShipmentRequestLine): number =>
  line.allocatedQty - line.pickedQty;

export type LotProblem = 'held' | 'noAvailable' | 'shelfLifeShort' | 'otherItem';

/**
 * 이 LOT 을 집을 수 없게 하는 것이 있는가.
 *
 * 잔여 유효기간은 구조화된 값이라 판정한다. 고객 LOT 요구 문장은 판정하지 않는다 - 자유
 * 텍스트라 못 알아들은 조건을 조용히 통과시키게 되고, 그것은 잘못된 LOT 이 나가는 것보다
 * 나쁘다. 무시했다는 사실조차 남지 않기 때문이다.
 */
export const lotProblem = (
  candidate: Candidate,
  line: ShipmentRequestLine,
  today: Date,
): LotProblem | null => {
  if (candidate.lot.itemId !== line.itemId) {
    return 'otherItem';
  }

  if (candidate.held) {
    return 'held';
  }

  if (candidate.availableQty <= 0) {
    return 'noAvailable';
  }

  const minimum = line.minimumRemainingShelfLifeDays;

  if (minimum === null || minimum === undefined) {
    return null;
  }

  const remaining = remainingDays(candidate.lot, today);

  /*
   * 셀 수 없는 것을 넉넉한 것으로 두지 않는다. 막지도 않는다 - 판정의 정본은 서버이고,
   * 화면이 막으면 서버가 통과시킬 LOT 을 현장이 집지 못한다. 셀 수 없다는 사실을 말한다.
   */
  if (remaining === null) {
    return null;
  }

  return remaining < minimum ? 'shelfLifeShort' : null;
};

/** 잔여 유효기간을 셀 수 없는 채로 하한이 걸려 있는가. */
export const isShelfLifeUnknown = (
  candidate: Candidate,
  line: ShipmentRequestLine,
  today: Date,
): boolean =>
  line.minimumRemainingShelfLifeDays !== null &&
  line.minimumRemainingShelfLifeDays !== undefined &&
  remainingDays(candidate.lot, today) === null;

export type QtyProblem = 'empty' | 'notNumber' | 'notPositive' | 'overAvailable' | 'overAllocated';

export const qtyProblem = (
  candidate: Candidate,
  line: ShipmentRequestLine,
  text: string,
): QtyProblem | null => {
  const trimmed = text.trim();

  if (trimmed === '') {
    return 'empty';
  }

  const value = Number(trimmed);

  if (!Number.isFinite(value)) {
    return 'notNumber';
  }

  if (value <= 0) {
    return 'notPositive';
  }

  if (value > candidate.availableQty) {
    return 'overAvailable';
  }

  return value > remainingAllocated(line) ? 'overAllocated' : null;
};

/**
 * 권장 1순위인가.
 *
 * 아니어도 막지 않는다. 권장은 순서 제안이지 위치가 아니라, 다른 것을 집어도 물건은 맞다.
 * 사유도 묻지 않는다.
 */
export const isRecommended = (ranked: Ranked, lotId: number): boolean =>
  ranked.ordered[0]?.lot.lotId === lotId;

export const canPick = (
  candidate: Candidate | null,
  line: ShipmentRequestLine | null,
  qty: string,
  hasWorker: boolean,
  today: Date,
): boolean => {
  if (candidate === null || line === null || !hasWorker) {
    return false;
  }

  return lotProblem(candidate, line, today) === null && qtyProblem(candidate, line, qty) === null;
};

export const toPickBody = (
  candidate: Candidate,
  line: ShipmentRequestLine,
  qty: string,
): ShipmentLinePick => ({
  lotId: candidate.lot.lotId,
  pickedQty: Number(qty.trim()),
  /* 단위는 라인의 것을 그대로 옮긴다. 화면이 고르게 두면 배정과 피킹이 다른 단위로 남는다. */
  uomId: line.uomId,
});

/**
 * 서버가 되돌린 것이 집을 수 없는 상태로 바뀌었다는 뜻인가.
 *
 * 보류가 걸렸거나 가용이 모자라거나 배정을 넘었다는 판정이고, 다시 눌러서 풀리지 않는다.
 * 일반 실패와 같은 말을 쓰면 현장이 같은 확정을 되풀이한다.
 */
export const isConflict = (error: ApiError): boolean =>
  error.kind === 'conflict' || (error.kind === 'http' && error.status === 409);
