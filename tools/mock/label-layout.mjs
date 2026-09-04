/**
 * 라벨 서식 — **사양서 「MES 라벨 표준 사양」의 배치를 그대로 옮긴 것.**
 *
 * ⛔ **제품 코드가 아니다.** 실제 라벨은 서버가 그린다(설계 결정 18). 여기 있는 것은 그 서버가
 *    없는 동안 **같은 자리에서 같은 모양**을 내주는 대역이며 씨앗 서버 안에서만 쓰인다.
 *    서버가 그리기 시작하면 이 파일은 걷힌다.
 *
 * 사양 요지 — 203dpi · 흑백 · 영문/숫자만 · 날짜 `YY-MM-DD HH:mm` · 2D 바코드는 오른쪽.
 * 라벨 둘: 출하용 100×60mm, 표준 LOT 80×30mm.
 */
import {
  createCanvas,
  drawMatrixPlaceholder,
  drawText,
  mm,
  scaleFor,
  strokeRect,
  textHeight,
  textWidth,
} from './label-canvas.mjs';

/** 사양 §3·§5 의 권장 크기(pt). 값과 이름표의 크기가 다르다 — 값이 크다. */
const PT = {
  type: 12,
  status: 12,
  keyValue: 16,
  strongValue: 13,
  normal: 10,
  small: 9,
};

/**
 * 주어진 폭에 들어가는 배율을 찾는다.
 *
 * ⛔ **넘치게 두지 않는다.** 사양이 「긴 문자열을 과도하게 축소하지 않는다」고 했으나, 그것은
 *    사전에 정의된 축약명을 쓰라는 뜻이지 **넘쳐서 옆 칸을 덮어도 된다**는 뜻이 아니다.
 *    실측에서 품명과 납품처가 2D 바코드 자리 위로 올라탔다.
 */
function fitScale(text, pt, available, floor = 2) {
  let scale = scaleFor(pt);

  while (scale > floor && textWidth(text, scale) > available) scale -= 1;

  return scale;
}

/** 이름표와 값을 한 줄에. 값이 이름표보다 크므로 **아래를 맞춘다**. */
function labelledLine(canvas, x, baseline, label, value, labelPt, valuePt, available) {
  const labelScale = label === '' ? 0 : fitScale(label, labelPt, available);
  const labelPart = label === '' ? 0 : textWidth(label, labelScale) + labelScale * 3;
  const valueScale = fitScale(value, valuePt, Math.max(available - labelPart, labelScale * 10));
  const height = Math.max(label === '' ? 0 : textHeight(labelScale), textHeight(valueScale));

  if (label !== '') {
    drawText(canvas, label, x, baseline + height - textHeight(labelScale), labelScale);
  }

  drawText(canvas, value, x + labelPart, baseline + height - textHeight(valueScale), valueScale);

  return height;
}

/**
 * 출하용 라벨 100×60mm(사양 §4·§6).
 *
 * ⚠ 고객 품번과 수량을 가장 크게 둔다 — 오품·오수량 출하를 눈으로 재확인하기 위한 배치다.
 */
