import { encodeQr } from '@omf-mes/ui';
import { describe, expect, it } from 'vitest';

import { readDot, textDots } from '../../patterns/label/bitmap';
import { toPng } from '../../patterns/label/png';

import { layoutLotLabel } from '../pop-material-lot-label/label-tspl';

import {
  buildGoodsIssueQrLabel,
  drawGoodsIssueQrLabel,
  goodsIssueQrLabelRows,
  renderGoodsIssueQrLabel,
} from './label-image';
import { buildGoodsIssueQrPayload } from './qr-payload';

/**
 * 출고 QR 라벨을 **POP 이 스스로 그린다**(설계 결정 8·9 의 2단계). 서버가 그려 주지 않으므로
 * 틀려도 서버 쪽에서 걸릴 자리가 없다 — 이 감지기들이 유일한 그물이다.
 *
 * ⭐ **점판을 직접 들여다본다.** 캔버스로 그렸다면 「그리기 호출이 갔는가」까지만 잴 수 있는데,
 *    그것은 **찍히지 않은 라벨도 통과시킨다.** 점판은 순수 배열이라 실제로 검은 점이 놓였는지를
 *    묻는다(통합 담당·사용자 승인 2026-09-16 · 캔버스 대신 점판을 쓴 까닭).
 */

const FIELDS = {
  payload: buildGoodsIssueQrPayload({
    goodsIssueLineId: 17,
    goodsIssueNo: 'GI-20260916-0001',
    lineNo: 1,
  }),
  goodsIssueNo: 'GI-20260916-0001',
  lineNo: 1,
  itemCode: 'A5C1M50101',
  lotNo: 'SEED-S230-0003',
  quantity: '100',
  destinationCode: 'S220-WIP',
};

const countDots = (bitmap: ReturnType<typeof drawGoodsIssueQrLabel>): number =>
  bitmap.dots.filter(Boolean).length;

