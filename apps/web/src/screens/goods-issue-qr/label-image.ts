/**
 * 출고 QR 라벨 한 장을 그린다 — **QR 격자 + 사람이 읽는 여섯 줄.**
 *
 * ⭐ **POP 이 그린다**(설계 결정 8·9 의 2단계 · 사용자 결정 2026-09-16). 서버는 이 유형의
 *    렌디션을 만들지 않으므로 이 화면은 `fetchLabelRendition` 을 부르지 않는다.
 *
 * ⭐ **종이는 80 × 30 mm TSPL 로 나간다**(omf-all-around#35). 그림(PNG)을 드라이버 경로로 찍으니
 *    크기가 라벨지와 맞지 않고 상하가 뒤집혀 나왔다 — 포장 라벨과 같은 증상·같은 해법이다
 *    (`shipping-packing-label/packing-label-tspl`). 여백·QR 자리·글줄 칸은 `layoutLotLabel`
 *    한 곳이 갖고, 이 파일은 **글줄과 QR 내용만** 정한다. 그림은 미리보기와 단말 저장용이며
 *    종이와 같은 자리에 그린다.
 *
 * ⛔ **라벨 면에 한글을 싣지 않는다.** 점 글꼴이 영문·숫자만 갖는다. 이름표는 영문 약어를 쓰고
 *    값은 코드·번호만 싣는다 — 도착 위치도 **이름이 아니라 코드**다(통합 담당 지시 2026-09-16).
 */

import { toPng } from '../../patterns/label/png';
import { buildLotLabel, layoutLotLabel, type LotLabelRow } from '../pop-material-lot-label/label-tspl';
import { drawLotLabelLayout } from '../shipping-packing-label/packing-label-image';
import type { LabelBitmap } from '../../patterns/label/bitmap';

export interface GoodsIssueQrLabelFields {
  /** QR 이 담는 글. 이 함수는 만들지 않는다 — `qr-payload.ts` 가 소유한다. */
  payload: string;
  goodsIssueNo: string;
  lineNo: number;
  itemCode: string;
  lotNo: string;
  quantity: string;
  /** 도착 위치 **코드**. 이름이 아니다. */
  destinationCode: string;
}

/**
 * 라벨에 세울 글줄 — **종이(TSPL)와 그림이 같은 줄을 쓴다.**
 *
 * ```
 * MATERIAL ISSUE QR                 ┌────┐
 * GI: GI-20260916-0001              │ QR │
 * LINE 1  ITEM: ES0602-00062        │    │
 * LOT: ES0602-00062|10000|…         └────┘
 * QTY: 10 EA
 * TO: S220-WIP
 * ```
 */
export const goodsIssueQrLabelRows = (fields: GoodsIssueQrLabelFields): LotLabelRow[] => [
  /* ⚠ **자재 출고다** — 제품 출하 라벨과 현장에서 섞이지 않게 한다(D4). */
  { point: 8, content: 'MATERIAL ISSUE QR' },
  { point: 10, content: `GI: ${fields.goodsIssueNo}` },
  { point: 8, content: `LINE ${String(fields.lineNo)}  ITEM: ${fields.itemCode}` },
  { point: 8, content: `LOT: ${fields.lotNo}` },
  { point: 8, content: `QTY: ${fields.quantity}` },
  { point: 8, content: `TO: ${fields.destinationCode}` },
];

/** 인쇄에 쓸 TSPL 명령 — 80 × 30 mm 한 장. */
export const buildGoodsIssueQrLabel = (fields: GoodsIssueQrLabelFields): string =>
  buildLotLabel(goodsIssueQrLabelRows(fields), fields.payload);

/** 라벨 한 장의 점판. PNG 로 바꾸기 전 모습이라 시험이 점 단위로 들여다볼 수 있다. */
export const drawGoodsIssueQrLabel = (fields: GoodsIssueQrLabelFields): LabelBitmap =>
  drawLotLabelLayout(layoutLotLabel(goodsIssueQrLabelRows(fields), fields.payload));

/** 라벨 한 장의 PNG 바이트. 미리보기와 단말 저장이 이것을 쓴다. */
export const renderGoodsIssueQrLabel = (fields: GoodsIssueQrLabelFields): Uint8Array<ArrayBuffer> =>
  toPng(drawGoodsIssueQrLabel(fields));