export function renderShippingLabel(values) {
  const width = mm(100);
  const height = mm(60);
  const canvas = createCanvas(width, height);
  const pad = mm(3);

  strokeRect(canvas, 0, 0, width, height, 3);

  const matrixSize = mm(26);
  const matrixX = width - pad - matrixSize - mm(1);
  const matrixY = pad + mm(3);
  drawMatrixPlaceholder(canvas, matrixX, matrixY, matrixSize, values.seed ?? 1);

  const left = pad + mm(2);
  /** 2D 바코드 옆을 지나는 줄이 쓸 수 있는 폭. 이 값을 넘기면 글자를 줄인다. */
  const columnWidth = matrixX - left - mm(2);
  /** 바코드 아래로 내려간 줄은 라벨 폭 전체를 쓴다. */
  const fullWidth = width - left - pad - mm(1);
  let y = pad + mm(1.5);
  /* 아홉 줄이 60mm 를 고르게 나눠 쓰도록 벌린다 — 아래가 비면 라벨이 잘린 것처럼 보인다. */
  const gap = mm(2.9);

  /* 머리줄 — 라벨 유형과 출하 상태. 멀리서도 읽히도록 둘 다 크게 둔다. */
  const typeScale = scaleFor(PT.type);
  drawText(canvas, values.type, left, y, typeScale);
  drawText(canvas, `STATUS: ${values.status}`, left + mm(18), y, scaleFor(PT.status));
  y += textHeight(typeScale) + gap;

  y +=
    labelledLine(canvas, left, y, 'SHIP TO:', values.shipTo, PT.small, PT.normal, columnWidth) +
    gap;
  y +=
    labelledLine(
      canvas,
      left,
      y,
      'CUSTOMER P/N:',
      values.customerPartNo,
      PT.small,
      PT.keyValue,
      columnWidth,
    ) + gap;
  y +=
    labelledLine(
      canvas,
      left,
      y,
      'PART NO.:',
      values.partNo,
      PT.small,
      PT.strongValue,
      columnWidth,
    ) + gap;
  y += labelledLine(canvas, left, y, '', values.partName, PT.normal, PT.normal, columnWidth) + gap;
  y +=
    labelledLine(canvas, left, y, 'LOT NO.:', values.lotNo, PT.small, PT.strongValue, columnWidth) +
    gap;

  /* 수량은 가장 큰 값. 박스 번호는 같은 줄 오른쪽에 붙인다(사양 예시). */
  const qtyWidth = Math.round(columnWidth * 0.55);
  const qtyHeight = labelledLine(
    canvas,
    left,
    y,
    'QTY:',
    values.qty,
    PT.small,
    PT.keyValue,
    qtyWidth,
  );
  const boxText = `BOX NO.: ${values.boxNo}`;
  const boxScale = fitScale(boxText, PT.normal, columnWidth - qtyWidth);
  drawText(
    canvas,
    boxText,
    left + qtyWidth + mm(2),
    y + qtyHeight - textHeight(boxScale),
    boxScale,
  );
  y += qtyHeight + gap;

  /* 아래 두 줄은 2D 바코드 밑을 지나 라벨 폭 전체를 쓴다. */
  y +=
    labelledLine(
      canvas,
      left,
      y,
      'SHIPMENT NO.:',
      values.shipmentNo,
      PT.small,
      PT.normal,
      fullWidth,
    ) + gap;
  labelledLine(canvas, left, y, 'SHIP DT:', values.shipDt, PT.small, PT.normal, fullWidth);

  return canvas;
}

/**
 * 표준 LOT 라벨 80×30mm(사양 §3-2).
 *
 * ⚠ 좁아서 이름표를 짧게 쓴다. 우선순위는 PART NO. → QTY → STATUS → LOT NO. 순이다.
 */
export function renderLotLabel(values) {
  const width = mm(80);
  const height = mm(30);
  const canvas = createCanvas(width, height);
  const pad = mm(2);

  strokeRect(canvas, 0, 0, width, height, 2);

  const matrixSize = mm(19);
  const matrixX = width - pad - matrixSize;
  drawMatrixPlaceholder(canvas, matrixX, pad + mm(1), matrixSize, values.seed ?? 1);

  const left = pad + mm(1.5);
  let y = pad + mm(0.5);
  const gap = mm(1);

  const headScale = scaleFor(PT.normal);
  drawText(canvas, `${values.type}  ${values.status}`, left, y, headScale);
  y += textHeight(headScale) + gap;

  const columnWidth = matrixX - left - mm(2);
  const fullWidth = width - left - pad - mm(1);

  y +=
    labelledLine(
      canvas,
      left,
      y,
      'PART NO.:',
      values.partNo,
      PT.small,
      PT.strongValue,
      columnWidth,
    ) + gap;
  y += labelledLine(canvas, left, y, '', values.partName, PT.small, PT.small, columnWidth) + gap;
  y +=
    labelledLine(canvas, left, y, 'LOT NO.:', values.lotNo, PT.small, PT.normal, columnWidth) + gap;
  y += labelledLine(canvas, left, y, 'QTY:', values.qty, PT.small, PT.normal, columnWidth) + gap;
  labelledLine(canvas, left, y, 'MFG DT:', values.mfgDt, PT.small, PT.small, fullWidth);

  return canvas;
}