describe('출고 QR 라벨 — 점판', () => {
  it('서식 크기는 203dpi 의 80×30mm 다', () => {
    const bitmap = drawGoodsIssueQrLabel(FIELDS);

    /* 자재 LOT 라벨과 같은 자를 쓴다 — 갈리면 한쪽이 종이를 벗어난다. */
    expect([bitmap.width, bitmap.height]).toEqual([639, 240]);
  });

  it('테두리가 네 변에 선다', () => {
    const bitmap = drawGoodsIssueQrLabel(FIELDS);

    expect(readDot(bitmap, 0, 0)).toBe(true);
    expect(readDot(bitmap, bitmap.width - 1, 0)).toBe(true);
    expect(readDot(bitmap, 0, bitmap.height - 1)).toBe(true);
    expect(readDot(bitmap, bitmap.width - 1, bitmap.height - 1)).toBe(true);
  });

  /*
   * ⭐ **QR 이 실제로 찍혔는지 격자로 확인한다.** 오른쪽 위 구획에 `encodeQr` 가 낸 격자만큼의
   *    검은 점이 있어야 한다 — 「그리기 함수를 불렀다」로는 빈 자리를 잡지 못한다.
   */
  it('오른쪽 위에 QR 격자가 찍힌다', () => {
    const bitmap = drawGoodsIssueQrLabel(FIELDS);
    const matrix = encodeQr(FIELDS.payload);
    const darkModules = matrix.modules.flat().filter(Boolean).length;

    let darkDots = 0;
    for (let y = 0; y < 120; y += 1) {
      for (let x = 480; x < bitmap.width; x += 1) {
        if (readDot(bitmap, x, y)) darkDots += 1;
      }
    }

    /* 칸 하나가 여러 점으로 커지므로 「격자 칸 수보다 많다」가 이 자리에서 셀 수 있는 사실이다. */
    expect(darkDots).toBeGreaterThan(darkModules);
  });

  /*
   * ⛔ **여백(quiet zone)이 없으면 읽히지 않는다.** `encodeQr` 는 격자만 내므로 그리는 쪽이
   *    둬야 한다. 격자 바로 바깥 줄이 비어 있는지로 확인한다.
   */
  it('QR 둘레에 여백이 남는다', () => {
    const bitmap = drawGoodsIssueQrLabel(FIELDS);

    /* 라벨 오른쪽 끝(테두리 안쪽)은 여백이라 비어 있어야 한다. */
    for (let y = 20; y < 100; y += 1) {
      expect(readDot(bitmap, bitmap.width - 3, y)).toBe(false);
    }
  });

  /*
   * ⭐⭐ **그린 격자를 되읽어 원본과 칸 단위로 맞춘다.** 앞의 「점이 많다」는 자리·배율·방향이
   *    틀려도 통과한다 — 이 검사는 **찍힌 그림에서 격자를 다시 찾아** `encodeQr` 가 낸 것과
   *    같은지 묻는다. 라벨을 실제로 스캔하는 일을 시험 안에서 하는 셈이라, QR 이 읽히지 않는
   *    채로 나가는 것을 여기서 막는다.
   *
   * 격자를 «찾는» 방법: 오른쪽 위 구획에서 검은 점의 테두리 상자를 잡는다. QR 은 세 모서리에
   * 위치검출 무늬가 있어 상자가 곧 격자의 범위다.
   */
  it('찍힌 격자를 되읽으면 원본과 같다', () => {
    const bitmap = drawGoodsIssueQrLabel(FIELDS);
    const matrix = encodeQr(FIELDS.payload);

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    /*
     * ⚠ **QR 구획만 본다** — 배치(`layoutLotLabel`)가 준 QR 상자 안쪽. 글줄은 QR 왼쪽 칸에서
     *   끝나므로 이 창에 들어오지 못한다.
     */
    const { qr } = layoutLotLabel(goodsIssueQrLabelRows(FIELDS), FIELDS.payload);

    for (let y = qr.y; y < qr.y + qr.side; y += 1) {
      for (let x = qr.x; x < qr.x + qr.side; x += 1) {
        if (!readDot(bitmap, x, y)) continue;

        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    }

    const cell = (maxX - minX + 1) / matrix.size;
    /* 칸이 정수 배율로 커졌어야 한다 — 소수면 칸 경계가 흔들려 판독률이 떨어진다. */
    expect(Number.isInteger(cell)).toBe(true);
    expect(maxY - minY + 1).toBe(matrix.size * cell);

    const readBack = matrix.modules.map((row, rowIndex) =>
      row.map((_cell, columnIndex) =>
        readDot(
          bitmap,
          minX + Math.floor(columnIndex * cell + cell / 2),
          minY + Math.floor(rowIndex * cell + cell / 2),
        ),
      ),
    );

    expect(readBack).toEqual(matrix.modules);
  });

  it('값이 달라지면 격자도 달라진다', () => {
    const one = drawGoodsIssueQrLabel(FIELDS);
    const other = drawGoodsIssueQrLabel({
      ...FIELDS,
      payload: buildGoodsIssueQrPayload({
        goodsIssueLineId: 18,
        goodsIssueNo: 'GI-20260916-0002',
        lineNo: 2,
      }),
    });

    expect(one.dots).not.toEqual(other.dots);
  });

  /*
   * 여섯 줄이 **실제로 찍혔는가.** 글자마다 점이 놓이므로, 값을 지우면 점 수가 눈에 띄게 준다.
   * 「글자가 있다」를 이보다 정확히 재려면 점 글꼴을 되읽는 판독기가 필요한데, 그것은 글꼴표를
   * 두 번 적는 일이라 여기서는 **값이 라벨에 영향을 준다**는 사실까지만 잰다.
   */
  it('여섯 줄의 값이 라벨에 실린다', () => {
    const full = countDots(drawGoodsIssueQrLabel(FIELDS));

    for (const field of ['goodsIssueNo', 'itemCode', 'lotNo', 'quantity', 'destinationCode']) {
      const without = countDots(drawGoodsIssueQrLabel({ ...FIELDS, [field]: '' }));

      expect(without).toBeLessThan(full);
    }
  });

  /*
   * ⛔ **넘치는 값을 그대로 두지 않는다.** 34자리 LOT 이 와도 폭 안에서 끝나야 한다 — 넘치면
   *    옆 칸 위로 겹쳐 찍혀 둘 다 못 읽는다(씨앗 라벨이 같은 이유로 자른다).
   */
  it('아주 긴 값이 와도 라벨 폭을 넘지 않는다', () => {
    const bitmap = drawGoodsIssueQrLabel({
      ...FIELDS,
      lotNo: '0001234500000012002607310001230007',
    });

    /* 오른쪽 테두리 안쪽 한 칸이 비어 있으면 글이 밖으로 새지 않은 것이다. */
    for (let y = 100; y < bitmap.height - BORDER_MARGIN; y += 1) {
      expect(readDot(bitmap, bitmap.width - BORDER_MARGIN, y)).toBe(false);
    }
  });
});

const BORDER_MARGIN = 3;

/*
 * ⭐ **종이는 TSPL 로 나간다**(omf-all-around#35). 그림을 드라이버로 찍으면 크기가 틀리고 상하가
 *    뒤집혔다. 명령이 80 × 30 대지와 같은 QR 내용을 싣는지 잰다.
 */
describe('출고 QR 라벨 — TSPL', () => {
  it('80 × 30 mm 한 장에 글줄과 출고 QR 을 싣는다', () => {
    const command = buildGoodsIssueQrLabel(FIELDS);

    expect(command).toContain('SIZE 80 mm,30 mm');
    expect(command).toContain('"GI: GI-20260916-0001"');
    expect(command).toContain('"TO: S220-WIP"');
    expect(command).toMatch(/QRCODE \d+,\d+,M,4,A,0,M2,"OMF-GIL\|17\|GI-20260916-0001\|1"/u);
    expect(command.trimEnd().endsWith('PRINT 1,1')).toBe(true);
  });
});

describe('출고 QR 라벨 — PNG', () => {
  it('PNG 머리표와 덩어리 셋을 갖춘다', () => {
    const png = renderGoodsIssueQrLabel(FIELDS);
    const text = new TextDecoder('latin1').decode(png);

    expect([...png.subarray(0, 8)]).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    expect(text).toContain('IHDR');
    expect(text).toContain('IDAT');
    /* 끝덩어리는 길이 0 · `IEND` · 고정 검사값이다. 바이트로 잰다 — 글자로 재면 부호화가 낀다. */
    expect([...png.subarray(-12)]).toEqual([
      0, 0, 0, 0, 0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82,
    ]);
  });

  it('머리표에 크기와 흑백 1비트가 적힌다', () => {
    const png = renderGoodsIssueQrLabel(FIELDS);
    const view = new DataView(png.buffer, png.byteOffset);

    expect(view.getUint32(16)).toBe(639);
    expect(view.getUint32(20)).toBe(240);
    /* 비트 깊이 1 · 색 유형 0(회색조) */
    expect([png[24], png[25]]).toEqual([1, 0]);
  });

  /*
   * ⭐ **자료를 되읽어 화소가 맞는지 본다.** 저장 블록은 압축하지 않으므로 시험이 해독기 없이
   *    그대로 읽을 수 있다 — 이 검사가 「PNG 처럼 생긴 바이트」와 「실제로 그 그림인 바이트」를
   *    가른다.
   */
  it('담긴 화소가 점판과 같다', () => {
    const bitmap = drawGoodsIssueQrLabel(FIELDS);
    const png = renderGoodsIssueQrLabel(FIELDS);
    const text = new TextDecoder('latin1').decode(png);
    const idatStart = text.indexOf('IDAT') + 4;
    /* zlib 머리 2바이트 + 저장 블록 머리 5바이트를 지나면 화소가 바로 나온다. */
    const raster = png.subarray(idatStart + 7);
    const bytesPerRow = Math.ceil(bitmap.width / 8);

    /* 첫 줄의 거르개 번호는 0(거르지 않음)이다 — 없으면 그림이 한 칸 밀린다. */
    expect(raster[0]).toBe(0);

    for (const [x, y] of [
      [0, 0],
      [5, 5],
      [320, 120],
      [600, 30],
    ] as const) {
      const byte = raster[y * (bytesPerRow + 1) + 1 + (x >> 3)] ?? 0;
      const isWhite = (byte & (0x80 >> (x & 7))) !== 0;

      expect(isWhite).toBe(!readDot(bitmap, x, y));
    }
  });

  /* 라벨 한 장은 단말에 남고 증거로도 복사된다 — 커지면 그 둘이 함께 무거워진다. */
  it('라벨 한 장이 30KB 를 넘지 않는다', () => {
    expect(renderGoodsIssueQrLabel(FIELDS).length).toBeLessThan(30 * 1024);
  });
});

describe('점 글꼴', () => {
  it('빈 글은 폭이 0 이다', () => {
    expect(textDots('', 3)).toBe(0);
  });

  it('글자가 늘면 폭도 는다', () => {
    expect(textDots('AB', 3)).toBeGreaterThan(textDots('A', 3));
  });
});

describe('PNG 조립기', () => {
  /* 저장 블록은 한 덩이에 65535바이트까지다 — 그보다 큰 그림이 와도 이어 붙어야 한다. */
  it('한 덩이를 넘는 그림도 조립한다', () => {
    const wide = { width: 2000, height: 400, dots: new Array<boolean>(800000).fill(false) };

    const png = toPng(wide);
    const view = new DataView(png.buffer, png.byteOffset);

    expect(view.getUint32(16)).toBe(2000);
    expect(view.getUint32(20)).toBe(400);
  });
});
