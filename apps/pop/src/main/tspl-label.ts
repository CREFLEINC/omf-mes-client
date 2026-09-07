/**
 * 라벨 서식 — **「MES 라벨 표준 사양」대로 TSPL 을 짠다**(#831).
 *
 * ⚠ **이것은 설계 결정 18 의 예외다.** 결정 18 은 「출력물은 서버가 만들고 클라이언트는 다시
 *   만들지 않는다」이고 #831 도 갈래 B(셸이 조립)를 「쓰지 않는다」로 적었다. 사용자 지시로
 *   여기에 서식을 둔다 — 서버가 명령형을 내려 줄 계약 자리가 아직 없어 실기에서 라벨을 볼
 *   길이 이것뿐이기 때문이다. **서버 경로는 지우지 않았다**(`silent-print.ts` 의 명령형 분기).
 *   계약이 열리면 그쪽이 정본이 되고 이 파일은 진단·시험용으로 남는다.
 *
 * ⛔ **좌표와 글자 크기를 「확정」으로 읽지 않는다.** 사양서가 「실제 좌표 및 글자 크기는
 *    TTP-247 실물 출력 검증 후 최종 보정한다」고 못 박았다. 여기 숫자는 사양서의 권장 범위
 *    안에서 고른 **첫 값**이고, 실기 샘플을 보고 고치는 것이 정상 절차다.
 *
 * ⚠ **명령은 CRLF 로 끝난다.** TSPL 은 줄 단위로 읽고 `\n` 만으로는 끊기지 않는 기종이 있다.
 */

/** 203 dpi = 8 dots/mm. 좌표를 mm 로 생각하고 dot 으로 적을 때 쓴다. */
const DOTS_PER_MM = 8;

/**
 * 내장 폰트 이름. **`"0"` 하나로 통일한다** — 사양서 §4.1·§4.2. 크기를 point 로 지정할 수
 * 있는 scalable font 라 인쇄 영역이 좁은 라벨에 맞는다.
 */
const FONT = '0';

/** 사양서 §4.2 — 203 dpi 인쇄 품질을 고려해 이 아래로 줄이지 않는다. */
const MIN_POINT = 7;

export class LabelTooSmallError extends Error {
  constructor(point: number) {
    super(`글자를 ${String(point)}pt 로 줄일 수 없다 — 최소 ${String(MIN_POINT)}pt 다`);
    this.name = 'LabelTooSmallError';
  }
}

/**
 * 글자 한 줄.
 *
 * ⚠ **덧말과 값을 한 덩이로 적는다.** 사양서는 덧말(Field Caption)에 더 작은 크기를 주지만,
 *   내장 scalable font 는 글자 폭을 우리가 잴 수 없어 값을 어디서 시작할지 계산할 수 없다.
 *   예시 그림도 `PART NO.: PRT-000001` 처럼 한 줄로 붙여 놓았다 — 그 모양을 따르고, 나누는
 *   것은 실기 샘플로 좌표를 보정할 때 함께 본다.
 */
function text(x: number, y: number, point: number, content: string): string {
  if (point < MIN_POINT) throw new LabelTooSmallError(point);

  return `TEXT ${String(x)},${String(y)},"${FONT}",0,${String(point)},${String(point)},"${escapeTspl(content)}"`;
}

/**
 * TSPL 문자열에 넣을 값을 다듬는다.
 *
 * ⛔ **따옴표가 살아 있으면 명령이 갈라진다.** 품명·납품처에 큰따옴표가 섞이면 그 뒤가 명령으로
 *    읽혀 엉뚱한 것이 찍히거나 프린터가 멈춘다. 역슬래시도 TSPL 의 벗어나기 문자라 함께 막는다.
 */
