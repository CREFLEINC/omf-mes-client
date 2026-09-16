/**
 * 포장 라벨 한 장을 그린다 — **QR 격자 + 사람이 읽는 줄들.**
 *
 * ⭐ **POP 이 그린다**(통보 277 원칙의 포장 라벨 확장 · SHIP-UNIT-01). 그전까지 이 라벨은
 *    서버 렌디션을 받으려 했는데, `PACKING_LABEL` 은 준비된 종류 목록에 없어
 *    **배포본에서 요청이 만들어지기도 전에 막혔다** — 그 탓에 셸 저장과 인쇄 결과 보고까지
 *    한 번도 닿지 못했고, 발행 기록만 `PENDING` 으로 쌓였다. 즉 이 파일은 새 기능이 아니라
 *    **종이가 나오지 않던 것을 되돌리는 자리**다.
 *
 * ⚠ **자는 다른 라벨과 같은 것을 쓴다**(`patterns/label/geometry` — 203dpi · 80×30mm).
 *    같은 단말의 같은 라벨지에 자재 LOT·출고 QR·포장 라벨이 섞여 찍힌다.
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
import { LABEL_HEIGHT, LABEL_WIDTH, mm } from '../../patterns/label/geometry';
import { toPng } from '../../patterns/label/png';
import { drawQr } from '../../patterns/label/qr';

const PAD = mm(2);
const LEFT = PAD + mm(1.5);
const BORDER = 2;

/** QR 이 차지하는 한 변. 다른 POP 라벨과 같다. */
const QR_BOX = mm(12);

/**
 * 글줄의 **윗변** y 좌표. 여섯 줄이 30mm 안에서 고르게 벌어진다
 * (출고 QR 라벨과 같은 자리 — 두 라벨이 나란히 붙었을 때 눈이 같은 높이를 찾는다).
 */
const ROWS = { head: 10, unit: 44, shipment: 86, content: [118, 150, 182] } as const;

const SCALE_HEAD = 3;
const SCALE_VALUE = 4;
const SCALE_SMALL = 3;

/** 상자에 담긴 한 줄. **품목은 코드다** — 이름은 점 글꼴이 그리지 못한다. */
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

/** 라벨에 세울 수 있는 내용물 줄 수. 넘치면 몇 줄이 더 있는지 «수»로 말한다. */
const MAX_CONTENT_ROWS = ROWS.content.length;

/** 라벨 한 장의 점판. PNG 로 바꾸기 전 모습이라 시험이 점 단위로 들여다볼 수 있다. */
export const drawPackingLabel = (fields: PackingLabelFields): LabelBitmap => {
  const bitmap = createBitmap(LABEL_WIDTH, LABEL_HEIGHT);

  strokeRect(bitmap, 0, 0, LABEL_WIDTH, LABEL_HEIGHT, BORDER);

  const qrX = LABEL_WIDTH - PAD - QR_BOX;
  const qrY = PAD + mm(1);
  /* ⭐ QR 은 **취급 단위 번호 원문**이다 — 출하 단위 구성(P-04-05)이 이 값을 그대로 스캔한다. */
  drawQr(bitmap, fields.handlingUnitNo, qrX, qrY, QR_BOX);

  /* QR 옆줄은 QR 까지, 아랫줄은 라벨 끝까지 쓸 수 있다. */
  const besideQr = qrX - LEFT - mm(2);
  const fullWidth = LABEL_WIDTH - LEFT - PAD;

  const line = (text: string, y: number, scale: number, available: number): void => {
    const fitted = fitText(text, available, scale);
    drawText(bitmap, fitted.text, LEFT, y, fitted.scale);
  };

  /* ⚠ **제품 출하다** — 자재 출고 라벨과 현장에서 섞이지 않게 머리에 밝힌다. */
  line(`PACKING  SEQ ${String(fields.issueSeq)}`, ROWS.head, SCALE_HEAD, besideQr);
  line(`HU: ${fields.handlingUnitNo}`, ROWS.unit, SCALE_VALUE, besideQr);
  line(`SH: ${fields.shipmentNo}`, ROWS.shipment, SCALE_SMALL, besideQr);

  /*
   * ⛔ **넘친 줄을 말없이 버리지 않는다.** 상자에 든 것이 라벨에 다 못 실릴 수 있는데, 그
   *    사실이 보이지 않으면 현장은 **라벨에 적힌 것이 상자의 전부**라고 읽는다. 넘치면
   *    **마지막 한 줄을 비워** 몇 줄이 더 있는지 수로 말한다.
   *
   * ⚠ 마지막 줄 위에 덧그리지 않는다 — 점판은 지우지 않으므로 두 글이 겹쳐 둘 다 못 읽는다.
   */
  const overflows = fields.contents.length > MAX_CONTENT_ROWS;
  const shown = fields.contents.slice(0, overflows ? MAX_CONTENT_ROWS - 1 : MAX_CONTENT_ROWS);
  const hidden = fields.contents.length - shown.length;

  for (const [index, content] of shown.entries()) {
    const y = ROWS.content[index];
    if (y === undefined) continue;

    line(`${content.itemCode} ${content.lotNo} ${content.quantity}`, y, SCALE_SMALL, fullWidth);
  }

  if (hidden > 0) {
    const y = ROWS.content[shown.length];
    if (y !== undefined) line(`+${String(hidden)} MORE ITEMS`, y, SCALE_SMALL, fullWidth);
  }

  return bitmap;
};

/** 라벨 한 장의 PNG 바이트. 셸 `rendition.save` 가 받는 것이 이것이다. */
export const renderPackingLabel = (fields: PackingLabelFields): Uint8Array<ArrayBuffer> =>
  toPng(drawPackingLabel(fields));
