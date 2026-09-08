/**
 * 라벨을 **프린터 제어 명령(TSPL)** 으로 낸다 — 그림이 아니라 명령으로 내려주는 자리다.
 *
 * ⛔ **제품 코드가 아니다.** 실제로는 서버가 그리고(설계 결정 18), 계약에 명령형 형식이 서면
 *    (#891) 그쪽이 정본이 된다. 여기 있는 것은 그 서버가 없는 동안 **같은 명령**을 내주는
 *    대역이며 씨앗 서버 안에서만 쓰인다.
 *
 * ⚠ **짝이 있다 — `apps/pop/src/main/tspl-label.ts`.** 그쪽은 실기 진단(`Ctrl+Alt+P`)이 쓰고
 *   이쪽은 화면 발행이 쓴다. **둘이 같은 라벨을 내야 한다**(사용자 지시 2026-09-08) — 좌표를
 *   고칠 일이 생기면 두 파일을 같은 변경으로 함께 고친다.
 */

/**
 * 라벨지(대지) 크기 — 단말에 «걸려 있는» 용지다. 서식 크기와 다른 축이며, 어긋나게 적으면
 * 프린터가 오류를 낸다(사용자 확인 2026-09-08). 짝은 `apps/pop/src/main/tspl-label.ts` 다.
 */
const MEDIA_WIDTH_MM = 100;
const MEDIA_HEIGHT_MM = 60;

/** 203 dpi 를 그대로 나눈 점 수. 그림 쪽(`label-canvas.mjs` 의 `mm`)과 같은 반올림이다. */
const dots = (millimetres) => Math.round((millimetres / 25.4) * 203);

/** 내장 폰트 이름. 사양서 §4.1·§4.2 — `"0"` 하나로 통일한다. */
const FONT = '0';

/** 값에 따옴표·역슬래시가 섞이면 그 뒤가 명령으로 읽힌다. */
const escapeTspl = (value) => String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"');

const text = (x, y, point, content) =>
  `TEXT ${x},${y},"${FONT}",0,${point},${point},"${escapeTspl(content)}"`;

const dataMatrix = (x, y, size, content) =>
  `DMATRIX ${x},${y},${size},${size},"${escapeTspl(content)}"`;

const head = (widthMm, heightMm) => [
  `SIZE ${widthMm} mm,${heightMm} mm`,
  'GAP 2 mm,0 mm',
  'DIRECTION 1',
  'CLS',
];

const finish = (lines) => [...lines, 'PRINT 1'].join('\r\n') + '\r\n';


/**
 * 폭에 맞는 글자 크기를 고른다 — 짝은 `apps/pop/src/main/tspl-label.ts` 의 `fit` 이다.
 * TSPL 은 넘쳐도 잘라 주지 않아 옆 칸과 2D 바코드 위로 찍힌다(실측 2026-09-08).
 */
const MIN_POINT = 7;

const fits = (content, point, available) =>
  String(content).length * point * 0.5 * (203 / 72) <= available;

function fit(content, point, available) {
  const widthAt = (pt) => String(content).length * pt * 0.5 * (203 / 72);

  let chosen = point;

  while (chosen > MIN_POINT && widthAt(chosen) > available) chosen -= 1;

  return chosen;
}

/**
 * 7pt 까지 줄여도 안 맞는 값을 **잘라 낸다** — 짝은 셸 쪽 `clip` 이다.
 * 넘치게 두면 옆 칸 위로 겹쳐 찍혀 둘 다 못 읽는다(실측 2026-09-08 · 실기).
 */
function clip(content, point, available) {
  const value = String(content);
  const room = Math.floor(available / (point * 0.5 * (203 / 72)));

  return value.length <= room ? value : `${value.slice(0, Math.max(room - 1, 1))}~`;
}

/** 구분자가 값에 섞이면 읽는 쪽이 칸을 잘못 센다. */
const join = (parts) => parts.map((part) => String(part).replace(/\|/g, ' ')).join('|');

