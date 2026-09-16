/**
 * 출고 QR 라벨 한 장을 그린다 — **QR 격자 + 사람이 읽는 여섯 줄.**
 *
 * ⭐ **POP 이 그린다**(설계 결정 8·9 의 2단계 · 사용자 결정 2026-09-16). 서버는 이 유형의
 *    렌디션을 만들지 않으므로 이 화면은 `fetchLabelRendition` 을 부르지 않는다.
 *
 * ⚠ **치수는 자를 빌려 쓴다** — 203dpi · 서식 80×30mm 는 `patterns/label/geometry` 가 갖는다.
 *    같은 단말의 같은 라벨지에 여러 라벨이 찍히므로 자가 갈리면 한쪽이 종이를 벗어난다.
 *
 * 이 파일이 갖는 것은 **이 라벨의 서식뿐**이다 — 여백·글줄 자리·문구·배율. 점판·PNG·QR 찍기는
 * `patterns/label/` 이 갖는다(라벨 종류를 모르는 것들).
 *
 * ⛔ **라벨 면에 한글을 싣지 않는다.** 점 글꼴이 영문·숫자만 갖는다. 이름표는 영문 약어를 쓰고
 *    값은 코드·번호만 싣는다 — 도착 위치도 **이름이 아니라 코드**다(통합 담당 지시 2026-09-16).
 */

import {
  createBitmap,
  drawText,
  fitText,
  strokeRect,
  type LabelBitmap,
} from '../../patterns/label/bitmap';
import { LABEL_HEIGHT, LABEL_WIDTH, mm } from '../../patterns/label/geometry';
import { toPng } from '../../patterns/label/png';
import { drawQr } from '../../patterns/label/qr';

/** 서식 크기는 **모든 라벨이 같은 자를 쓴다**(`patterns/label/geometry`). */
const WIDTH = LABEL_WIDTH;
const HEIGHT = LABEL_HEIGHT;
const PAD = mm(2);
const LEFT = PAD + mm(1.5);
const BORDER = 2;

/** QR 이 차지하는 한 변. 자재 LOT 라벨의 2D 코드와 같다. */
const QR_BOX = mm(12);

/**
 * 글줄의 **윗변** y 좌표.
 *
 * ⚠ 씨앗 라벨의 값은 기준선(baseline)이고 이 판은 점 글꼴이라 윗변을 쓴다 — 같은 자리에 서도록
 *   글자 높이만큼 올려 잡았다. 여섯 줄이 30mm 안에서 고르게 벌어지는 것이 목적이다.
 */
const ROWS = { head: 10, issueNo: 44, item: 86, lot: 118, qty: 160, destination: 196 } as const;

const SCALE_HEAD = 3;
const SCALE_VALUE = 4;
const SCALE_SMALL = 3;

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

/** 라벨 한 장의 점판. PNG 로 바꾸기 전 모습이라 시험이 점 단위로 들여다볼 수 있다. */
export const drawGoodsIssueQrLabel = (fields: GoodsIssueQrLabelFields): LabelBitmap => {
  const bitmap = createBitmap(WIDTH, HEIGHT);

  strokeRect(bitmap, 0, 0, WIDTH, HEIGHT, BORDER);

  const qrX = WIDTH - PAD - QR_BOX;
  const qrY = PAD + mm(1);
  drawQr(bitmap, fields.payload, qrX, qrY, QR_BOX);

  /* QR 옆줄은 QR 까지, 아랫줄은 라벨 끝까지 쓸 수 있다. */
  const besideQr = qrX - LEFT - mm(2);
  const fullWidth = WIDTH - LEFT - PAD;

  const line = (text: string, y: number, scale: number, available: number): void => {
    const fitted = fitText(text, available, scale);
    drawText(bitmap, fitted.text, LEFT, y, fitted.scale);
  };

  /* ⚠ **자재 출고다** — 제품 출하 라벨과 현장에서 섞이지 않게 한다(D4). */
  line('MATERIAL ISSUE QR', ROWS.head, SCALE_HEAD, besideQr);
  line(`GI: ${fields.goodsIssueNo}`, ROWS.issueNo, SCALE_VALUE, besideQr);
  line(`LINE ${String(fields.lineNo)}  ITEM: ${fields.itemCode}`, ROWS.item, SCALE_SMALL, besideQr);
  line(`LOT: ${fields.lotNo}`, ROWS.lot, SCALE_SMALL, fullWidth);
  line(`QTY: ${fields.quantity}`, ROWS.qty, SCALE_VALUE, fullWidth);
  line(`TO: ${fields.destinationCode}`, ROWS.destination, SCALE_SMALL, fullWidth);

  return bitmap;
};

/** 라벨 한 장의 PNG 바이트. 셸 `rendition.save` 가 받는 것이 이것이다. */
export const renderGoodsIssueQrLabel = (fields: GoodsIssueQrLabelFields): Uint8Array<ArrayBuffer> =>
  toPng(drawGoodsIssueQrLabel(fields));
