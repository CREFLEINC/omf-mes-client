import type { UnallocatedLine } from './excess-types';
import { exactQty } from './qty';
import type { InboundScheduleLine } from './types';

/**
 * 고른 발주의 라인마다 **연결할 수 있는 초과분**을 가린다 — 상세 표가 그 줄에 연결 단추를 세운다.
 *
 * 서버의 후보 규칙(장부 P-115 `allocation-candidates`)을 화면이 **미리 짐작**하는 자리다. 정본은 서버다 — 연결 창은
 * 언제나 서버 후보를 다시 받고, 여기서 맞다고 본 줄이 거기 없으면 그 줄을 고르지 않는다.
 *
 * | 조건 | 값 |
 * | --- | --- |
 * | 같은 것 | 공장 · 공급사 · 품목 · 단위 |
 * | 뺀다 | 취소된 라인 |
 * | 남은 자리 | `발주 + 초과 허용치 − 받은 수량 ≥ 초과분` |
 *
 * 초과분이 나온 줄 자신의 P/O 라인도 빼지 않는다 — ERP 가 원래 P/O 수량을 늘려 주면 그 라인에 잇는다(서버와 같다).
 * 늘기 전에는 남은 자리가 없어 저절로 빠진다.
 */

export const roomOf = (line: InboundScheduleLine): number =>
  exactQty((to) => to(line.orderedQty) + to(line.toleranceOverQty) - to(line.receivedQty));

export const canTakeExcess = (line: InboundScheduleLine, excess: UnallocatedLine): boolean =>
  line.cancelledAt === null &&
  line.receiptStatusCode !== 'CANCELLED' &&
  excess.plantId === line.plantId &&
  excess.supplierId === line.supplierId &&
  excess.itemId === line.itemId &&
  excess.uomId === line.uomId &&
  roomOf(line) >= excess.unallocatedQty;

const NONE: readonly UnallocatedLine[] = [];

/** 라인 번호 → 그 줄에 연결할 수 있는 초과분. 없는 라인은 담지 않는다. */
export const excessesByLine = (
  lines: readonly InboundScheduleLine[],
  excesses: readonly UnallocatedLine[],
): Map<number, readonly UnallocatedLine[]> => {
  const result = new Map<number, readonly UnallocatedLine[]>();

  for (const line of lines) {
    const linkable = excesses.filter((excess) => canTakeExcess(line, excess));
    if (linkable.length > 0) result.set(line.purchaseOrderLineId, linkable);
  }

  return result;
};

export const lineExcessesOf = (
  map: ReadonlyMap<number, readonly UnallocatedLine[]>,
  purchaseOrderLineId: number,
): readonly UnallocatedLine[] => map.get(purchaseOrderLineId) ?? NONE;
