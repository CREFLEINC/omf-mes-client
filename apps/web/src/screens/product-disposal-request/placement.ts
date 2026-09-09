import { messages } from '@omf-mes/i18n';

import type { DisposalTarget } from './types';

/**
 * 폐기할 제품 LOT 이 **어디에 있는가.**
 *
 * ⭐ **진입 목록이 이 값을 주지 않는다.** 처분 결정(`quality.disposition_decision`)은 「무엇을
 * 어떻게 판정했는가」이지 「그 물건이 어느 선반에 있는가」가 아니다. 그런데 기타출고 전표는
 * `sourceWarehouseId` 를 필수로 받고 줄마다 `sourceLocationId` 를 필수로 받는다. **그 사이를
 * 잇는 것이 이 파일이다** — 재고 잔액을 LOT 축으로 물어 위치를 푼다.
 *
 * ⛔ **못 풀면 지어내지 않는다.** 되돌릴 수 없는 폐기 출고라, 위치를 모르는 채 보내면 **엉뚱한
 * 선반의 재고가 빠진다.** 「자재 LOT 스캔이 빗나가면 앞 화면의 위치로 등록된다」로 실제 사고가
 * 났던 자리와 같은 형태다(모바일 `#721`). 모르면 **막고 왜 막혔는지 말한다.**
 *
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 파일을 참조하지 않는다.
 */

const t = messages.productDisposalRequest.placement;

/** 잔액 응답에서 이 화면이 쓰는 것만. **`availableQty` 를 두지 않는다** — 아래 주석 참조. */
export interface PlacementEntry {
  lotId: number | null;
  warehouseId: number | null;
  locationId: number | null;
  onHandQty: number;
}

/** LOT 하나가 놓인 자리. */
export interface Placement {
  lotId: number;
  warehouseId: number;
  locationId: number;
}

export type PlacementResult =
  | { kind: 'resolved'; warehouseId: number; placements: readonly Placement[] }
  | { kind: 'blocked'; reason: string };

/**
 * 고른 대상들의 출발 자리를 푼다.
 *
 * ⛔ **막는 갈래가 넷이다.** 전부 「보내면 틀린 것이 남는다」라서 막는다 — 화면이 불편해지는
 * 쪽을 고른 것이고, 반대쪽은 되돌릴 수 없다.
 *
 * | 갈래 | 왜 막나 |
 * | --- | --- |
 * | LOT 을 못 받은 대상이 있다 | 판정은 됐는데 LOT 이 안 실린 건이다. 무엇을 뺄지 정할 수 없다 |
 * | 자리를 못 찾은 LOT 이 있다 | 재고에 없거나 조회가 못 닿았다. 「0 이라 없다」와 「못 물었다」를 화면이 가르지 못한다 |
 * | 한 LOT 이 여러 자리에 있다 | 어느 선반에서 뺄지는 **사람이 정할 일**이다. 화면이 첫 줄을 고르면 조용히 틀린다 |
 * | 창고가 섞였다 | 전표 하나에 `sourceWarehouseId` 는 하나다. 나눠 올릴 일을 한 벌로 접으면 안 된다 |
 *
 * ⚠ **`availableQty` 로 거르지 않는다.** 그 값은 보유에서 예약·피킹·**보류**를 뺀 것인데,
 * 폐기 대상은 바로 그 **보류·차단된 재고**일 가능성이 크다 — 거르면 폐기해야 할 것을 막는다.
 * `W-01-06` 이 같은 판단을 같은 이유로 했다.
 */
export const resolvePlacements = (
  targets: readonly DisposalTarget[],
  entriesOf: (lotId: number) => readonly PlacementEntry[] | undefined,
): PlacementResult => {
  if (targets.length === 0) return { kind: 'blocked', reason: t.noTarget };

  const placements: Placement[] = [];

  for (const target of targets) {
    if (target.lotId === null) return { kind: 'blocked', reason: t.lotMissing };

    const entries = entriesOf(target.lotId);
    if (entries === undefined) return { kind: 'blocked', reason: t.pending };

    /*
     * ⭐ **자리가 «있는» 것만 센다.** 잔액이 창고·위치를 못 채워 내려주는 줄이 있는데, 그것을
     * 자리로 세면 `null` 이 식별자 자리에 실린다. 세지 않으면 「자리를 못 찾았다」로 떨어져
     * 아래에서 막힌다 — 조용히 지나가지 않는다.
     */
    const seats = entries.filter(
      (entry): entry is PlacementEntry & { warehouseId: number; locationId: number } =>
        entry.warehouseId !== null && entry.locationId !== null,
    );

    if (seats.length === 0) return { kind: 'blocked', reason: t.notFound };
    if (seats.length > 1) return { kind: 'blocked', reason: t.split };

    const [seat] = seats;
    if (seat === undefined) return { kind: 'blocked', reason: t.notFound };

    placements.push({
      lotId: target.lotId,
      warehouseId: seat.warehouseId,
      locationId: seat.locationId,
    });
  }

  const [first] = placements;
  if (first === undefined) return { kind: 'blocked', reason: t.noTarget };

  if (placements.some((placement) => placement.warehouseId !== first.warehouseId)) {
    return { kind: 'blocked', reason: t.mixedWarehouse };
  }

  return { kind: 'resolved', warehouseId: first.warehouseId, placements };
};
