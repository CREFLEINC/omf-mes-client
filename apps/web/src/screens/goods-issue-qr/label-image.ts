/**
 * 출고 QR 라벨 한 장을 그린다 — **QR 격자 + 사람이 읽는 여섯 줄.**
 *
 * ⭐ **POP 이 그린다**(설계 결정 8·9 의 2단계 · 사용자 결정 2026-09-16). 서버는 이 유형의
 *    렌디션을 만들지 않으므로 이 화면은 `fetchLabelRendition` 을 부르지 않는다.
 *
 * ⚠ **치수는 자재 LOT 라벨과 같은 자를 쓴다**(203dpi · 서식 80×30mm). 같은 단말의 같은 라벨지에
 *    찍히므로 자가 갈리면 한쪽이 종이를 벗어난다. 근거 수치는 `tools/mock/label-layout.mjs`
 *    (씨앗)와 `apps/pop/src/main/tspl-label.ts`(실물 TSPL)에 같은 값으로 서 있다.
 *
 * ⛔ **라벨 면에 한글을 싣지 않는다.** 점 글꼴이 영문·숫자만 갖는다. 이름표는 영문 약어를 쓰고
 *    값은 코드·번호만 싣는다 — 도착 위치도 **이름이 아니라 코드**다(통합 담당 지시 2026-09-16).
 */

import { encodeQr } from '@omf-mes/ui';

import {
  createBitmap,
  drawText,
  fillRect,
  fitText,
  strokeRect,
  type LabelBitmap,
} from './label-bitmap';
import { toPng } from './label-png';

/** 203dpi — 현장 라벨 프린터의 해상도. 씨앗·TSPL 과 같은 값이다. */
const DPI = 203;
const mm = (value: number): number => Math.round((value / 25.4) * DPI);

/** 서식 크기(사양서 §5.4). 라벨지(대지) 크기와 다른 축이다. */
const WIDTH = mm(80);
const HEIGHT = mm(30);
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

/**
 * QR 격자를 점판에 찍는다.
 *
 * ⛔ **여백(quiet zone)을 직접 둔다.** `encodeQr` 는 격자만 낸다(여백을 넣지 않는다고 못박혀
 *    있다). 여백 없이 찍으면 판독기가 격자의 끝을 찾지 못해 **읽히지 않는 QR** 이 나간다.
 */
const QUIET_ZONE = 4;

const drawQr = (bitmap: LabelBitmap, payload: string, x: number, y: number, box: number): void => {
  const matrix = encodeQr(payload);
  const withQuiet = matrix.size + QUIET_ZONE * 2;
  /* 칸을 정수 배율로만 키운다 — 소수로 키우면 칸 경계가 흔들려 판독률이 떨어진다. */
  const cell = Math.max(1, Math.floor(box / withQuiet));
  const drawn = withQuiet * cell;
  /* 남는 자리는 가운데로 민다. */
  const originX = x + Math.floor((box - drawn) / 2) + QUIET_ZONE * cell;
  const originY = y + Math.floor((box - drawn) / 2) + QUIET_ZONE * cell;

  for (const [row, cells] of matrix.modules.entries()) {
    for (const [column, isDark] of cells.entries()) {
      if (!isDark) continue;

      fillRect(bitmap, originX + column * cell, originY + row * cell, cell, cell);
    }
  }
};

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
