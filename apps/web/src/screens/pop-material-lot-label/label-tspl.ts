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
 * ⭐ **자재 LOT 라벨은 품명·공급처·입하일도 싣는다**(사용자 승인 2026-10-24 · omf-all-around#184).
 *   예전에는 내장 글꼴 `"0"` 이 한글을 못 찍어 품명을 뺐다. 이제 ASCII 밖 글자가 든 줄만 POP 의
 *   OS 글꼴로 그려 `BITMAP` 으로 찍는다 — 위치 라벨(omf-all-around#9)과 같은 길이다. 배치는 아래
 *   `layoutMaterialLotLabel` 이 따로 갖고, 여백 상수는 이 파일의 것을 같이 쓴다.
 *   ⚠ 생산 LOT·출하 라벨은 그대로다 — 결정 17(못 그리는 글자는 `?`)을 따른다.
 */

import type { LabelBitmap } from '../../patterns/label/bitmap';
import { canDrawGlyph, rasterizeTextWithFont } from '../../patterns/label/text';
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
 * QR 한 변의 칸 수 — **LOT 번호 길이로 버전을 어림한다**(오류 정정 M · 바이트 모드).
 *
 * ⚠ 실제 버전은 프린터가 정한다. 어림이 작으면 글줄과 겹치므로 큰 쪽으로 기운다.
 */
const qrModules = (content: string): number => {
  const capacities = [14, 26, 42, 62, 84, 106];
  const index = capacities.findIndex((capacity) => content.length <= capacity);
  const version = index === -1 ? capacities.length + 1 : index + 1;

  return 17 + version * 4;
};

/** QR 한 변의 점 수(4 점 칸). */
const qrSide = (content: string): number => qrModules(content) * QR_CELL;

/** 한 장의 첫 줄들 — 대지·갭·방향은 셸이 그 단말 용지로 갈아 끼운다(위 ⛔). */
const HEADER = ['SIZE 80 mm,30 mm', 'GAP 2 mm,0 mm', 'DIRECTION 1', 'REFERENCE 0,0', 'CLS'];

const qrCommand = (qr: { x: number; y: number; cell: number; content: string }): string =>
  `QRCODE ${String(qr.x)},${String(qr.y)},M,${String(qr.cell)},A,0,M2,"${escapeTspl(qr.content)}"`;

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
 *
 * ⚠ **자재 LOT 라벨은 이 배치를 떠났다**(사용자 승인 2026-10-24 · omf-all-around#184 — QR 왼쪽 ·
 *   글줄 오른쪽). 위치·생산 LOT·포장·출고 QR 라벨은 그대로 이것을 쓴다. 자재 쪽도 여백(`LEFT`·
 *   `RIGHT`·`TOP`·`BOTTOM`)은 이 파일의 상수를 같이 쓴다 — 실기 값은 여전히 한 곳이다.
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

  return [...HEADER, ...texts.map(text), qrCommand(qr), 'PRINT 1,1', ''].join('\r\n');
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
   * ⭐ 기본은 끔이다 — 생산 LOT 라벨은 결정 17(못 그리는 글자는 `?`)을 그대로 따른다.
   *    이것을 켜는 것은 창고 적재 위치 라벨이다(사용자 지시 2026-09-18 · omf-all-around#9).
   *    자재 LOT 라벨도 그림을 쓰지만 이 함수가 아니라 자기 배치(`buildMaterialLotLabelBytes`)로 간다.
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
  const parts: Uint8Array[] = [encodeAscii([...HEADER, ''].join('\r\n'))];

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

  parts.push(encodeAscii([qrCommand(qr), 'PRINT 1,1', ''].join('\r\n')));

  return concatBytes(parts);
};

const concatBytes = (parts: readonly Uint8Array[]): Uint8Array => {
  const bytes = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let offset = 0;

  for (const part of parts) {
    bytes.set(part, offset);
    offset += part.length;
  }

  return bytes;
};

/**
 * 한글 줄을 그릴 글꼴 목록 — 설치본(Windows)의 기본 한글 글꼴을 먼저 부른다.
 *
 * ⭐ 글꼴 파일을 싣지 않는다(통합 담당 승인 2026-09-18) — 맑은 고딕은 Windows 기본 글꼴이다.
 *    맥·리눅스 개발 단말은 뒤의 이름으로 잡힌다. 베트남어 같은 라틴 확장 글자도 이 글꼴들이 그린다.
 *
 * ⛔ **목록은 여기 하나다.** 위치 라벨(omf-all-around#9)과 자재 LOT 라벨(omf-all-around#184)이
 *    함께 쓴다. 위치 라벨 파일에 있던 것을 옮겨 왔다 — 그쪽이 이 파일을 가져다 쓰므로, 거기 두면
 *    두 파일이 서로를 가져온다. 둘로 베껴 두면 한쪽만 고쳐져 두 라벨의 글자가 갈린다.
 */
export const HANGUL_FONT_FAMILY =
  '"Malgun Gothic", "맑은 고딕", "Apple SD Gothic Neo", "Noto Sans CJK KR", "Noto Sans KR", sans-serif';

/** 이 단말이 한글을 진짜 글자로 그리는가 — 글꼴이 없으면 네모가 그려진다(`canDrawGlyph`). */
export const canDrawHangul = (): boolean => canDrawGlyph('가', HANGUL_FONT_FAMILY);

/* 윗변 위로 넘치는 한글 획을 담는다(`headroom`) — 끄면 윗획이 깎였다(HT800 실기 2026-09-18). */
export const rasterizeHangul: LotLabelRasterizer = (content, fontPx) =>
  rasterizeTextWithFont(content, fontPx, HANGUL_FONT_FAMILY, true);

/** 수량 줄에 적을 말 — 단위를 모르면 숫자만 적는다. */
export const lotLabelQty = (qty: number, uomCode: string | null): string =>
  uomCode === null ? String(qty) : `${String(qty)} ${uomCode}`;

/**
 * 천 단위 쉼표 — 소수는 받은 그대로 둔다(1500 → `1,500` · 1500.25 → `1,500.25`).
 *
 * ⛔ `toLocaleString` 을 쓰지 않는다 — 단말 언어를 따라 쉼표·점이 뒤바뀌고(vi-VN 은 `1.500`)
 *    소수 넷째 자리에서 반올림된다. 같은 LOT 은 어느 단말에서 찍어도 같은 글이어야 한다.
 */
const groupThousands = (qty: number): string =>
  String(qty).replace(/^-?\d+/u, (whole) => whole.replace(/\B(?=(?:\d{3})+$)/gu, ','));

/** 비었거나 공백뿐인 값은 없는 것으로 본다 — 빈 줄로 남기지 않고 줄째 뺀다. */
const present = (value: string | null): value is string => value !== null && value.trim() !== '';

/** 자재 LOT 라벨의 수량 줄 — `1,500 EA`. 단위를 모르면 숫자만 적는다. */
export const materialLotLabelQty = (qty: number, uomCode: string | null): string =>
  present(uomCode) ? `${groupThousands(qty)} ${uomCode}` : groupThousands(qty);

/**
 * 자재 LOT 라벨에 실을 값 — **보이는 글은 부르는 쪽이 짜서 넘긴다**(공급처 `이름 (코드)` · 입하
 * `입하 2026-10-22` 처럼). 여기는 자리만 정한다.
 *
 * ⛔ `null` 인 칸은 줄째 뺀다 — 「알 수 없음」 같은 자리 메움 글을 찍지 않는다. 라벨에 찍힌 글은
 *    현장이 값으로 읽는다.
 */
export interface MaterialLotLabelFields {
  itemCode: string;
  /** 품명 — 한국어·베트남어일 수 있다(그 줄은 그림으로 찍힌다). */
  itemName: string | null;
  /** QR 과 맨 아래 줄에 싣는다. */
  lotNo: string;
  /** 받은 수 그대로 — 쉼표는 여기서 넣고 소수는 건드리지 않는다. */
  qty: number;
  /** 단위 코드. 모르면 `null` — 수량만 적는다. */
  uomCode: string | null;
  /** 발행 회차 — 자재 라벨 오른쪽 위 `#n`. IQC 라벨에는 찍지 않는다. */
  issueSeq: number;
  /** 공급처 — 짜 둔 글(`이름 (코드)`). ASCII 밖 글자일 수 있다. */
  supplier: string | null;
  /** 입하 — 짜 둔 글(`입하 2026-10-22`). 수량 줄 오른쪽 끝에 맞춘다. */
  receipt: string | null;
  /** `iqc` 면 `#n` 자리에 검은 바탕 흰 글자 `IQC` 를 찍는다(omf-all-around#110). */
  kind: 'material' | 'iqc';
}

/** 글줄이 무엇을 싣는가 — 미리보기·시험이 줄을 이름으로 찾는다. */
export type MaterialLotLabelField =
  'itemCode' | 'issueSeq' | 'iqc' | 'itemName' | 'qty' | 'receipt' | 'supplier' | 'lotNo';

/**
 * 자리를 잡은 글줄 하나.
 *
 * - `x`·`y` 는 **왼쪽 윗변**이다 — 오른쪽 맞춤 글도 TSPL 에는 왼쪽 끝을 준다(`x = 오른쪽 끝 − width`).
 * - `point` 는 칸에 맞춰 줄인 뒤의 크기, `content` 는 자른 뒤의 **원문**이다(`?` 로 바꾸기 전).
 * - `width` 는 `measure` 가 잰 폭이다 — 그림 줄이면 그린 폭, TEXT 줄이면 내장 글꼴 어림.
 */
export interface MaterialLotLabelText extends LotLabelText {
  field: MaterialLotLabelField;
  width: number;
  align: 'left' | 'right';
}

export interface MaterialLotLabelLayout {
  width: number;
  height: number;
  /** 글줄 칸 — 왼쪽은 QR 오른쪽 + 2 mm, 오른쪽은 오른쪽 여백. 어떤 글도 이 밖에 찍히지 않는다. */
  column: { left: number; right: number };
  texts: MaterialLotLabelText[];
  qr: { x: number; y: number; side: number; cell: number; content: string };
  /** IQC 라벨에서 뒤집을 상자 — `TEXT "IQC"` 를 찍은 뒤 `REVERSE` 로 검은 바탕 흰 글자를 만든다. */
  reverse: { x: number; y: number; width: number; height: number } | null;
}

/**
 * 글 한 줄을 `point` 로 찍었을 때의 폭(점).
 *
 * ⭐ 오른쪽 맞춤(입하 글)은 폭을 알아야 왼쪽 끝을 정한다. 그림으로 찍힐 줄은 내장 글꼴 어림이
 *    맞지 않아 그린 폭을 받아야 한다 — 그래서 재는 길을 밖에서 받는다.
 */
export type MaterialLotLabelMeasure = (content: string, point: number) => number;

/** 내장 글꼴 폭 어림 — TEXT 줄. 소수는 올려 오른쪽 끝을 넘지 않는 쪽으로 기운다. */
const measureText: MaterialLotLabelMeasure = (content, point) => Math.ceil(widthAt(content, point));

/**
 * 자재 LOT 라벨 QR 한 칸 — **5 점**. LOT 번호(30자 안팎)면 버전 3 · 29칸이라 한 변 145 점(약 18 mm)
 * 이다(승인 도면 2026-10-24). 다른 라벨의 4 점(`QR_CELL`)보다 크게 찍어 멀리서도 읽히게 한다.
 *
 * ⚠ 5 점으로 세로 칸(위 2 mm ~ 아래 6 mm, 176 점)을 넘는 긴 내용(버전 5 이상 · 63자 이상)이면
 *   4 점으로 내린다 — 현장 스캐너가 읽는 값이고, 여백을 넘기지 않는 쪽을 고른다.
 */
const MATERIAL_QR_CELL = 5;

/**
 * 줄마다 바라는 크기(pt). 칸을 넘치면 7pt 까지 줄이고 그래도 넘치면 자른다.
 *
 * 품번·수량은 현장이 먼저 읽는 줄이라 크게, LOT 번호는 QR 이 싣고 사람은 대조만 하므로 작게
 * 둔다(승인 도면 2026-10-24). 내장 글꼴 `"0"` 은 원래 굵은 글꼴이라 품번에 굵기를 따로 주지 않는다.
 */
const MATERIAL_POINT: Record<MaterialLotLabelField, number> = {
  itemCode: 14,
  issueSeq: 8,
  iqc: 12,
  itemName: 9,
  qty: 14,
  receipt: 8,
  supplier: 8,
  lotNo: 8,
};

/** 같은 줄의 왼쪽 글과 오른쪽 맞춤 글 사이 — QR 과 글줄 칸 사이와 같은 2 mm. */
const ASIDE_GAP = dots(2);

/** IQC 검은 상자 안 좌우 여백. */
const IQC_PAD = dots(1);

/**
 * 줄 사이를 이보다 벌리지 않는다 — 빠진 줄(`null`)이 있어도 글줄 묶음이 흩어지지 않고 QR 옆에
 * 모여 있게. 다섯 줄이 다 서면 남는 세로가 줄 사이 6 점뿐이라 이 값에 닿지 않는다.
 */
const MAX_LINE_GAP = dots(2);

interface FittedLine {
  point: number;
  content: string;
  width: number;
}

/**
 * 폭에 들어가게 — `point` 에서 7pt 까지 줄이고, 그래도 넘치면 7pt 에서 뒤를 잘라 `~` 를 남긴다
 * (`fit`·`clip`·`rasterizeInColumn` 과 같은 규약).
 *
 * ⛔ **넘치게 두지 않는다** — TSPL 은 잘라 주지 않아 QR·오른쪽 글·여백 위로 겹쳐 찍힌다.
 *
 * ⚠ 자를 자리는 재 보며 찾는다 — 그림 줄은 글자마다 폭이 달라(비례 글꼴) 셈으로 못 정한다. 폭은
 *   글자를 더할수록 늘기만 하므로 반씩 좁혀 찾는다 — 긴 품명 하나에 그림을 수십 번 그리지 않게.
 */
const fitLine = (
  content: string,
  point: number,
  available: number,
  measure: MaterialLotLabelMeasure,
): FittedLine => {
  for (let size = point; size >= MIN_POINT; size -= 1) {
    const width = measure(content, size);

    if (width <= available) return { point: size, content, width };
  }

  /* 서로게이트 쌍을 가르지 않게 글자(코드 포인트) 단위로 자른다. */
  const glyphs = Array.from(content);
  const cut = (length: number): string => `${glyphs.slice(0, length).join('')}~`;
  let low = 1;
  let high = glyphs.length - 1;

  while (low < high) {
    const middle = Math.ceil((low + high) / 2);

    if (measure(cut(middle), MIN_POINT) <= available) low = middle;
    else high = middle - 1;
  }

  const clipped = cut(low);

  return { point: MIN_POINT, content: clipped, width: measure(clipped, MIN_POINT) };
};

/**
 * 자재 LOT 라벨 80 × 30 mm 한 장의 **자리** — TSPL 명령(`buildMaterialLotLabel`·`…Bytes`)과 화면
 * 미리보기가 같은 자리를 쓴다.
 *
 * ```
 * ┌────┐ ITEM-0001 (품번 14pt)                      #1  ← 자재: 회차 8pt · IQC: 검은 상자 IQC
 * │ QR │ 품명 (9pt)
 * │18mm│ 1,500 EA (수량 14pt)          입하 2026-10-22  ← 입하 8pt · 오른쪽 끝 · 바닥 맞춤
 * └────┘ 공급처 (100000) (8pt)
 *        ITEM-0001|1500|261022|100000|0001 (LOT 8pt)
 * ```
 *
 * ⭐ **QR 이 왼쪽, 글줄이 오른쪽이다**(사용자 승인 2026-10-24 · omf-all-around#184). 글줄 칸은
 *   «실제 QR 한 변»에서 시작한다 — LOT 이 길어 QR 이 커지면 칸이 좁아지고 글이 줄거나 잘린다.
 *   겹치지는 않는다.
 *
 * ⭐ 남는 세로는 `layoutLotLabel` 처럼 줄 사이에 고르게 나눈다. 빠진 줄이 있으면 사이를 2 mm
 *   까지만 벌리고 묶음을 세로 가운데에 둔다.
 *
 * ⛔ 오른쪽 맞춤 글(회차·입하·IQC)이 «먼저» 자리를 잡고, 같은 줄 왼쪽 글(품번·수량)이 남은 폭에
 *    맞춘다 — 둘이 겹쳐 찍히지 않게. 입하 글은 칸의 절반까지만 쓴다(수량이 먼저다).
 *
 * `measure` — 줄 폭을 재는 길. 생략하면 내장 글꼴 어림(TEXT 줄)이다. 그림으로 찍힐 줄까지 종이와
 * 같게 재려면 `materialLotLabelMeasure(rasterize)` 를 넘긴다.
 */
export const layoutMaterialLotLabel = (
  fields: MaterialLotLabelFields,
  measure: MaterialLotLabelMeasure = measureText,
): MaterialLotLabelLayout => {
  const band = HEIGHT - TOP - BOTTOM;
  const modules = qrModules(fields.lotNo);
  const cell = modules * MATERIAL_QR_CELL <= band ? MATERIAL_QR_CELL : QR_CELL;
  const side = modules * cell;
  const qr = { x: LEFT, y: TOP + Math.floor((band - side) / 2), side, cell, content: fields.lotNo };
  const left = qr.x + side + dots(2);
  const right = WIDTH - RIGHT;
  const column = right - left;

  const row = (field: MaterialLotLabelField, content: string) => ({
    field,
    point: MATERIAL_POINT[field],
    content,
  });
  const rows = [
    row('itemCode', fields.itemCode),
    present(fields.itemName) ? row('itemName', fields.itemName) : null,
    row('qty', materialLotLabelQty(fields.qty, fields.uomCode)),
    present(fields.supplier) ? row('supplier', fields.supplier) : null,
    row('lotNo', fields.lotNo),
  ].filter((each) => each !== null);

  const used = rows.reduce((sum, each) => sum + lineHeight(each.point), 0);
  const spacing = Math.min(Math.floor((band - used) / Math.max(rows.length - 1, 1)), MAX_LINE_GAP);

  /** 줄 오른쪽 끝에 붙는 글 — 바닥을 그 줄 바닥에 맞춘다(작은 글이 큰 글 위쪽에 떠 보이지 않게). */
  const hang = (
    field: MaterialLotLabelField,
    content: string,
    top: number,
    rowPoint: number,
    room: number,
  ): MaterialLotLabelText => {
    const fitted = fitLine(content, MATERIAL_POINT[field], room, measure);

    return {
      field,
      x: right - fitted.width,
      y: top + lineHeight(rowPoint) - lineHeight(fitted.point),
      point: fitted.point,
      content: fitted.content,
      width: fitted.width,
      align: 'right',
    };
  };

  const texts: MaterialLotLabelText[] = [];
  let reverse: MaterialLotLabelLayout['reverse'] = null;
  let y = TOP + Math.floor((band - used - spacing * (rows.length - 1)) / 2);

  for (const each of rows) {
    const hung: MaterialLotLabelText[] = [];
    /* 왼쪽 글이 끝나야 하는 자리 — 오른쪽 맞춤 글이 있으면 그 왼쪽 2 mm 앞이다. */
    let until = right;

    if (each.field === 'itemCode' && fields.kind === 'iqc') {
      const point = MATERIAL_POINT.iqc;
      const inner = measure('IQC', point);
      const box = {
        x: right - inner - IQC_PAD * 2,
        y,
        width: inner + IQC_PAD * 2,
        height: lineHeight(each.point),
      };

      reverse = box;
      hung.push({
        field: 'iqc',
        x: box.x + IQC_PAD,
        y: y + Math.floor((box.height - lineHeight(point)) / 2),
        point,
        content: 'IQC',
        width: inner,
        align: 'right',
      });
      until = box.x - ASIDE_GAP;
    } else if (each.field === 'itemCode') {
      const seq = hang(
        'issueSeq',
        `#${String(fields.issueSeq)}`,
        y,
        each.point,
        Math.floor(column / 4),
      );

      hung.push(seq);
      until = seq.x - ASIDE_GAP;
    } else if (each.field === 'qty' && present(fields.receipt)) {
      const receipt = hang('receipt', fields.receipt, y, each.point, Math.floor(column / 2));

      hung.push(receipt);
      until = receipt.x - ASIDE_GAP;
    }

    const fitted = fitLine(each.content, each.point, until - left, measure);

    texts.push(
      {
        field: each.field,
        x: left,
        y,
        point: fitted.point,
        content: fitted.content,
        width: fitted.width,
        align: 'left',
      },
      ...hung,
    );
    y += lineHeight(each.point) + spacing;
  }

  return { width: WIDTH, height: HEIGHT, column: { left, right }, texts, qr, reverse };
};

const reverseCommand = (box: NonNullable<MaterialLotLabelLayout['reverse']>): string =>
  `REVERSE ${String(box.x)},${String(box.y)},${String(box.width)},${String(box.height)}`;

/**
 * 한 장의 명령 차례 — 머리 → 글줄 → IQC 글자 → `REVERSE` → QR → `PRINT`.
 *
 * ⛔ **IQC 글자와 `REVERSE` 는 글줄 뒤(QR 앞)다.** `REVERSE` 는 그 순간 상자 안에 있는 것만
 *    뒤집고, `BITMAP` 은 흰 점까지 덮어쓴다(방식 0) — 뒤집은 뒤에 그림 줄이 상자에 닿으면 상자가
 *    지워진다.
 *
 * `line` 이 글줄 하나를 명령으로 바꾼다 — TEXT 한 줄이거나 `BITMAP` 바이트다.
 */
const materialCommands = <T>(
  layout: MaterialLotLabelLayout,
  line: (each: MaterialLotLabelText) => T,
): (string | T)[] => [
  ...HEADER,
  ...layout.texts.filter((each) => each.field !== 'iqc').map(line),
  ...layout.texts.filter((each) => each.field === 'iqc').map(line),
  ...(layout.reverse === null ? [] : [reverseCommand(layout.reverse)]),
  qrCommand(layout.qr),
  'PRINT 1,1',
  '',
];

/**
 * 자재 LOT 라벨 한 장 — **TEXT 만 쓰는 판**(ASCII 밖 글자는 결정 17 대로 `?`). 셸 진단의 견본
 * 인쇄(`sample-print`)가 쓴다. 자리는 `layoutMaterialLotLabel` 그대로다.
 *
 * ⭐ 모든 줄이 ASCII 면 실제 발행(`buildMaterialLotLabelBytes`)과 바이트까지 같다.
 *
 * ⚠ IQC 라벨은 `heading` 인자(`IQC LOT`)가 아니라 `kind: 'iqc'` 로 고른다 — 옛 다섯 줄 양식
 *   (`MATERIAL LOT #n` · `ITEM` · `QTY` · `LOT` · `RCV`)은 2026-10-24 개편으로 걷었다.
 */
export const buildMaterialLotLabel = (fields: MaterialLotLabelFields): string =>
  materialCommands(layoutMaterialLotLabel(fields), text).join('\r\n');

type LotLabelRaster = ReturnType<LotLabelRasterizer>;

/** 같은 글·크기는 한 번만 그린다 — 자리 셈(폭 재기)과 명령 짜기가 같은 판을 쓴다. */
const drawOnce = (rasterize: LotLabelRasterizer) => {
  const drawn = new Map<string, LotLabelRaster>();

  return (content: string, point: number): LotLabelRaster => {
    const key = `${String(point)}\u0000${content}`;

    if (!drawn.has(key)) drawn.set(key, rasterize(content, lineHeight(point)));

    return drawn.get(key) ?? null;
  };
};

const measureDrawn =
  (draw: (content: string, point: number) => LotLabelRaster): MaterialLotLabelMeasure =>
  (content, point) => {
    if (!NON_ASCII.test(content)) return measureText(content, point);

    const drawn = draw(content, point);

    /* 못 그리면 그 줄은 TEXT(`?`)로 찍힌다 — 내장 글꼴 어림으로 잰다. */
    return drawn === null ? measureText(content, point) : drawn.width;
  };

/**
 * 인쇄(`buildMaterialLotLabelBytes`)와 같은 셈의 `measure` — ASCII 밖 글자가 든 줄은 그린 폭으로,
 * 나머지는 내장 글꼴 어림으로 잰다. 화면 미리보기가 종이와 같은 자리를 보려면 이것을 넘긴다.
 */
export const materialLotLabelMeasure = (
  rasterize: LotLabelRasterizer | undefined,
): MaterialLotLabelMeasure =>
  rasterize === undefined ? measureText : measureDrawn(drawOnce(rasterize));

/**
 * 자재 LOT 라벨 한 장을 **바이트로** — ASCII 밖 글자가 든 줄만 그림(`BITMAP`)으로 찍는다(사용자
 * 승인 2026-10-24 · omf-all-around#184 · 위치 라벨 omf-all-around#9 와 같은 길). 실제 발행이 쓴다.
 *
 * ⭐ 그림이 없거나(`rasterize` 없음 · 못 그림) 모든 줄이 ASCII 면 `buildMaterialLotLabel` 을 인코딩한
 *    것과 **바이트까지 같다.** 자리·QR·TEXT 줄은 `layoutMaterialLotLabel` 그대로다.
 *
 * ⭐ 그림은 판 위에 둔 여백(`rise`)만큼 올려 찍어 글자 윗변을 TEXT 줄과 같은 자리에 둔다 — 한글
 *    윗획이 깎이지 않게(HT800 실기 2026-09-18).
 *
 * `rasterize` 는 시험이 손으로 만든 점판을 넣는 자리다. 생략하면 이 단말의 Canvas·한글 글꼴을
 * 쓰고, 한글을 못 그리는 단말이면 켜지 않는다(결정 17 대로 `?`).
 *
 * ⚠ `BITMAP` 은 흰 점까지 덮어쓴다(방식 0). 판 위 여백(`rise`)이 줄 사이(다섯 줄이면 6 점)보다
 *   크면 윗줄 아래 끝 몇 점을 덮는다 — 대개 빈 자리지만, 줄 크기·간격을 바꾸면 실기에서 본다.
 */
export const buildMaterialLotLabelBytes = (
  fields: MaterialLotLabelFields,
  rasterize: LotLabelRasterizer | undefined = canDrawHangul() ? rasterizeHangul : undefined,
): Uint8Array => {
  if (rasterize === undefined) return encodeAscii(buildMaterialLotLabel(fields));

  const draw = drawOnce(rasterize);
  const commands = materialCommands(
    layoutMaterialLotLabel(fields, measureDrawn(draw)),
    (line): string | Uint8Array => {
      const drawn = NON_ASCII.test(line.content) ? draw(line.content, line.point) : null;

      return drawn === null
        ? text(line)
        : tsplBitmapCommand(drawn, line.x, Math.max(0, line.y - (drawn.rise ?? 0)));
    },
  );
  const crlf = encodeAscii('\r\n');

  return concatBytes(
    commands.flatMap((command, index) => [
      typeof command === 'string' ? encodeAscii(command) : command,
      ...(index < commands.length - 1 ? [crlf] : []),
    ]),
  );
};