/**
 * 표준 LOT 라벨 80 × 30 mm — 사양서 §5.4 예시를 **실제 값에 맞게 조정한 배치.**
 * 좌표·크기는 `apps/pop/src/main/tspl-label.ts` 와 같아야 한다(같은 라벨을 내는 짝이다).
 *
 * ⚠ 수량이 LOT 이 아니라 품명 아래에 선다 — 34자리 자재LOT 이 오면 한 줄에 둘 수 없다.
 *   자세한 사정은 짝 파일 머리말에 있다.
 */
export function renderLotTspl(values) {
  const pad = dots(2);
  const left = pad + dots(1.5);
  const width = dots(80);
  const height = dots(30);
  const matrix = dots(12);
  const matrixX = width - pad - matrix;
  const matrixY = pad + dots(1);

  /*
   * ⭐ **한 칸으로 내려 쓴다** — 좌·우로 나누면 긴 상태 코드가 품번 위로 겹쳐 찍힌다.
   *    자세한 사정은 짝 파일(`apps/pop/src/main/tspl-label.ts`) 머리말에 있다.
   */
  const wTop = matrixX - left - dots(2);
  const wBelow = width - left - pad;

  const rows = { head: 14, partNo: 48, partName: 90, qty: 122, lot: 164, date: 200 };

  const headText = `${values.type}  ${values.status}`;
  const partNoText = `PART NO.: ${values.partNo}`;
  const lotText = `LOT NO.: ${values.lotNo}`;
  const qtyText = `QTY: ${values.qty}`;
  const dateText = `MFG DT: ${values.mfgDt}`;

  const partNoPoint = fit(partNoText, 12, wTop);
  const qtyPoint = fit(qtyText, 12, wBelow);
  const headPoint = fit(headText, 10, wTop);
  const lotPoint = fit(lotText, 10, wBelow);
  const namePoint = fit(values.partName, 9, wTop);
  const capPoint = fit(dateText, 8, wBelow / 2);

  return finish([
    ...head(MEDIA_WIDTH_MM, MEDIA_HEIGHT_MM),
    `BOX 0,0,${width - 1},${height - 1},2`,
    text(left, rows.head, headPoint, clip(headText, headPoint, wTop)),
    text(left, rows.partNo, partNoPoint, clip(partNoText, partNoPoint, wTop)),
    text(left, rows.partName, namePoint, clip(values.partName, namePoint, wTop)),
    text(left, rows.qty, qtyPoint, clip(qtyText, qtyPoint, wBelow)),
    text(left, rows.lot, lotPoint, clip(lotText, lotPoint, wBelow)),
    text(left, rows.date, capPoint, clip(dateText, capPoint, wBelow / 2)),
    ...(values.extra === undefined
      ? []
      : [
          text(
            left + Math.round(wBelow / 2),
            rows.date,
            capPoint,
            clip(values.extra, capPoint, wBelow / 2),
          ),
        ]),
    dataMatrix(
      matrixX,
      matrixY,
      matrix,
      join(['L1', values.type, values.partNo, values.lotNo, values.qty]),
    ),
  ]);
}

/** 출하용 라벨 100 × 60 mm. 고객 품번과 수량이 가장 크다(사양서 §7). */
export function renderShippingTspl(values) {
  const matrix = dots(18);

  return finish([
    ...head(MEDIA_WIDTH_MM, MEDIA_HEIGHT_MM),
    `BOX 0,0,${dots(100) - 1},${dots(60) - 1},3`,
    text(16, 16, 13, `${values.type}  ${values.status}`),
    text(16, 64, 11, `SHIP TO: ${values.shipTo}`),
    text(16, 108, 15, `CUSTOMER P/N: ${values.customerPartNo}`),
    text(16, 162, 12, `PART NO.: ${values.partNo}`),
    text(16, 204, 11, values.partName),
    text(16, 246, 12, `LOT NO.: ${values.lotNo}`),
    text(16, 292, 15, `QTY: ${values.qty}`),
    text(330, 296, 11, `BOX NO.: ${values.boxNo}`),
    text(16, 348, 10, `SHIPMENT NO.: ${values.shipmentNo}`),
    text(16, 388, 10, `SHIP DT: ${values.shipDt}`),
    dataMatrix(
      570,
      120,
      matrix,
      join(['S1', values.shipmentNo, values.customerPartNo, values.lotNo, values.qty]),
    ),
  ]);
}
