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

/*
 * ⛔ **이 출하의 진행(포장 개수·미포장 수량)을 세지 않는다**(사용자 지시 2026-09-18 · #1351).
 *    스펙 §3 ④ 가 그린 두 수치이고 `toProgress` 가 여기서 세었는데, 화면이 그 줄을 걷으며
 *    유일한 소비자가 사라졌다. 남은 ④ 의 「미구성 상자」는 서버가 세어 내려 준다
 *    (`Shipment.unassignedPackedBoxCount`) — 화면이 파생하지 않는다.
 *
 * ⚠ 되돌릴 때 함께 돌아오는 것은 **셈 하나가 아니라 줄 하나**다 — `docs/decisions.md` 18.
 */

/** 스캔값 정리 — 앞뒤 공백만 턴다. ⛔ 대소문자를 건드리지 않는다(서버 규칙을 화면이 정하지 않는다). */
export const normalizeScanCode = (raw: string): string | null => {
  const trimmed = raw.trim();

  return trimmed === '' ? null : trimmed;
};

/**
 * 유형 선택칸에 세울 값 — **아직 아무것도 고르지 않았을 때만 첫 값을 채운다**
 * (사용자 지시 2026-09-18).
 *
 * ⛔ **고른 값을 덮지 않는다.** 목록이 다시 오면(재조회·코드 그룹 변경) 이 판정이 다시 도는데,
 *    그때 덮으면 담당이 고른 유형이 **소리 없이 되돌아간다.**
 * ⛔ **목록이 아직 없으면 그대로 둔다** — 마운트 시점에는 목록이 없다. 빈 값으로 남아야
 *    `confirm-lock` 의 「유형을 고르세요」가 제 할 일을 한다.
 * ⚠ 화면에서는 이 판정이 화면 밖으로 드러나지 않는다(목록이 바뀌는 길이 조작에 없다) —
 *   그래서 규칙을 여기로 꺼내 직접 붙든다.
 */
export const nextHandlingUnitTypeCode = (
  current: string,
  firstOptionCode: string | undefined,
): string => (current !== '' || firstOptionCode === undefined ? current : firstOptionCode);
