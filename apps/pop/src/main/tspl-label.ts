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

/**
 * 라벨지(대지) 크기 — **단말에 «걸려 있는» 용지다.**
 *
 * ⭐ **서식 크기와 다른 축이다.** 사양서는 표준 LOT 라벨을 80 × 30 mm 로 그렸지만, 현장에
 * 걸린 라벨지는 100 × 60 mm 다(사용자 확인 2026-09-08). `SIZE` 에 서식 크기를 적으면 프린터가
 * 걸린 용지와 어긋난 대지를 잡아 **오류를 낸다** — 그래서 대지는 «걸린 용지»로 잡고, 그 안에
 * 사양서 배치를 그대로 그린다.
 *
 * ⚠ 용지를 바꾸면 이 값을 바꾼다. 프린터 설정에서 읽어 오는 자리가 계약에 서면 그쪽이 정본이 된다.
 */
const MEDIA_WIDTH_MM = 100;
const MEDIA_HEIGHT_MM = 60;

/** 203 dpi = 8 dots/mm. 좌표를 mm 로 생각하고 dot 으로 적을 때 쓴다. */
const DOTS_PER_MM = 8;

/**
 * 203 dpi 를 그대로 나눈 점 수.
 *
 * ⚠ **`DOTS_PER_MM` 로 갈음하지 않는다.** 8 dots/mm 는 203.2 dpi 라 80mm 에서 한 점이
 *   어긋난다 — 화면 쪽 서식이 203 dpi 로 반올림하므로, 같은 배치를 적으려면 같은 반올림을
 *   써야 한다(`tools/mock/label-canvas.mjs` 의 `mm`).
 */
const dots = (millimetres: number): number => Math.round((millimetres / 25.4) * 203);

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


/**
 * 폭에 맞는 글자 크기를 고른다.
 *
 * ⛔ **TSPL 은 넘쳐도 잘라 주지 않는다.** 그대로 옆 칸과 2D 바코드 위로 찍힌다 — 34자리
 *    자재LOT 번호가 수량 자리를 덮은 것이 실측으로 나왔다(2026-09-08 · 출고 QR 발행).
 *    그림 쪽(`label-canvas`)은 같은 일을 `fitScale` 이 한다.
 *
 * ⚠ **글자 폭은 «재지 못하고 어림한다».** 내장 폰트의 실제 자폭을 셸이 알 수 없다 —
 *   CG Triumvirate Bold Condensed 의 평균 자폭을 point 의 0.5 배로 잡고 203dpi 로 옮긴다.
 *   빠듯하게 맞기보다 한 단계 작게 나오는 쪽으로 기운다.
 *
 * ⛔ **7pt 아래로는 내리지 않는다**(사양서 §4.2). 그 아래는 203dpi 에서 읽히지 않으므로,
 *    더 줄여야 들어갈 글자는 **넘치게 두고** 사람이 보고 알아채게 한다.
 */
function fit(content: string, point: number, available: number): number {
  const widthAt = (pt: number): number => content.length * pt * 0.5 * (203 / 72);

  let chosen = point;

  while (chosen > MIN_POINT && widthAt(chosen) > available) chosen -= 1;

  return chosen;
}

/**
 * 그래도 안 들어가는 글자를 **잘라 낸다.**
 *
 * ⛔ **넘치게 두지 않는다.** 7pt 까지 줄여도 안 맞는 값이 실제로 온다 — 상태 코드가
 *    `INSPECTION_PENDING` 처럼 길게 오면 옆 칸 위로 그대로 찍힌다(실측 2026-09-08 · 실기).
 *    겹쳐 찍힌 라벨은 두 값 다 못 읽지만, 잘린 라벨은 앞부분이라도 읽힌다.
 *
 * ⚠ 잘렸다는 것이 보여야 한다 — 끝에 `~` 를 남겨 「여기서 끊겼다」를 알린다.
 */
