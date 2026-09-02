import { messages } from '@omf-mes/i18n';

import type { PackedLine, ShipmentLotAllocation } from './types';

/**
 * 포장 구성의 순수 로직 — **담기·합치기·잔여 판정**.
 *
 * 여기 있는 것은 전부 「틀려도 조용한 계산」이다. 화면은 멀쩡히 그려지는데 값만 틀리면
 * 되돌릴 수 없는 기록에 그대로 실린다. 그래서 판정을 렌더에서 떼어 이 파일에 모은다.
 *
 * ⛔ **배분 잔여를 화면이 빼서 만들지 않는다.** `allocatedQty − packedQty` 는 서버가 파생하는
 * 값이고(공유계약 L-2), 화면은 응답의 두 칸을 그대로 뺀 값을 **한 자리에서만** 쓴다.
 *
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 파일을 참조하지 않는다.
 */

const t = messages.packingResult;

/** 이 배분에 아직 담을 수 있는 수량. 음수가 나올 수 없으나 계약이 막지는 않으므로 바닥을 둔다. */
export const remainingOf = (allocation: ShipmentLotAllocation): number =>
  Math.max(allocation.allocatedQty - allocation.packedQty, 0);

/** 담긴 줄에서 이 배분을 찾는다. 없으면 `undefined`. */
export const lineOf = (
  lines: readonly PackedLine[],
  shipmentLotAllocationId: number,
): PackedLine | undefined =>
  lines.find((line) => line.shipmentLotAllocationId === shipmentLotAllocationId);

/**
 * 수량 입력의 잘못을 말한다. 없으면 `undefined`.
 *
 * ⭐ **한도는 「이 배분의 잔여 − 이미 담은 것」이다.** 잔여만 보면 120 을 두 번 담아 240 이
 * 되고, 그 초과는 확정 요청이 서버에서 거부될 때에야 드러난다.
 */
export const qtyError = (
  raw: string,
  allocation: ShipmentLotAllocation,
  lines: readonly PackedLine[],
): string | undefined => {
  const parsed = Number(raw);

  if (raw.trim() === '' || !Number.isFinite(parsed) || parsed <= 0) return t.qty.notPositive;

  const already = lineOf(lines, allocation.shipmentLotAllocationId)?.qty ?? 0;
  const room = remainingOf(allocation) - already;

  return parsed > room ? t.qty.overRemaining(room) : undefined;
};

/** 담기의 결과 — 새로 담았는가, 있던 줄에 더했는가. 더했으면 화면이 그 사실을 말한다(§5-3). */
export interface AddOutcome {
  lines: PackedLine[];
  merged?: { before: number; added: number; after: number };
}

/**
 * 한 줄을 담는다. **같은 배분이 이미 있으면 수량을 더한다** — `uq_handling_unit_content` 가
 * 같은 포장에 같은 LOT 을 두 행으로 두지 못하게 하므로, 화면이 미리 합쳐 보낸다.
 */
export const addLine = (
  lines: readonly PackedLine[],
  allocation: ShipmentLotAllocation,
  qty: number,
): AddOutcome => {
  const existing = lineOf(lines, allocation.shipmentLotAllocationId);

  if (existing === undefined) {
    const line: PackedLine = {
      shipmentLotAllocationId: allocation.shipmentLotAllocationId,
      itemId: allocation.itemId,
      itemCode: allocation.itemCode,
      lotId: allocation.lotId,
      lotNo: allocation.lotNo ?? '',
      uomId: allocation.uomId,
      qty,
      remaining: remainingOf(allocation),
    };

    return { lines: [...lines, line] };
  }

  const after = existing.qty + qty;

  return {
    lines: lines.map((line) =>
      line.shipmentLotAllocationId === allocation.shipmentLotAllocationId
        ? { ...line, qty: after }
        : line,
    ),
    merged: { before: existing.qty, added: qty, after },
  };
};

/** 마지막으로 담은 줄을 뺀다 — 「다시 스캔」이 부른다. */
export const removeLine = (
  lines: readonly PackedLine[],
  shipmentLotAllocationId: number,
): PackedLine[] => lines.filter((line) => line.shipmentLotAllocationId !== shipmentLotAllocationId);

/** 담긴 수량의 합. */
export const packedTotal = (lines: readonly PackedLine[]): number =>
  lines.reduce((sum, line) => sum + line.qty, 0);

/** 담긴 줄들이 걸린 배분 잔여의 합 — 표의 「합계 N / N」의 분모다. */
export const remainingTotal = (lines: readonly PackedLine[]): number =>
  lines.reduce((sum, line) => sum + line.remaining, 0);

/**
 * 이 출하의 진행 — 포장 개수와 미포장 수량(스펙 §3 ④).
 *
 * ⛔ **「예상 포장 수」를 내지 않는다.** 포장당 수량 기준이 마스터에 없어 서버도 파생하지
 * 못한다(§3-3). 분모가 없으므로 진행 막대도 그리지 않는다.
 */
export interface ShipmentProgress {
  packedCount: number;
  unpackedQty: number;
}

export const toProgress = (allocations: readonly ShipmentLotAllocation[]): ShipmentProgress => {
  const handlingUnitIds = new Set<number>();

  for (const allocation of allocations) {
    const handlingUnitId = allocation.handlingUnitId;
    if (handlingUnitId !== undefined && handlingUnitId !== null)
      handlingUnitIds.add(handlingUnitId);
  }

  return {
    packedCount: handlingUnitIds.size,
    unpackedQty: allocations.reduce((sum, allocation) => sum + remainingOf(allocation), 0),
  };
};

/** 스캔값 정리 — 앞뒤 공백만 턴다. ⛔ 대소문자를 건드리지 않는다(서버 규칙을 화면이 정하지 않는다). */
export const normalizeScanCode = (raw: string): string | null => {
  const trimmed = raw.trim();

  return trimmed === '' ? null : trimmed;
};
