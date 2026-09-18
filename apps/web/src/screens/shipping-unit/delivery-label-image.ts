/**
 * 납품 라벨 한 장을 그린다 — **출하 단위 하나에 한 장**(설계 §8 · SHIP-UNIT-01).
 *
 * ⭐ **주인이 바뀌었다.** 그전에는 출하 LOT 배분(제품 LOT × 출하 라인)이 주인이라 **상자
 *    하나에 납품 라벨이 여러 장** 나왔다 — 사용자가 비정상으로 판정했다. 이제 상자 1개 이상을
 *    묶은 **출하 단위**가 주인이고, 마감할 때 한 장이 나온다.
 *
 * ⭐ **이름을 싣는다 — 그래서 시스템 글꼴을 쓴다.** 고객·납품처 «명»이 사용자 필수 항목인데
 *    한국어·베트남어라 5×7 점 글꼴에 없다(`patterns/label/text` 머리말). 코드·번호는 그대로
 *    점 글꼴이 찍고, **이름이 들어가는 줄만** 시스템 글꼴로 간다.
 *
 * ⚠ **자리 계산은 늘 `measureLabelText`·`fitLabelText` 를 거친다.** 두 글꼴의 너비가 달라
 *   (고정폭 ↔ 비례폭) 한쪽 기준으로 잡으면 다른 단말에서 글이 옆 칸으로 흘러넘친다.
 *
 * ⚠ 자는 다른 라벨과 같다(`patterns/label/geometry` — 203dpi · 80×30mm).
 *
 * ⭐ **종이는 이 점판을 TSPL `BITMAP` 으로 통째 보낸다**(사용자 지시 2026-09-17 ·
 *    `patterns/label/tspl-bitmap`). 그림 인쇄 경로는 드라이버 대지를 거쳐 크기가 틀어지고
 *    뒤집혔고, 내장 글꼴은 이름(한글)을 못 찍는다. 그래서 자리는 자재·생산 LOT 라벨이 실기에서
 *    맞춘 **안전 여백**(왼 1.5 · 오 6.5 · 위 2 · 아래 6 mm) 안에 둔다.
 */

import {
  createBitmap,
  drawText,
  fitText,
  strokeRect,
  type LabelBitmap,
} from '../../patterns/label/bitmap';
import { foldRows } from '../../patterns/label/fold';
import { LABEL_HEIGHT, LABEL_WIDTH, mm } from '../../patterns/label/geometry';
import { toPng } from '../../patterns/label/png';
import { drawQr } from '../../patterns/label/qr';
import { toTsplBitmap } from '../../patterns/label/tspl-bitmap';
import { drawLabelText, fitLabelText } from '../../patterns/label/text';

/*
 * 안전 여백 — `pop-material-lot-label/label-tspl` 의 LEFT·RIGHT·TOP·BOTTOM 과 같은 값이다.
 * ⛔ HT800 이 오른쪽·아래로 치우쳐 찍어 맞춘 값이라 늘리거나 줄이지 않는다.
 */
const LEFT = mm(1.5);
const RIGHT = mm(6.5);
const TOP = mm(2);
const BORDER = 2;

/** QR 이 차지하는 한 변. 다른 POP 라벨과 같다. */
const QR_BOX = mm(12);

/**
 * 글줄의 **윗변** y 좌표.
 *
 * ⚠ **일곱 줄이다** — 다른 라벨(여섯)보다 하나 많아 사이가 좁다(30). 배율 3 의 글자 높이가
 *   21 이라 9 가 남는다. 줄을 더 늘리려면 서식 높이부터 다시 봐야 한다.
 */
const ROWS = {
  head: TOP,
  unit: TOP + 26,
  customer: TOP + 60,
  shipTo: TOP + 84,
  /* 마지막 줄 아랫변이 189 — 아래 여백(6 mm, 192 부터) 안에서 끝난다. */
  item: [TOP + 108, TOP + 130, TOP + 152],
} as const;

const SCALE_HEAD = 3;
const SCALE_VALUE = 4;
const SCALE_SMALL = 3;

/**
 * 품목 줄 자리. 넘치면 마지막 자리를 안내에 내준다(`patterns/label/fold`).
 *
 * ⚠ **화면 미리보기가 같은 수로 접어야 한다** — 다르면 담당이 본 것과 종이로 나온 것이
 *   달라지고, 라벨은 되돌릴 수 없어 그 어긋남을 나중에야 알게 된다. 그래서 내보낸다.
 */
export const DELIVERY_LABEL_ITEM_ROWS = ROWS.item.length;
const MAX_ITEM_ROWS = DELIVERY_LABEL_ITEM_ROWS;

/** 값이 없을 때 그 자리에 세우는 표식. 빈칸과 구별된다. */
const UNKNOWN = '-';

/** 거래처 한 곳 — **코드와 이름을 함께 찍는다**(설계 §8). */
export interface DeliveryLabelPartner {
  partnerCode: string;
  partnerName: string;
}

/** 품목별 합계 한 줄. 서버가 상자 내용물을 품목·단위별로 합해 준다(설계 §4-3 `itemTotals`). */
export interface DeliveryLabelItemTotal {
  itemCode: string;
  itemName: string;
  /** 이미 사람이 읽을 모양으로 맞춘 글(단위까지 붙는다). 이 파일은 수를 세지 않는다. */
  quantity: string;
}

