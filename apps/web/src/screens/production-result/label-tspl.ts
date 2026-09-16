import { buildLotLabel, lotLabelQty, type LotLabelRow } from '../pop-material-lot-label/label-tspl';

/**
 * 생산 LOT 라벨 — **POP 이 80 × 30 mm 규격으로 직접 짠다**(사용자 지시 2026-09-16).
 *
 * ⭐ **왜 서버가 그린 것을 쓰지 않는가.** 서버 렌디션은 100 × 60 mm 좌표라, 현장에 걸린
 *   80 × 30 mm 라벨지에서는 QR 과 오른쪽·아래 줄이 라벨지 밖으로 나가 잘렸다(실기 2026-09-16 ·
 *   사용자 확인). 자재 LOT 라벨이 같은 이유로 먼저 옮겨 간 자리이고(`pop-material-lot-label/
 *   label-tspl` 머리말), 사용자가 **「테스트 용지 인쇄와 동일한 본문 배치」**를 지시했다.
 *
 * ⛔ **여백·QR 자리·글줄 칸을 여기서 다시 정하지 않는다.** 전부 `buildLotLabel` 이 가진다 —
 *    실기에서 맞춘 값이라 베껴 두면 다음에 한쪽만 고쳐져 갈라진다.
 *
 * ⛔ **QR 에는 생산 LOT 번호만 싣는다.** 마감 스캔이 찍은 값을 그대로 LOT 번호로 읽는다.
 *
 * ⚠ **품명은 싣지 않는다.** 내장 글꼴은 한글을 찍지 못한다(같은 머리말).
 */
export interface ProductionLotLabelFields {
  itemCode: string;
  lotNo: string;
  /**
   * 이 LOT 의 양품 수량. **모르면 `null`** — 수량 줄을 통째로 뺀다.
   *
   * ⛔ 모르는 수량을 `0` 으로 적지 않는다. 라벨은 현장에서 그대로 읽히는 값이라, 틀린 수량은
   *    없는 수량보다 나쁘다.
   */
  qty: number | null;
  /** 단위 코드. 모르면 `null` — 수량만 적는다. */
  uomCode: string | null;
  /** 발행 회차. */
  issueSeq: number;
  workOrderNo: string;
}

/**
 * 생산 LOT 라벨 한 장.
 *
 * ```
 * PROD LOT  #1                 ┌────┐
 * ITEM ES0602-00062            │ QR │
 * QTY 1000 EA                  │    │
 * LOT PL-260916-0001           └────┘
 * W/O WO-260916-0007
 * ```
 */
export const buildProductionLotLabel = (fields: ProductionLotLabelFields): string => {
  const rows: LotLabelRow[] = [
    { point: 8, content: `PROD LOT  #${String(fields.issueSeq)}` },
    { point: 10, content: `ITEM ${fields.itemCode}` },
    ...(fields.qty === null
      ? []
      : [{ point: 10, content: `QTY ${lotLabelQty(fields.qty, fields.uomCode)}` }]),
    { point: 8, content: `LOT ${fields.lotNo}` },
    { point: 8, content: `W/O ${fields.workOrderNo}` },
  ];

  return buildLotLabel(rows, fields.lotNo);
};
