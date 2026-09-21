/**
 * 자재 LOT 라벨 — **POP 이 80 × 30 mm 규격으로 직접 짠다**(사용자 지시 2026-09-14).
 *
 * ⭐ **왜 서버가 그린 것을 쓰지 않는가.** 서버 렌디션은 100 × 60 mm 좌표로 고정돼 있어, 현장에
 *   걸린 80 × 30 mm 라벨지에서는 QR 과 오른쪽·아래 줄이 라벨지 밖으로 나갔다(실기 HT800
 *   2026-09-14). 셸은 대지 크기 줄만 단말 설정으로 바꿀 뿐 좌표는 건드리지 않는다
 *   (`apps/pop/src/main/label-media.ts`) — 좌표를 규격에 맞출 자리는 여기다.
 *
 * ⛔ **대지·갭·방향 줄은 여기서 정본이 아니다.** 셸이 보내기 직전에 그 단말의 용지 설정으로
 *    갈아 끼운다. 여기 적는 것은 셸 밖에서 읽힐 때를 위한 기본값이다.
 *
 * ⛔ **QR 에는 LOT 번호만 싣는다.** 모바일이 스캔한 값을 그대로 LOT 번호로 읽는다 — 다른 칸을
 *    덧붙이면 스캔이 전부 「없는 LOT」이 된다.
 *
 * ⚠ **품명은 싣지 않는다.** 내장 글꼴 `"0"` 은 한글을 찍지 못한다 — 품명이 한글이면 깨진
 *   글자가 찍힌다. 품번·LOT·수량만으로 식별이 된다.
 */

import type { LabelBitmap } from '../../patterns/label/bitmap';
import { tsplBitmapCommand } from '../../patterns/label/tspl-bitmap';

/** 203 dpi 를 그대로 나눈 점 수. */
const dots = (millimetres: number): number => Math.round((millimetres / 25.4) * 203);

const WIDTH = dots(80);
const HEIGHT = dots(30);
/**
 * 사방 4 mm 는 비운다.
 *
 * ⛔ **3 mm 로 줄이지 않는다.** 3 mm 로 짰을 때 QR 윗변·오른쪽 끝이 라벨지 가장자리에 붙었고,
 *    프린터가 급지 위치를 조금만 달리 잡아도 잘렸다(실기 HT800 2026-09-15 · 사용자 사진).
 */
const MARGIN = dots(4);

/**
 * 가로는 **좌우 4 mm 같게** 짠다(사용자 지시 2026-09-19 · omf-all-around#35).
 *
 * ⚠ 9/15 HT800 실기에서 오른쪽으로 치우쳐 2.5 mm 왼쪽으로 당겼으나, 그 판이 왼쪽에 너무 붙어
 *   1 mm 로 줄였다가 다시 좌우 같게 되돌렸다. 한쪽으로 치우쳐 찍히면 이 두 값부터 본다.
 */
const LEFT = MARGIN;
const RIGHT = MARGIN;

/**
 * 세로는 **2 mm 위로 올려** 짠다 — 위 2 mm · 아래 6 mm(사용자 지시 2026-09-15 · 실기 두 차례 확인 뒤
 * 1 mm 씩 올렸다).
 *
 * ⚠ 위 여백이 가장 얇은 자리다. 라벨지·기종이 바뀌어 QR 윗변이 잘리면 이 값부터 본다.
 */
const SHIFT_UP = dots(2);
const TOP = MARGIN - SHIFT_UP;
const BOTTOM = MARGIN + SHIFT_UP;

/** 글줄 높이 — 내장 글꼴은 point 를 203 dpi 로 옮긴 높이로 찍힌다. */
const lineHeight = (point: number): number => Math.ceil(point * (203 / 72));

const FONT = '0';

/** 203 dpi 에서 이 아래는 읽히지 않는다(MES 라벨 표준 사양 §4.2). */
const MIN_POINT = 7;

/** QR 한 칸 점 수. 4 점(0.5 mm)이면 현장 스캐너가 읽는다. */
const QR_CELL = 4;

/**
 * QR 한 변의 점 수 — **LOT 번호 길이로 버전을 어림한다**(오류 정정 M · 바이트 모드).
 *
 * ⚠ 실제 버전은 프린터가 정한다. 어림이 작으면 글줄과 겹치므로 큰 쪽으로 기운다.
 */
