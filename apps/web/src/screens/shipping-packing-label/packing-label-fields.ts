/**
 * 포장 라벨에 실을 값을 모은다 — **두 자리가 같은 값을 만든다.**
 *
 * 포장 라벨은 두 곳에서 나간다. 포장을 확정하면 자동으로(P-04-01 `automatic-labels`), 그리고
 * 재발행 화면에서 손으로(P-04-02). 두 곳이 각자 값을 조립하면 **같은 상자의 라벨이 경로에
 * 따라 달라진다** — 한쪽만 고쳐도 아무도 모른다. 조립은 여기 한 곳이다.
 *
 * ⛔ **없는 값을 지어내지 않는다.** 배분에 LOT 번호가 없으면 그 사실을 적고(`-`), 단위를 풀지
 *    못했으면 수만 적는다. 빈칸으로 두면 현장은 「이 상자엔 원래 없다」로 읽는다.
 */

import type { PackingLabelContent, PackingLabelFields } from './packing-label-image';

/** 배분에서 라벨이 읽는 것만. 계약 응답을 통째로 끌고 다니지 않는다. */
export interface PackingLabelAllocation {
  /** 계약이 선택으로 둔다 — 포장하지 않는 출하도 있다. 이 상자의 것만 골라 쓴다. */
  handlingUnitId?: number | null;
  itemCode: string;
  lotNo?: string | null;
  allocatedQty: number;
  uomId: number;
}

/** 값이 없을 때 그 자리에 세우는 표식. 빈칸과 구별된다. */
const UNKNOWN = '-';

/**
 * 수량 한 칸.
 *
 * ⚠ **단위를 못 풀었으면 수만 적는다.** 단위를 지어내면(예: 늘 `EA`) 현장이 그 말을 믿는다 —
 *   상자 안이 박스 단위인데 낱개로 읽히면 수량 대조가 통째로 어긋난다.
 */
const quantityOf = (qty: number, uomCode: string | null): string =>
  uomCode === null ? qty.toLocaleString('ko-KR') : `${qty.toLocaleString('ko-KR')} ${uomCode}`;

/**
 * 이 상자에 담긴 배분들을 라벨 줄로 옮긴다.
 *
 * ⚠ **이 상자의 것만 고른다.** 배분 목록은 출하 전체를 담고 있어, 거르지 않으면 남의 상자
 *   내용이 이 라벨에 실린다.
 */
export const toPackingLabelContents = (
  allocations: readonly PackingLabelAllocation[],
  handlingUnitId: number,
  uomCodeOf: (uomId: number) => string | null,
): PackingLabelContent[] =>
  allocations
    .filter((allocation) => allocation.handlingUnitId === handlingUnitId)
    .map((allocation) => ({
      itemCode: allocation.itemCode,
      lotNo: allocation.lotNo ?? UNKNOWN,
      quantity: quantityOf(allocation.allocatedQty, uomCodeOf(allocation.uomId)),
    }));

export interface PackingLabelInput {
  handlingUnitId: number;
  handlingUnitNo: string;
  shipmentNo: string;
  issueSeq: number;
  allocations: readonly PackingLabelAllocation[];
  uomCodeOf: (uomId: number) => string | null;
}

export const toPackingLabelFields = (input: PackingLabelInput): PackingLabelFields => ({
  handlingUnitNo: input.handlingUnitNo,
  shipmentNo: input.shipmentNo,
  issueSeq: input.issueSeq,
  contents: toPackingLabelContents(input.allocations, input.handlingUnitId, input.uomCodeOf),
});