export interface DeliveryLabelFields {
  /** QR 이 담는 글이자 사람이 읽는 값 — **출하 단위 번호 원문**. 납품 라벨 번호이기도 하다. */
  shippingUnitNo: string;
  customer: DeliveryLabelPartner;
  shipTo: DeliveryLabelPartner;
  /** 이 출하 단위에 담긴 상자 수(설계 §8). */
  boxCount: number;
  /** 회차(공유계약 K-6). 재발행이면 2 이상이다. */
  issueSeq: number;
  itemTotals: readonly DeliveryLabelItemTotal[];
}

/** 라벨 한 장의 점판. PNG 로 바꾸기 전 모습이라 시험이 점 단위로 들여다볼 수 있다. */
export const drawDeliveryLabel = (
  fields: DeliveryLabelFields,
  { outline = true }: { outline?: boolean } = {},
): LabelBitmap => {
  const bitmap = createBitmap(LABEL_WIDTH, LABEL_HEIGHT);

  /* 라벨지 가장자리 — 그림에서 여백을 눈으로 재라고 둔다. ⛔ 종이(TSPL)에는 싣지 않는다. */
  if (outline) strokeRect(bitmap, 0, 0, LABEL_WIDTH, LABEL_HEIGHT, BORDER);

  const qrX = LABEL_WIDTH - RIGHT - QR_BOX;
  const qrY = TOP;
  /* ⭐ QR 은 **출하 단위 번호 원문**이다 — 역추적이 이 값에서 시작한다(설계 §2). */
  drawQr(bitmap, fields.shippingUnitNo, qrX, qrY, QR_BOX);

  const besideQr = qrX - LEFT - mm(2);
  const fullWidth = LABEL_WIDTH - LEFT - RIGHT;

  /** 코드·번호 줄 — **점 글꼴**이 찍는다. 또렷하고 시험이 점 단위로 되읽을 수 있다. */
  const codeLine = (text: string, y: number, scale: number, available: number): void => {
    const fitted = fitText(text, available, scale);
    drawText(bitmap, fitted.text, LEFT, y, fitted.scale);
  };

  /** 이름이 섞인 줄 — **시스템 글꼴**이 찍는다(없으면 점 글꼴로 물러선다). */
  const nameLine = (text: string, y: number, scale: number, available: number): void => {
    const fitted = fitLabelText(text, available, scale);
    drawLabelText(bitmap, fitted.text, LEFT, y, fitted.scale);
  };

  /* ⚠ **제품 출하다** — 자재 출고·포장 라벨과 현장에서 섞이지 않게 머리에 밝힌다. */
  codeLine(
    `DELIVERY  SEQ ${String(fields.issueSeq)}  BOX ${String(fields.boxCount)}`,
    ROWS.head,
    SCALE_HEAD,
    besideQr,
  );
  codeLine(`SU: ${fields.shippingUnitNo}`, ROWS.unit, SCALE_VALUE, besideQr);

  nameLine(
    `CUST ${fields.customer.partnerCode} ${fields.customer.partnerName}`,
    ROWS.customer,
    SCALE_SMALL,
    besideQr,
  );
  nameLine(
    `TO ${fields.shipTo.partnerCode} ${fields.shipTo.partnerName}`,
    ROWS.shipTo,
    SCALE_SMALL,
    besideQr,
  );

  /*
   * ⛔ **넘친 품목을 말없이 버리지 않는다** — 셈은 `patterns/label/fold` 가 갖는다. 라벨에
   *    적힌 것이 이 단위의 전부로 읽히면 받는 쪽에서 대조가 어긋난다.
   */
  const { shown, hidden } = foldRows(fields.itemTotals, MAX_ITEM_ROWS);

  for (const [index, total] of shown.entries()) {
    const y = ROWS.item[index];
    if (y === undefined) continue;

    nameLine(`${total.itemCode} ${total.itemName} ${total.quantity}`, y, SCALE_SMALL, fullWidth);
  }

  if (hidden > 0) {
    const y = ROWS.item[shown.length];
    /* 안내는 코드·숫자뿐이라 점 글꼴로 찍는다 — 글꼴이 없는 단말에서도 읽힌다. */
    if (y !== undefined) codeLine(`+${String(hidden)} MORE ITEMS`, y, SCALE_SMALL, fullWidth);
  }

  return bitmap;
};

/** 라벨 한 장의 PNG 바이트. 미리보기와 단말 저장(`rendition.keep`)이 쓴다. */
export const renderDeliveryLabel = (fields: DeliveryLabelFields): Uint8Array<ArrayBuffer> =>
  toPng(drawDeliveryLabel(fields));

/** 라벨 한 장의 TSPL 바이트 — 종이는 이것으로 나간다. 테두리는 싣지 않는다. */
export const buildDeliveryLabelTspl = (fields: DeliveryLabelFields): Uint8Array<ArrayBuffer> =>
  toTsplBitmap(drawDeliveryLabel(fields, { outline: false }));

/** 값이 없을 때 쓰는 표식 — 화면이 같은 말을 쓰도록 내보낸다. */
export { UNKNOWN as DELIVERY_LABEL_UNKNOWN };
