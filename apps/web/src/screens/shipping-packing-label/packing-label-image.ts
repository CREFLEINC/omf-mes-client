/**
 * 포장 라벨 한 장을 그린다 — **QR 격자 + 사람이 읽는 줄들.**
 *
 * ⭐ **POP 이 그린다**(통보 277 원칙의 포장 라벨 확장 · SHIP-UNIT-01). 그전까지 이 라벨은
 *    서버 렌디션을 받으려 했는데, `PACKING_LABEL` 은 준비된 종류 목록에 없어
 *    **배포본에서 요청이 만들어지기도 전에 막혔다** — 그 탓에 셸 저장과 인쇄 결과 보고까지
 *    한 번도 닿지 못했고, 발행 기록만 `PENDING` 으로 쌓였다. 즉 이 파일은 새 기능이 아니라
 *    **종이가 나오지 않던 것을 되돌리는 자리**다.
 *
 * ⭐ **종이와 같은 자리에 그린다**(사용자 지시 2026-09-17). 종이는 TSPL 로 나가고
 *    (`packing-label-tspl`), 이 그림은 미리보기와 단말 저장용이다. 자리는 둘 다
 *    `layoutLotLabel` 한 곳에서 받는다 — 따로 셈하면 「본 것과 나온 것」이 갈린다.
 *
 * ⚠ **글자 모양은 프린터 내장 글꼴과 같지 않다.** 줄 위치·크기·QR 자리는 같고, 글자 폭은
 *   단말 시스템 글꼴 기준이다. 칸을 넘치는 부분은 잘라 QR 위로 겹치지 않게 한다.
 *
 * ⛔ **라벨 면에 한글을 싣지 않는다.** 점 글꼴이 영문·숫자만 갖는다(`patterns/label/bitmap`) —
 *    없는 글자는 「빠졌다」가 보이는 채운 상자로 나간다. 그래서 품목은 **이름이 아니라 코드**를
 *    찍는다. 자재 LOT 라벨도 같은 이유로 코드만 찍는다(`pop-material-lot-label/label-tspl`).
 */

import {
  createBitmap,
  drawText,
  fitText,
  strokeRect,
  type LabelBitmap,
} from '../../patterns/label/bitmap';
import { foldRows } from '../../patterns/label/fold';
import { toPng } from '../../patterns/label/png';
import { QUIET_ZONE, drawQr } from '../../patterns/label/qr';
import { rasterizeText } from '../../patterns/label/text';
import { layoutLotLabel, type LotLabelRow } from '../pop-material-lot-label/label-tspl';

/** 상자에 담긴 한 줄. **품목은 코드다** — 이름은 프린터 내장 글꼴이 찍지 못한다. */
export interface PackingLabelContent {
  itemCode: string;
  lotNo: string;
  /** 이미 사람이 읽을 모양으로 맞춘 글(단위까지 붙는다). 이 파일은 수를 세지 않는다. */
  quantity: string;
}

export interface PackingLabelFields {
  /** QR 이 담는 글이자 사람이 읽는 값 — **취급 단위 번호 원문**(설계 §8). */
  handlingUnitNo: string;
  shipmentNo: string;
  /** 회차(공유계약 K-6). 재발행이면 2 이상이다. */
  issueSeq: number;
  contents: readonly PackingLabelContent[];
}

/** 내용물에 내줄 줄 수. 머리·HU·SH 세 줄과 합쳐 다섯 줄 — 자재 LOT 라벨과 같은 줄 수다. */
const MAX_CONTENT_ROWS = 2;

/**
 * 라벨에 세울 글줄 — **종이(TSPL)와 그림이 같은 줄을 쓴다.**
 *
 * ⛔ 넘친 줄을 말없이 버리지 않는다 — 셈은 `foldRows` 한 곳이다.
 */
export const packingLabelRows = (fields: PackingLabelFields): LotLabelRow[] => {
  const { shown, hidden } = foldRows(fields.contents, MAX_CONTENT_ROWS);

  return [
    { point: 8, content: `PACKING  #${String(fields.issueSeq)}` },
    { point: 10, content: `HU ${fields.handlingUnitNo}` },
    { point: 8, content: `SH ${fields.shipmentNo}` },
    ...shown.map((content) => ({
      point: 8,
      content: `${content.itemCode} ${content.lotNo} ${content.quantity}`,
    })),
    ...(hidden > 0 ? [{ point: 8, content: `+${String(hidden)} MORE ITEMS` }] : []),
  ];
};

/** 내장 글꼴 글자 높이(점). TSPL 은 point 를 203 dpi 로 옮긴 높이로 찍는다. */
const glyphHeight = (point: number): number => Math.ceil(point * (203 / 72));

/** 원판 점을 `maxWidth` 안쪽까지만 옮긴다 — 넘친 글이 QR 위로 겹치지 않게. */
const blitClipped = (
  target: LabelBitmap,
  source: LabelBitmap,
  x: number,
  y: number,
  maxWidth: number,
): void => {
  for (let sy = 0; sy < source.height; sy += 1) {
    for (let sx = 0; sx < Math.min(source.width, maxWidth); sx += 1) {
      if (source.dots[sy * source.width + sx] !== true) continue;

      const tx = x + sx;
      const ty = y + sy;

      if (tx >= 0 && ty >= 0 && tx < target.width && ty < target.height) {
        target.dots[ty * target.width + tx] = true;
      }
    }
  }
};

/** 라벨 한 장의 점판. PNG 로 바꾸기 전 모습이라 시험이 점 단위로 들여다볼 수 있다. */
export const drawPackingLabel = (fields: PackingLabelFields): LabelBitmap => {
  const layout = layoutLotLabel(packingLabelRows(fields), fields.handlingUnitNo);
  const bitmap = createBitmap(layout.width, layout.height);

  /* 라벨지 가장자리 — 종이에는 찍히지 않는다. 그림에서 여백을 눈으로 재라고 둔다. */
  strokeRect(bitmap, 0, 0, layout.width, layout.height, 2);

  const column = layout.qr.x - (layout.texts[0]?.x ?? 0);

  for (const line of layout.texts) {
    const height = glyphHeight(line.point);
    /* 시스템 글꼴 갈래는 배율 × 7 을 글자 크기로 쓴다 — 높이를 내장 글꼴에 맞춘다. */
    const raster = rasterizeText(line.content, height / 7);

    if (raster === null) {
      /* Canvas 가 없으면(시험 환경) 점 글꼴로 — 같은 칸 안에 맞춰 줄인다. */
      const fitted = fitText(line.content, column, Math.max(1, Math.floor(height / 7)), 1);
      drawText(bitmap, fitted.text, line.x, line.y, fitted.scale);
    } else {
      blitClipped(bitmap, raster, line.x, line.y, column);
    }
  }

  /*
   * ⭐ TSPL `QRCODE` 의 좌표는 격자 자체의 윗변이고 여백을 두지 않는다. `drawQr` 은 상자 안에
   *    여백을 두고 가운데 맞추므로, 여백만큼 바깥으로 넓힌 상자를 준다.
   */
  const quiet = QUIET_ZONE * layout.qr.cell;
  drawQr(
    bitmap,
    layout.qr.content,
    layout.qr.x - quiet,
    layout.qr.y - quiet,
    layout.qr.side + quiet * 2,
  );

  return bitmap;
};

/** 라벨 한 장의 PNG 바이트. 미리보기와 단말 저장이 이것을 쓴다. */
export const renderPackingLabel = (fields: PackingLabelFields): Uint8Array<ArrayBuffer> =>
  toPng(drawPackingLabel(fields));
