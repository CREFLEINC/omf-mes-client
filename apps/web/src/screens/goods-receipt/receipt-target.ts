import type { IrLineView } from './types';

/**
 * 고른 입하 줄에서 «무엇을 얼마나» 입고하는가(서버 선행 P-56 · 3단계 검증 2026-10-16).
 *
 * ⭐ 입고 전(IQC 단계) 선별은 LOT 기록만 나눈다 — 원 LOT 은 양품(입고 가능 수량)만, 떼어 낸 불량분은 자식 LOT 으로 따로
 *    입고한다. 줄 하나에 입고 대상이 여럿일 수 있어 화면이 하나를 고른다(한 번에 한 줄 · 계획 결정 3 과 같은 규율).
 * ⚠ 서버가 입고 가능 수량을 싣지 않았으면(옛 서버) 입하 수량을 그대로 쓴다 — 지금까지의 동작이다.
 */
export interface ReceiptTarget {
  lotId: number;
  /** 원 LOT 이면 `null`(번호는 LOT 조회가 푼다), 선별 불량분이면 그 번호. */
  splitLotNo: string | null;
  qty: number;
}

export const receiptTargetsOf = (line: IrLineView): ReceiptTarget[] => [
  /*
   * 005 T141 — 서버가 자재 관리 LOT 별 대상을 실으면 LOT 마다 선다(새 흐름 입하 LOT 은 줄 하나에 여럿 — 줄의 `lotId` 는 첫 LOT,
   * `receivableQty` 는 합계라 그대로 쓰면 LOT 하나 입고가 400 이 되거나 다른 LOT 으로 나간다).
   */
  ...(line.materialLots.length > 0
    ? line.materialLots.map((lot) => ({
        lotId: lot.lotId,
        splitLotNo: null,
        qty: lot.receivableQty,
      }))
    : line.lotId === null
      ? []
      : [{ lotId: line.lotId, splitLotNo: null, qty: line.receivableQty ?? line.receivedQty }]),
  ...line.splitLots
    .filter((split) => split.receivableQty > 0)
    .map((split) => ({ lotId: split.lotId, splitLotNo: split.lotNo, qty: split.receivableQty })),
];

/**
 * 고른 대상.
 * - 고른 LOT 이 있으면 **그 LOT 만** — 대상에 없으면 `null`(막는다). 다른 LOT 으로 바꾸면 화면은 고른 LOT 을 보이는데
 *   요청은 다른 LOT 으로 나간다(005 T141 — 0002 를 골랐는데 0001 이 입고됐다).
 * - 고른 것이 없으면 입고할 수량이 남은 첫 대상(보통 원 LOT 의 양품), 그것도 없으면 첫 대상.
 */
export const chooseReceiptTarget = (
  targets: readonly ReceiptTarget[],
  pickedLotId: number | null,
): ReceiptTarget | null =>
  pickedLotId !== null
    ? (targets.find((target) => target.lotId === pickedLotId) ?? null)
    : (targets.find((target) => target.qty > 0) ?? targets[0] ?? null);

/** 선별로 떼어 낸 수량 합 — 「선별로 N 분리됨」 안내에 쓴다. */
export const splitQtyOf = (line: IrLineView): number =>
  line.splitLots.reduce((sum, split) => sum + split.receivableQty, 0);