function clip(content: string, point: number, available: number): string {
  const per = point * 0.5 * (203 / 72);
  const room = Math.floor(available / per);

  return content.length <= room ? content : `${content.slice(0, Math.max(room - 1, 1))}~`;
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
 * 표준 LOT 라벨 80 × 30 mm — 사양서 §5.4 예시를 **실제 값에 맞게 조정한 배치.**
 *
 * ```
 * WIP  OK      PART NO.: INJ-104852   ┌──────────┐
 *              UPPER HSG BLK          │   DATA   │
 *              QTY: 1,000 EA          │  MATRIX  │
 * LOT NO.: 0001234500000012002607310001230007
 * MFG DT: 26-08-05 14:25   WO NO.: WO260805017
 * ```
 *
 * ⚠ **예시와 다른 곳이 하나 있다 — 수량이 LOT 이 아니라 품명 아래에 선다.** 사양서 예시는
 *   LOT 과 수량을 한 줄에 두지만, 그 예시의 LOT 은 `260805-M12` 처럼 짧다. 자재LOT 은
 *   34자리로 오고(GS1 계열) 그때는 7pt 로 줄여도 수량 자리와 2D 바코드를 덮는다 — TSPL 은
 *   넘쳐도 잘라 주지 않으므로 **겹쳐 찍힌다**(실측 2026-09-08 · 출고 QR 발행).
 *   그래서 **LOT 에 한 줄을 통째로 주고**, 그 줄을 2D 바코드 «아래»로 내렸다.
 *
 * ⚠ **글자 크기는 §5.1 범위를 상한으로 쓰고, 칸에 안 들어가면 줄인다**(7pt 까지 · §4.2).
 *   크기 순서(품번 → 수량 → 상태 → LOT → 품명 → 일시)는 줄이더라도 뒤집히지 않게 눌러 둔다.
 *
 * ⛔ 좌표는 확정이 아니다 — 사양서가 실물 출력 후 보정하라고 못 박았다.
 */
export function buildLotLabel(fields: LotLabelFields): string {
  const pad = dots(2);
  const left = pad + dots(1.5);
  const width = dots(80);
  const height = dots(30);

  /* 2D 바코드 12mm 각 — 오른쪽 위에 앉는다. 글줄은 이 왼쪽까지만 쓴다. */
  const matrix = dots(12);
  const matrixX = width - pad - matrix;
  const matrixY = pad + dots(1);

  /*
   * ⭐ **한 칸으로 내려 쓴다 — 좌·우로 나누지 않는다.**
   *
   * 전에는 왼쪽 19mm 에 유형·상태를, 오른쪽에 품번·품명·수량을 세웠다. 그런데 상태가
   * `INSPECTION_PENDING` 처럼 길게 오면 19mm 에 7pt 로도 들어가지 않아 **품번 위로 그대로
   * 찍혔다**(실측 2026-09-08 · 실기). TSPL 은 넘쳐도 잘라 주지 않는다.
   *
   * 칸을 나누지 않으면 줄마다 폭을 다 쓸 수 있어 **겹칠 자리 자체가 없어진다.**
   */
  const wTop = matrixX - left - dots(2);
  const wBelow = width - left - pad;

  const rows = { head: 14, partNo: 48, partName: 90, qty: 122, lot: 164, date: 200 };

  const headText = `${fields.type}  ${fields.status}`;
  const partNoText = `PART NO.: ${fields.partNo}`;
  const lotText = `LOT NO.: ${fields.lotNo}`;
  const qtyText = `QTY: ${fields.qty} ${fields.uom}`;
  const dateText = `${fields.dateCaption}: ${fields.dateTime}`;

  const partNoPoint = fit(partNoText, 12, wTop);
  const qtyPoint = fit(qtyText, 12, wBelow);
  const headPoint = fit(headText, 10, wTop);
  const lotPoint = fit(lotText, 10, wBelow);
  const namePoint = fit(fields.partName, 9, wTop);
  const capPoint = fit(dateText, 8, wBelow / 2);

  return finish([
    ...head(MEDIA_WIDTH_MM, MEDIA_HEIGHT_MM),
    `BOX 0,0,${String(width - 1)},${String(height - 1)},2`,
    text(left, rows.head, headPoint, clip(headText, headPoint, wTop)),
    text(left, rows.partNo, partNoPoint, clip(partNoText, partNoPoint, wTop)),
    text(left, rows.partName, namePoint, clip(fields.partName, namePoint, wTop)),
    text(left, rows.qty, qtyPoint, clip(qtyText, qtyPoint, wBelow)),
    text(left, rows.lot, lotPoint, clip(lotText, lotPoint, wBelow)),
    text(left, rows.date, capPoint, clip(dateText, capPoint, wBelow / 2)),
    /* 유형별 추가 항목(§5.3) — 일시와 같은 줄의 오른쪽이다. 없으면 그 자리를 비운다. */
    ...(fields.extra === undefined
      ? []
      : [
          text(
            left + Math.round(wBelow / 2),
            rows.date,
            capPoint,
            clip(fields.extra, capPoint, wBelow / 2),
          ),
        ]),
    dataMatrix(matrixX, matrixY, matrix, lotBarcode(fields)),
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
    ...head(MEDIA_WIDTH_MM, MEDIA_HEIGHT_MM),
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