const qrSide = (content: string): number => {
  const capacities = [14, 26, 42, 62, 84, 106];
  const index = capacities.findIndex((capacity) => content.length <= capacity);
  const version = index === -1 ? capacities.length + 1 : index + 1;

  return (17 + version * 4) * QR_CELL;
};

/**
 * TSPL 따옴표 안에 넣을 값.
 *
 * ⛔ **따옴표·역슬래시가 살아 있으면 명령이 갈라진다.** 인쇄할 수 없는 글자(한글 포함)는 `?` 로
 *    바꾼다 — 프린터가 엉뚱한 바이트를 명령으로 읽지 않게 한다.
 */
export const escapeTspl = (value: string): string =>
  value
    .replace(/[^\x20-\x7e]/gu, '?')
    .replace(/\\/gu, '\\\\')
    .replace(/"/gu, '\\"');

/** 내장 글꼴 자폭 어림 — point 의 0.5 배를 203 dpi 로 옮긴다(셸 `tspl-label.ts` 와 같은 어림). */
const widthAt = (content: string, point: number): number =>
  content.length * point * 0.5 * (203 / 72);

/** 폭에 들어가는 가장 큰 크기. 7pt 아래로는 줄이지 않는다. */
const fit = (content: string, point: number, available: number): number => {
  let chosen = point;

  while (chosen > MIN_POINT && widthAt(content, chosen) > available) chosen -= 1;

  return chosen;
};

/**
 * 그래도 안 들어가는 글자는 잘라 끝에 `~` 를 남긴다.
 *
 * ⛔ **넘치게 두지 않는다.** TSPL 은 잘라 주지 않아 옆 칸·QR 위로 겹쳐 찍힌다.
 */
const clip = (content: string, point: number, available: number): string => {
  const room = Math.floor(available / (point * 0.5 * (203 / 72)));

  return content.length <= room ? content : `${content.slice(0, Math.max(room - 1, 1))}~`;
};

/** 자리를 잡은 글줄 하나 — `point` 는 칸에 맞춰 줄인 뒤의 크기, `content` 는 자른 뒤의 글이다. */
export interface LotLabelText {
  x: number;
  y: number;
  point: number;
  content: string;
}

const placeText = (
  x: number,
  y: number,
  point: number,
  content: string,
  available: number,
): LotLabelText => {
  const size = fit(content, point, available);

  return { x, y, point: size, content: clip(content, size, available) };
};

const text = ({ x, y, point, content }: LotLabelText): string =>
  `TEXT ${String(x)},${String(y)},"${FONT}",0,${String(point)},${String(point)},"${escapeTspl(content)}"`;

/** 왼쪽 칸에 세울 글줄 하나. `point` 는 바라는 크기이고, 칸을 넘치면 줄여 찍는다. */
export interface LotLabelRow {
  point: number;
  content: string;
}

/**
 * 80 × 30 mm 한 장 — **여백·QR 자리·글줄 칸은 여기가 정본이다.**
 *
 * ⭐ **라벨 종류가 달라도 배치는 같다**(사용자 지시 2026-09-16 — 생산 LOT 라벨을 「테스트 용지
 *   인쇄와 동일한 본문 배치」로). 위 상수들은 HT800 실기에서 사진을 보며 맞춘 값이라, 종류마다
 *   따로 베껴 두면 다음에 한쪽만 고쳐져 조용히 갈라진다. 종류가 정하는 것은 **글줄과 QR 내용**뿐이다.
 *
 * ```
 * MATERIAL LOT  #1                          ┌────┐
 * ITEM ES0602-00062                         │ QR │
 * QTY 10000 EA                              │    │
 * LOT ES0602-00062|10000|260914|100330|0001 └────┘
 * RCV IB-0001
 * ```
 *
 * ⚠ 글줄을 QR 아래 전폭으로 내리지 않는다 — 전폭 줄이 오른쪽 여백까지 닿아 함께 잘렸다.
 */
export interface LotLabelLayout {
  width: number;
  height: number;
  texts: LotLabelText[];
  qr: { x: number; y: number; side: number; cell: number; content: string };
}

/**
 * 80 × 30 mm 한 장의 **자리** — TSPL 명령과 저장용 그림이 같은 자리를 쓴다.
 *
 * ⭐ 명령(`buildLotLabel`)과 그림(포장 라벨 `packing-label-image`)이 자리를 따로 셈하면
 *   「종이와 그림」이 갈린다(사용자 지시 2026-09-17 — 그림도 종이와 같은 배치로).
 */
export const layoutLotLabel = (rows: readonly LotLabelRow[], qrContent: string): LotLabelLayout => {
  const side = qrSide(qrContent);
  const qrX = WIDTH - RIGHT - side;
  const qrY = Math.round((HEIGHT - side) / 2) - SHIFT_UP;
  const column = qrX - LEFT - dots(2);

  /* 남는 세로 공간을 줄 사이에 고르게 나눈다 — 위아래 여백 안에서 끝난다. */
  const used = rows.reduce((sum, row) => sum + lineHeight(row.point), 0);
  const spacing = Math.floor((HEIGHT - TOP - BOTTOM - used) / Math.max(rows.length - 1, 1));

  let y = TOP;
  const texts = rows.map((row) => {
    const line = placeText(LEFT, y, row.point, row.content, column);
    y += lineHeight(row.point) + spacing;

    return line;
  });

  return {
    width: WIDTH,
    height: HEIGHT,
    texts,
    qr: { x: qrX, y: qrY, side, cell: QR_CELL, content: qrContent },
  };
};

export const buildLotLabel = (rows: readonly LotLabelRow[], qrContent: string): string => {
  const { texts, qr } = layoutLotLabel(rows, qrContent);

  return [
    `SIZE 80 mm,30 mm`,
    'GAP 2 mm,0 mm',
    'DIRECTION 1',
    'REFERENCE 0,0',
    'CLS',
    ...texts.map(text),
    `QRCODE ${String(qr.x)},${String(qr.y)},M,${String(qr.cell)},A,0,M2,"${escapeTspl(qr.content)}"`,
    'PRINT 1,1',
    '',
  ].join('\r\n');
};

/** 글 한 줄을 `fontPx` 높이로 그린 점판. 그릴 수 없으면 `null` — 그 줄은 TEXT(`?`)로 남는다. */
export type LotLabelRasterizer = (
  text: string,
  fontPx: number,
) => (LabelBitmap & { rise?: number }) | null;

export interface LotLabelBytesOptions {
  /**
   * 주면 **ASCII 밖 글자가 든 줄만** 이것으로 그려 `BITMAP` 으로 보낸다. 없으면 모든 줄이 TEXT 다.
   *
   * ⭐ 기본은 끔이다 — 자재·생산 LOT 라벨은 결정 17(못 그리는 글자는 `?`)을 그대로 따른다.
   *    이것을 켜는 것은 창고 적재 위치 라벨뿐이다(사용자 지시 2026-09-18 · omf-all-around#9).
   */
  rasterizeNonAscii?: LotLabelRasterizer;
}

const NON_ASCII = /[^\x20-\x7e]/u;

const encodeAscii = (value: string): Uint8Array =>
  Uint8Array.from(value, (char) => char.charCodeAt(0));

/**
 * 글줄 하나를 칸 폭(`available`) 안에 드는 그림으로 — 내장 글꼴과 같은 높이(point → 203dpi)에서
 * 시작해 7pt 까지 줄이고, 그래도 넘치면 뒤를 잘라 `~` 를 남긴다(TEXT 줄의 `clip` 과 같은 규약).
 *
 * ⛔ **칸을 넘기지 않는다** — 넘치면 QR·오른쪽 여백 위로 찍힌다.
 */
const rasterizeInColumn = (
  rasterize: LotLabelRasterizer,
  content: string,
  point: number,
  available: number,
): (LabelBitmap & { rise?: number }) | null => {
  for (let size = point; size >= MIN_POINT; size -= 1) {
    const drawn = rasterize(content, lineHeight(size));

    if (drawn === null) return null;
    if (drawn.width <= available) return drawn;
  }

  for (let length = content.length - 1; length > 0; length -= 1) {
    const drawn = rasterize(`${content.slice(0, length)}~`, lineHeight(MIN_POINT));

    if (drawn === null) return null;
    if (drawn.width <= available) return drawn;
  }

  return null;
};

/**
 * 80 × 30 mm 한 장을 **바이트로** 짠다 — `rasterizeNonAscii` 가 없거나 모든 줄이 ASCII 면
 * `buildLotLabel` 을 인코딩한 것과 **바이트까지 같다.**
 *
 * ⭐ 그림으로 바뀌는 것은 ASCII 밖 글자가 든 **그 줄만**이다. 여백·줄 자리·QR·TEXT 줄은
 *    `layoutLotLabel` 그대로다. 셸은 `BITMAP` 자료를 적힌 길이로 건너뛰고 바이트를 그대로
 *    보낸다(`apps/pop/src/main/label-media.ts` · 파일은 `latin1` 로 읽고 쓴다) — 셸은 고치지 않는다.
 *
 * ⚠ `BITMAP` 흑백(비트 0 = 검은 점)은 HT800 실기에서 아직 확인 전이다(`patterns/label/tspl-bitmap`).
 */
export const buildLotLabelBytes = (
  rows: readonly LotLabelRow[],
  qrContent: string,
  options: LotLabelBytesOptions = {},
): Uint8Array => {
  const rasterize = options.rasterizeNonAscii;

  if (rasterize === undefined) return encodeAscii(buildLotLabel(rows, qrContent));

  const { texts, qr } = layoutLotLabel(rows, qrContent);
  /* 글줄 칸의 폭 — `layoutLotLabel` 의 `column` 과 같은 식이다. */
  const available = qr.x - LEFT - dots(2);
  const parts: Uint8Array[] = [
    encodeAscii(
      ['SIZE 80 mm,30 mm', 'GAP 2 mm,0 mm', 'DIRECTION 1', 'REFERENCE 0,0', 'CLS', ''].join('\r\n'),
    ),
  ];

  texts.forEach((line, index) => {
    /* 그림은 «자르기 전» 글로 그린다 — TEXT 용 자르기는 내장 글꼴 폭 어림이라 한글에 맞지 않는다. */
    const original = rows[index]?.content ?? line.content;
    const drawn = NON_ASCII.test(original)
      ? rasterizeInColumn(rasterize, original, rows[index]?.point ?? line.point, available)
      : null;

    parts.push(
      drawn === null
        ? encodeAscii(`${text(line)}\r\n`)
        : /* 판 위에 둔 여백(`rise`)만큼 올려 찍어 글자 윗변은 TEXT 줄과 같은 자리에 둔다. */
          tsplBitmapCommand(drawn, line.x, Math.max(0, line.y - (drawn.rise ?? 0))),
    );
    if (drawn !== null) parts.push(encodeAscii('\r\n'));
  });

  parts.push(
    encodeAscii(
      [
        `QRCODE ${String(qr.x)},${String(qr.y)},M,${String(qr.cell)},A,0,M2,"${escapeTspl(qr.content)}"`,
        'PRINT 1,1',
        '',
      ].join('\r\n'),
    ),
  );

  const bytes = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let offset = 0;

  for (const part of parts) {
    bytes.set(part, offset);
    offset += part.length;
  }

  return bytes;
};

/** 수량 줄에 적을 말 — 단위를 모르면 숫자만 적는다. */
export const lotLabelQty = (qty: number, uomCode: string | null): string =>
  uomCode === null ? String(qty) : `${String(qty)} ${uomCode}`;

export interface MaterialLotLabelFields {
  itemCode: string;
  lotNo: string;
  qty: number;
  /** 단위 코드. 모르면 `null` — 수량만 적는다. */
  uomCode: string | null;
  /** 발행 회차. */
  issueSeq: number;
  inboundReceiptNo: string;
}

/** 자재 LOT 라벨 한 장. 배치는 `buildLotLabel` 이 정하고 여기는 글줄만 고른다. */
export const buildMaterialLotLabel = (fields: MaterialLotLabelFields): string =>
  buildLotLabel(
    [
      { point: 8, content: `MATERIAL LOT  #${String(fields.issueSeq)}` },
      { point: 10, content: `ITEM ${fields.itemCode}` },
      { point: 10, content: `QTY ${lotLabelQty(fields.qty, fields.uomCode)}` },
      { point: 8, content: `LOT ${fields.lotNo}` },
      { point: 8, content: `RCV ${fields.inboundReceiptNo}` },
    ],
    fields.lotNo,
  );
