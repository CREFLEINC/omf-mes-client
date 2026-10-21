import type { InboundExcess } from './excess-types';
import type { InboundScheduleLine } from './types';

/**
 * 고른 발주의 라인마다 **이을 수 있는 초과분 · 이미 이어진 초과분**을 가린다 — 상세 표가 그 줄에 잇기 길을 세운다.
 *
 * 서버의 후보 규칙(장부 P-100 `candidates`)을 화면이 **미리 짐작**하는 자리다. 정본은 서버다 — 잇기 창은
 * 언제나 서버 후보를 다시 받고, 여기서 맞다고 본 줄이 거기 없으면 그 줄을 고르지 않는다.
 *
 * | 조건 | 값 |
 * | --- | --- |
 * | 같은 것 | 공장 · 공급사 · 품목 · 단위 |
 * | 뺀다 | 초과분이 나온 줄 자신의 P/O 라인 · 취소된 라인 |
 * | 남은 자리 | `발주 + 초과 허용치 − 받은 수량 ≥ 초과분` |
 */

export const roomOf = (line: InboundScheduleLine): number =>
  line.orderedQty + line.toleranceOverQty - line.receivedQty;

export const canTakeExcess = (line: InboundScheduleLine, excess: InboundExcess): boolean =>
  line.cancelledAt === null &&
  line.receiptStatusCode !== 'CANCELLED' &&
  excess.plantId === line.plantId &&
  excess.supplierId === line.supplierId &&
  excess.itemId === line.itemId &&
  excess.uomId === line.uomId &&
  excess.sourceOrderLine?.purchaseOrderLineId !== line.purchaseOrderLineId &&
  roomOf(line) >= excess.excessQty;

export interface LineExcesses {
  /** 이 줄에 이을 수 있는 안 이은 초과분. */
  linkable: InboundExcess[];
  /** 이 줄에 이미 이어진 초과분. */
  linked: InboundExcess[];
}

const NONE: LineExcesses = { linkable: [], linked: [] };

/** 라인 번호 → 그 줄의 초과분. 둘 다 없는 줄은 담지 않는다. */
export const excessesByLine = (
  lines: readonly InboundScheduleLine[],
  unlinked: readonly InboundExcess[],
  linked: readonly InboundExcess[],
): Map<number, LineExcesses> => {
  const result = new Map<number, LineExcesses>();

  for (const line of lines) {
    const entry: LineExcesses = {
      linkable: unlinked.filter((excess) => canTakeExcess(line, excess)),
      linked: linked.filter(
        (excess) => excess.linkedOrderLine?.purchaseOrderLineId === line.purchaseOrderLineId,
      ),
    };
    if (entry.linkable.length > 0 || entry.linked.length > 0) {
      result.set(line.purchaseOrderLineId, entry);
    }
  }

  return result;
};

export const lineExcessesOf = (
  map: ReadonlyMap<number, LineExcesses>,
  purchaseOrderLineId: number,
): LineExcesses => map.get(purchaseOrderLineId) ?? NONE;
