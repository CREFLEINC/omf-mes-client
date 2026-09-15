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
 * 가로 좌표는 **2.5 mm 왼쪽으로 당겨** 짠다 — 왼쪽 1.5 mm · 오른쪽 6.5 mm.
 *
 * ⭐ HT800 실기에서 4 mm 로 좌우를 같게 짜니 찍힌 것이 오른쪽으로 치우쳤다 — 왼쪽 약 6.5 mm ·
 *   오른쪽 약 2 mm(사진 실측 2026-09-15 · 사용자가 「왼쪽으로」를 지시). 당겨 짜야 라벨지
 *   위에서 좌우가 고르게 선다. 세로는 치우침이 없어 그대로 둔다.
 */
const SHIFT_LEFT = dots(2.5);
const LEFT = MARGIN - SHIFT_LEFT;
const RIGHT = MARGIN + SHIFT_LEFT;

/**
 * 세로는 **1 mm 위로 올려** 짠다 — 위 3 mm · 아래 5 mm(사용자 지시 2026-09-15 · 실기 확인 뒤).
 *
 * ⛔ 더 올리지 않는다. 위 3 mm 에 QR 윗변이 붙어 잘렸던 판은 가로가 치우친 채였지만, 위쪽 여유는
 *    이 이상 줄이면 같은 자리가 다시 위험하다.
 */
const SHIFT_UP = dots(1);
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

const text = (x: number, y: number, point: number, content: string, available: number): string => {
  const size = fit(content, point, available);

  return `TEXT ${String(x)},${String(y)},"${FONT}",0,${String(size)},${String(size)},"${escapeTspl(clip(content, size, available))}"`;
};

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

/**
 * 80 × 30 mm 한 장. 모든 글줄은 QR 왼쪽 칸에 서고, QR 은 오른쪽에 위아래 가운데로 선다.
 *
 * ```
 * MATERIAL LOT  #1                          ┌────┐
 * ITEM ES0602-00062                         │ QR │
 * QTY 10000 EA                              │    │
 * LOT ES0602-00062|10000|260914|100330|0001 └────┘
 * RCV IB-0001
 * ```
 *
 * ⚠ LOT 줄을 QR 아래 전폭으로 내리지 않는다 — 전폭 줄이 오른쪽 여백까지 닿아 함께 잘렸다.
 */
export const buildMaterialLotLabel = (fields: MaterialLotLabelFields): string => {
  const side = qrSide(fields.lotNo);
  const qrX = WIDTH - RIGHT - side;
  const qrY = Math.round((HEIGHT - side) / 2) - SHIFT_UP;
  const column = qrX - LEFT - dots(2);

  const qty =
    fields.uomCode === null ? String(fields.qty) : `${String(fields.qty)} ${fields.uomCode}`;

  const rows: { point: number; content: string }[] = [
    { point: 8, content: `MATERIAL LOT  #${String(fields.issueSeq)}` },
    { point: 10, content: `ITEM ${fields.itemCode}` },
    { point: 10, content: `QTY ${qty}` },
    { point: 8, content: `LOT ${fields.lotNo}` },
    { point: 8, content: `RCV ${fields.inboundReceiptNo}` },
  ];

  /* 남는 세로 공간을 줄 사이에 고르게 나눈다 — 위아래 여백 안에서 끝난다. */
  const used = rows.reduce((sum, row) => sum + lineHeight(row.point), 0);
  const spacing = Math.floor((HEIGHT - TOP - BOTTOM - used) / (rows.length - 1));

  let y = TOP;
  const drawn = rows.map((row) => {
    const line = text(LEFT, y, row.point, row.content, column);
    y += lineHeight(row.point) + spacing;

    return line;
  });

  return [
    `SIZE 80 mm,30 mm`,
    'GAP 2 mm,0 mm',
    'DIRECTION 1',
    'REFERENCE 0,0',
    'CLS',
    ...drawn,
    `QRCODE ${String(qrX)},${String(qrY)},M,${String(QR_CELL)},A,0,M2,"${escapeTspl(fields.lotNo)}"`,
    'PRINT 1,1',
    '',
  ].join('\r\n');
};