export function escapeTspl(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

/** DataMatrix 한 덩이. 사양서 §10 — 2D 바코드는 DataMatrix 를 기본으로 적용한다. */
function dataMatrix(x: number, y: number, size: number, content: string): string {
  return `DMATRIX ${String(x)},${String(y)},${String(size)},${String(size)},"${escapeTspl(content)}"`;
}

function head(widthMm: number, heightMm: number): string[] {
  return [
    `SIZE ${String(widthMm)} mm,${String(heightMm)} mm`,
    'GAP 2 mm,0 mm',
    'DIRECTION 1',
    'CLS',
  ];
}

const finish = (lines: readonly string[]): string => [...lines, 'PRINT 1'].join('\r\n') + '\r\n';

/** 사양서 §5.2 — 표준 LOT 라벨의 필수 항목. */
export interface LotLabelFields {
  /** RM · PM · WIP · FG · RTN. */
  type: string;
  /** OK · HOLD · NG · CONCESSION · REWORK. */
  status: string;
  partNo: string;
  /** 승인된 영문 축약 품명(사양서 §9). 셸이 줄이지 않는다. */
  partName: string;
  lotNo: string;
  qty: string;
  /** EA · KG · M · SET 등. */
  uom: string;
  /** `MFG DT` · `RCV DT` · `QC DT` 중 무엇인가. */
  dateCaption: string;
  /** `YY-MM-DD HH:mm`. 서식은 부르는 쪽이 맞춘다 — 셸이 시각을 해석하지 않는다. */
  dateTime: string;
  /** 유형별 추가 항목(사양서 §5.3) — `WO NO.: ...` 처럼 통째로 준다. */
  extra?: string;
}

/**
 * 표준 LOT 라벨 80 × 30 mm (사양서 §5).
 *
 * 시각적 우선순위는 사양서 §5.4 를 따른다 — 품번 · 수량 · 상태가 가장 크고, 그다음이 LOT,
 * 품명, 일시 순이다.
 */
export function buildLotLabel(fields: LotLabelFields): string {
  /* 12mm 각. 좁으면 모듈이 작아져 스캔이 떨어진다 — 오른쪽에 남는 폭만큼 준다. */
  const matrix = 12 * DOTS_PER_MM;

  return finish([
    ...head(80, 30),
    text(16, 14, 11, fields.type),
    text(110, 14, 11, fields.status),
    text(16, 56, 11, `PART NO.: ${fields.partNo}`),
    text(16, 98, 9, fields.partName),
    text(16, 132, 10, `LOT NO.: ${fields.lotNo}`),
    text(16, 168, 11, `QTY: ${fields.qty} ${fields.uom}`),
    text(16, 206, 8, `${fields.dateCaption}: ${fields.dateTime}`),
    ...(fields.extra === undefined ? [] : [text(250, 206, 8, fields.extra)]),
    dataMatrix(470, 46, matrix, lotBarcode(fields)),
  ]);
}

/** 사양서 §6.2 — 출하용 라벨의 필수 항목. */
export interface ShippingLabelFields {
  type: string;
  status: string;
  shipTo: string;
  customerPartNo: string;
  partNo: string;
  partName: string;
  lotNo: string;
  qty: string;
  uom: string;
  /** `07/40` 처럼 순번/전체. */
  boxNo: string;
  shipmentNo: string;
  /** `YY-MM-DD HH:mm`. */
  shipDateTime: string;
}

/**
 * 출하용 라벨 100 × 60 mm (사양서 §6·§7).
 *
 * ⭐ **고객 품번과 수량이 가장 크다** — 오품·오수량 출하를 멀리서 육안으로 잡기 위한 것이다
 *   (사양서 §7).
 */
export function buildShippingLabel(fields: ShippingLabelFields): string {
  /* 출하 라벨은 멀리서도 스캔한다 — 대지가 큰 만큼 넉넉히 준다. */
  const matrix = 18 * DOTS_PER_MM;

  return finish([
    ...head(100, 60),
    text(16, 16, 13, fields.type),
    text(150, 16, 13, `STATUS: ${fields.status}`),
    text(16, 64, 11, `SHIP TO: ${fields.shipTo}`),
    text(16, 108, 15, `CUSTOMER P/N: ${fields.customerPartNo}`),
    text(16, 162, 12, `PART NO.: ${fields.partNo}`),
    text(16, 204, 11, fields.partName),
    text(16, 246, 12, `LOT NO.: ${fields.lotNo}`),
    text(16, 292, 15, `QTY: ${fields.qty} ${fields.uom}`),
    text(330, 296, 11, `BOX NO.: ${fields.boxNo}`),
    text(16, 348, 10, `SHIPMENT NO.: ${fields.shipmentNo}`),
    text(16, 388, 10, `SHIP DT: ${fields.shipDateTime}`),
    dataMatrix(570, 120, matrix, shippingBarcode(fields)),
  ]);
}

/**
 * 바코드에 싣는 것(사양서 §10).
 *
 * ⛔ **상세 이력을 싣지 않는다.** MES 조회에 필요한 최소 식별정보만 넣는다 — 라벨은 찍히는
 *    순간 굳고, 나머지는 스캔해서 MES 에서 본다.
 * ⚠ 구분자 `|` 가 값 안에 들어가면 읽는 쪽이 칸을 잘못 센다. 값에서 빼고 싣는다.
 */
function lotBarcode(fields: LotLabelFields): string {
  return join(['L1', fields.type, fields.partNo, fields.lotNo, fields.qty, fields.uom]);
}

function shippingBarcode(fields: ShippingLabelFields): string {
  return join([
    'S1',
    fields.shipmentNo,
    fields.customerPartNo,
    fields.lotNo,
    fields.qty,
    fields.uom,
    /* 예시가 `07/40` 중 앞자리만 싣는다 — 박스 순번이 식별에 쓰이는 값이다. */
    fields.boxNo.split('/')[0] ?? fields.boxNo,
  ]);
}

const join = (parts: readonly string[]): string =>
  parts.map((part) => part.replace(/\|/g, ' ')).join('|');

/**
 * 실기 시험용 견본. 자리와 크기를 눈으로 재려고 두는 값이다.
 *
 * ⛔ **실제 품번·거래처를 넣지 않는다.** 이 저장소는 공개다 — 견본이라도 실 운영 값이
 *    들어가면 그대로 공개된다. 길이만 실물과 비슷하게 맞춘 합성값을 쓴다.
 */
export const SAMPLE_LOT: LotLabelFields = {
  type: 'WIP',
  status: 'OK',
  partNo: 'PRT-000001',
  partName: 'SAMPLE PART BLK',
  lotNo: '000000-A01',
  qty: '1000',
  uom: 'EA',
  dateCaption: 'MFG DT',
  dateTime: '26-08-05 14:25',
  extra: 'WO NO.: WO000000001',
};

export const SAMPLE_SHIPPING: ShippingLabelFields = {
  type: 'SHIP',
  status: 'RELEASED',
  shipTo: 'SAMPLE BUYER CO., LTD.',
  customerPartNo: 'CPN-000001',
  partNo: 'FGD-000001',
  partName: 'SAMPLE ASSY',
  lotNo: '000000-B01',
  qty: '100',
  uom: 'EA',
  boxNo: '07/40',
  shipmentNo: 'SHP-000001',
  shipDateTime: '26-08-05 17:40',
};
