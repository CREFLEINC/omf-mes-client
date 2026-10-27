import { describe, expect, it } from 'vitest';

import { createBitmap, type LabelBitmap } from '../../patterns/label/bitmap';
import {
  buildLotLabel,
  buildLotLabelBytes,
  buildMaterialLotLabel,
  buildMaterialLotLabelBytes,
  escapeTspl,
  layoutMaterialLotLabel,
  materialLotLabelMeasure,
  materialLotLabelQty,
  type LotLabelRasterizer,
  type MaterialLotLabelFields,
  type MaterialLotLabelLayout,
} from './label-tspl';

/** 합성값이다 — 실 운영 값을 쓰지 않는다(공개 저장소 경계). */
const FIELDS: MaterialLotLabelFields = {
  itemCode: 'SYN-ITEM-01',
  itemName: 'SYN ITEM NAME',
  lotNo: 'SYN-ITEM-01|10000|260914|100330|0001',
  qty: 10000,
  uomCode: 'EA',
  issueSeq: 2,
  supplier: 'SYN SUPPLIER (100330)',
  receipt: 'RCV 2026-09-14',
  kind: 'material',
};

/** 한국어·베트남어가 든 합성값 — 이 세 줄만 그림으로 바뀌어야 한다. */
const LOCAL: MaterialLotLabelFields = {
  ...FIELDS,
  itemName: 'Vòng đệm cao su (시험)',
  supplier: '시험 공급사 (100330)',
  receipt: '입하 2026-09-14',
};

/** 칸마다 넘치게 긴 값 — 줄이고 잘라도 칸 밖으로 나가지 않아야 한다. */
const STRESS: MaterialLotLabelFields = {
  itemCode: 'X'.repeat(60),
  itemName: 'N'.repeat(120),
  lotNo: 'L'.repeat(40),
  qty: 123456789.125,
  uomCode: 'KGM',
  issueSeq: 12345,
  supplier: 'S'.repeat(90),
  receipt: 'R'.repeat(80),
  kind: 'material',
};

/* 80 × 30 mm 를 203 dpi 로 옮긴 점 수와, 실기에서 맞춘 안전 여백(좌우 4 mm · 위 2 mm · 아래 6 mm). */
const WIDTH = 639;
const HEIGHT = 240;
const LEFT = 32;
const RIGHT_EDGE = WIDTH - 32;
const TOP = 16;
const BOTTOM_EDGE = HEIGHT - 48;
const GAP_2MM = 16;

const lineHeight = (point: number): number => Math.ceil(point * (203 / 72));

/** 글자 수 × 글꼴 크기 절반 폭의 체크무늬 점판 — jsdom 에는 Canvas 가 없어 글꼴 대신 쓴다. */
const fakeRaster: LotLabelRasterizer = (content, fontPx) => {
  const bitmap = createBitmap(Math.ceil(Array.from(content).length * fontPx * 0.5), fontPx);

  bitmap.dots.forEach((_, index) => {
    bitmap.dots[index] = (index + Math.floor(index / bitmap.width)) % 3 === 0;
  });

  return bitmap;
};

const latin1 = (bytes: Uint8Array): string =>
  Array.from(bytes, (byte) => String.fromCharCode(byte)).join('');

/** 바이트에서 `BITMAP` 명령을 찾아 점판으로 되읽는다 — 비트 0 이 검은 점이다. */
const decodeBitmaps = (bytes: Uint8Array): { x: number; y: number; bitmap: LabelBitmap }[] => {
  const text = latin1(bytes);
  const found: { x: number; y: number; bitmap: LabelBitmap }[] = [];
  const pattern = /BITMAP (\d+),(\d+),(\d+),(\d+),0,/gu;

  for (let match = pattern.exec(text); match !== null; match = pattern.exec(text)) {
    const [x = 0, y = 0, rowBytes = 0, height = 0] = match.slice(1, 5).map(Number);
    const start = match.index + match[0].length;
    const data = bytes.subarray(start, start + rowBytes * height);
    const bitmap = createBitmap(rowBytes * 8, height);

    for (let row = 0; row < height; row += 1) {
      for (let col = 0; col < rowBytes * 8; col += 1) {
        const byte = data[row * rowBytes + (col >> 3)] ?? 0xff;
        bitmap.dots[row * bitmap.width + col] = (byte & (0x80 >> (col & 7))) === 0;
      }
    }

    found.push({ x, y, bitmap });
    pattern.lastIndex = start + rowBytes * height;
  }

  return found;
};

/** 점판에서 가장 오른쪽 검은 점의 x(판 기준). */
const inkedRight = (bitmap: LabelBitmap): number =>
  bitmap.dots.reduce(
    (right, dot, index) => (dot ? Math.max(right, index % bitmap.width) : right),
    -1,
  );

/**
 * ⛔ 모든 글이 «글줄 칸»(QR 오른쪽 + 2 mm ~ 오른쪽 여백)과 위아래 여백 안에 서고, 서로·QR 과
 *    겹치지 않는다. 시작점만 보면 잘림을 못 잡는다 — 끝점까지 본다(실기 HT800 2026-09-15).
 */
const expectInside = (layout: MaterialLotLabelLayout): void => {
  const { qr, texts, reverse } = layout;

  expect(qr.x).toBe(LEFT);
  expect(qr.y).toBeGreaterThanOrEqual(TOP);
  expect(qr.y + qr.side).toBeLessThanOrEqual(BOTTOM_EDGE);
  expect(layout.column).toEqual({ left: qr.x + qr.side + GAP_2MM, right: RIGHT_EDGE });

  const boxes = texts.map((line) => ({
    field: line.field,
    left: line.x,
    right: line.x + line.width,
    top: line.y,
    bottom: line.y + lineHeight(line.point),
  }));

  for (const box of boxes) {
    expect(box.left).toBeGreaterThanOrEqual(layout.column.left);
    expect(box.right).toBeLessThanOrEqual(RIGHT_EDGE);
    expect(box.top).toBeGreaterThanOrEqual(TOP);
    expect(box.bottom).toBeLessThanOrEqual(BOTTOM_EDGE);
  }

  /* 같은 높이에 선 두 글(품번·회차, 수량·입하)은 2 mm 이상 떨어진다. */
  boxes.forEach((a, index) => {
    for (const b of boxes.slice(index + 1)) {
      const sameBand = a.top < b.bottom && b.top < a.bottom;

      if (sameBand && a.field !== 'iqc' && b.field !== 'iqc') {
        expect(Math.max(a.left, b.left) - Math.min(a.right, b.right)).toBeGreaterThanOrEqual(
          GAP_2MM,
        );
      }
    }
  });

  if (reverse !== null) {
    expect(reverse.x + reverse.width).toBeLessThanOrEqual(RIGHT_EDGE);
    expect(reverse.y).toBeGreaterThanOrEqual(TOP);
    expect(reverse.y + reverse.height).toBeLessThanOrEqual(BOTTOM_EDGE);
    /* 뒤집는 상자에는 IQC 글자만 들어간다 — 다른 글이 닿으면 함께 뒤집힌다. */
    for (const box of boxes.filter((each) => each.field !== 'iqc')) {
      const touches =
        box.left < reverse.x + reverse.width &&
        reverse.x < box.right &&
        box.top < reverse.y + reverse.height &&
        reverse.y < box.bottom;

      expect(touches).toBe(false);
    }
  }
};

describe('layoutMaterialLotLabel — 2026-10-24 개편 배치 (omf-all-around#184)', () => {
  it('QR 은 왼쪽 여백에 5 점 칸으로 서고(버전 3 · 145 점), 글줄 칸은 그 오른쪽 2 mm 에서 시작한다', () => {
    const { qr, column } = layoutMaterialLotLabel(FIELDS);

    expect(qr).toEqual({ x: 32, y: 31, side: 145, cell: 5, content: FIELDS.lotNo });
    expect(column).toEqual({ left: 193, right: 607 });
  });

  it('⛔ 어떤 값이 와도 글은 칸 안에 서고 QR·여백·서로를 넘지 않는다', () => {
    const local = materialLotLabelMeasure(fakeRaster);
    const longLocal: MaterialLotLabelFields = {
      ...STRESS,
      itemName: 'Vòng đệm cao su chống rung (loại lớn) '.repeat(4),
      supplier: '아주 긴 시험 공급사 이름 '.repeat(5),
      receipt: '입하 2026-09-14 '.repeat(6),
    };

    for (const fields of [FIELDS, STRESS, { ...STRESS, uomCode: null, receipt: null }]) {
      expectInside(layoutMaterialLotLabel(fields));
      expectInside(layoutMaterialLotLabel({ ...fields, kind: 'iqc' }));
    }
    expectInside(layoutMaterialLotLabel(LOCAL, local));
    expectInside(layoutMaterialLotLabel(longLocal, local));
    expectInside(layoutMaterialLotLabel({ ...longLocal, kind: 'iqc' }, local));
  });

  it('LOT 이 길어 QR 이 커지면 글줄 칸이 «실제 QR 한 변»을 따라 좁아진다', () => {
    /* 50자 → 버전 4(33칸) · 5 점 = 165 점. */
    const v4 = layoutMaterialLotLabel({ ...FIELDS, lotNo: 'L'.repeat(50) });

    expect(v4.qr.side).toBe(165);
    expect(v4.column.left).toBe(32 + 165 + GAP_2MM);
    expectInside(v4);

    /* 70자 → 버전 5(37칸). 5 점이면 185 점이라 세로 칸(176 점)을 넘는다 — 4 점으로 내린다. */
    const v5 = layoutMaterialLotLabel({ ...FIELDS, lotNo: 'L'.repeat(70) });

    expect(v5.qr.cell).toBe(4);
    expect(v5.qr.side).toBe(148);
    expectInside(v5);
  });

  it('다섯 줄이 위 2 mm 에서 아래 6 mm 까지 차례로 서고 남는 세로를 고르게 나눈다', () => {
    const { texts } = layoutMaterialLotLabel(FIELDS);
    const rows = ['itemCode', 'itemName', 'qty', 'supplier', 'lotNo'].map((field) =>
      texts.find((line) => line.field === field),
    );
    const tops = rows.map((line) => line?.y ?? -1);
    const bottoms = rows.map((line) => (line?.y ?? 0) + lineHeight(line?.point ?? 0));

    expect(tops[0]).toBe(TOP);
    expect(bottoms[4]).toBe(BOTTOM_EDGE);
    expect(rows.map((line) => line?.point)).toEqual([14, 9, 14, 8, 8]);
    const gaps = tops.slice(1).map((top, index) => top - (bottoms[index] ?? 0));

    expect(new Set(gaps).size).toBe(1);
    expect(rows.every((line) => line?.x === 193 && line.align === 'left')).toBe(true);
  });

  it('회차 #n 은 품번 줄, 입하 글은 수량 줄의 오른쪽 끝에 붙고 바닥을 그 줄에 맞춘다', () => {
    const { texts } = layoutMaterialLotLabel(FIELDS);
    const find = (field: string) => texts.find((line) => line.field === field);
    const [itemCode, seq, qty, receipt] = ['itemCode', 'issueSeq', 'qty', 'receipt'].map(find);

    expect(seq?.content).toBe('#2');
    expect((seq?.x ?? 0) + (seq?.width ?? 0)).toBe(RIGHT_EDGE);
    expect((seq?.y ?? 0) + lineHeight(seq?.point ?? 0)).toBe(
      (itemCode?.y ?? 0) + lineHeight(itemCode?.point ?? 0),
    );
    expect(receipt?.align).toBe('right');
    expect((receipt?.x ?? 0) + (receipt?.width ?? 0)).toBe(RIGHT_EDGE);
    expect((receipt?.y ?? 0) + lineHeight(receipt?.point ?? 0)).toBe(
      (qty?.y ?? 0) + lineHeight(qty?.point ?? 0),
    );
  });

  it('⭐ 오른쪽 맞춤은 `measure` 가 잰 폭을 쓴다 — 그림으로 찍힐 한글 입하 글도 오른쪽 끝에 붙는다', () => {
    const measure = (content: string, point: number): number =>
      /[^\x20-\x7e]/u.test(content) ? 100 + point : content.length * point;
    const receipt = layoutMaterialLotLabel(LOCAL, measure).texts.find(
      (line) => line.field === 'receipt',
    );

    expect(receipt).toMatchObject({ content: '입하 2026-09-14', point: 8, width: 108 });
    expect(receipt?.x).toBe(RIGHT_EDGE - 108);
  });

  it('⛔ 빈 칸은 줄째 빼고 자리 메움 글을 찍지 않는다 — 남은 줄은 칸 안에서 가운데로 모인다', () => {
    const bare: MaterialLotLabelFields = {
      ...FIELDS,
      itemName: null,
      supplier: '  ',
      receipt: null,
    };
    const layout = layoutMaterialLotLabel(bare);

    expect(layout.texts.map((line) => line.field)).toEqual([
      'itemCode',
      'issueSeq',
      'qty',
      'lotNo',
    ]);
    expectInside(layout);

    const rows = layout.texts.filter((line) => line.align === 'left');
    const gaps = rows
      .slice(1)
      .map((line, index) => line.y - ((rows[index]?.y ?? 0) + lineHeight(rows[index]?.point ?? 0)));
    const top = rows[0]?.y ?? 0;
    const last = rows[rows.length - 1];
    const bottom = (last?.y ?? 0) + lineHeight(last?.point ?? 0);

    /* 줄 사이는 고르고 2 mm 를 넘지 않으며, 위아래 남는 자리가 같다(1 점 차이는 나눗셈 버림). */
    expect(new Set(gaps).size).toBe(1);
    expect(gaps[0]).toBeLessThanOrEqual(GAP_2MM);
    expect(Math.abs(top - TOP - (BOTTOM_EDGE - bottom))).toBeLessThanOrEqual(1);

    const command = buildMaterialLotLabel(bare);

    expect(command.match(/^TEXT /gmu)).toHaveLength(4);
    expect(command).not.toMatch(/null|undefined|알 수 없음/u);
    /* 입하 글이 없으면 수량이 칸 전폭을 쓴다. */
    expect(
      layoutMaterialLotLabel({ ...STRESS, receipt: null }).texts.find(
        (line) => line.field === 'qty',
      )?.point,
    ).toBe(14);
  });
});

describe('materialLotLabelQty', () => {
  it('천 단위 쉼표를 넣고 소수는 받은 그대로 둔다 — 단위를 모르면 숫자만', () => {
    expect(materialLotLabelQty(1500, 'EA')).toBe('1,500 EA');
    expect(materialLotLabelQty(999, 'EA')).toBe('999 EA');
    expect(materialLotLabelQty(1234567.25, 'KG')).toBe('1,234,567.25 KG');
    expect(materialLotLabelQty(1000.125, null)).toBe('1,000.125');
    expect(materialLotLabelQty(0.5, null)).toBe('0.5');
    expect(materialLotLabelQty(-1500, 'EA')).toBe('-1,500 EA');
    expect(materialLotLabelQty(1500, ' ')).toBe('1,500');
  });
});

describe('buildMaterialLotLabel — TEXT 판', () => {
  it('80 × 30 mm 한 장 — 머리 다섯 줄, 일곱 글줄, QR, PRINT 차례로 찍는다', () => {
    expect(buildMaterialLotLabel(FIELDS).split('\r\n')).toEqual([
      'SIZE 80 mm,30 mm',
      'GAP 2 mm,0 mm',
      'DIRECTION 1',
      'REFERENCE 0,0',
      'CLS',
      'TEXT 193,16,"0",0,14,14,"SYN-ITEM-01"',
      'TEXT 584,33,"0",0,8,8,"#2"',
      'TEXT 193,62,"0",0,9,9,"SYN ITEM NAME"',
      'TEXT 193,94,"0",0,14,14,"10,000 EA"',
      'TEXT 449,111,"0",0,8,8,"RCV 2026-09-14"',
      'TEXT 193,140,"0",0,8,8,"SYN SUPPLIER (100330)"',
      'TEXT 193,169,"0",0,8,8,"SYN-ITEM-01|10000|260914|100330|0001"',
      'QRCODE 32,31,M,5,A,0,M2,"SYN-ITEM-01|10000|260914|100330|0001"',
      'PRINT 1,1',
      '',
    ]);
  });

  it('⛔ QR 에는 LOT 번호만 싣는다 — 모바일이 스캔값을 그대로 LOT 번호로 읽는다', () => {
    const qr = buildMaterialLotLabel(LOCAL)
      .split('\r\n')
      .filter((line) => line.startsWith('QRCODE '));

    expect(qr).toEqual([`QRCODE 32,31,M,5,A,0,M2,"${FIELDS.lotNo}"`]);
  });

  it('ASCII 밖 글자는 결정 17 대로 ? 로 찍는다 — 줄 수·자리는 그대로다', () => {
    const command = buildMaterialLotLabel(LOCAL);

    expect(command).toContain('"V?ng ??m cao su (??)"');
    expect(command).toContain('"?? ??? (100330)"');
    expect(command).toContain('"?? 2026-09-14"');
    expect(command.match(/^TEXT /gmu)).toHaveLength(7);
    expect(command).not.toContain('BITMAP');
  });

  it('⭐ IQC 라벨은 #n 대신 검은 상자 IQC — TEXT 를 찍고 REVERSE 로 뒤집는다(글줄 뒤 · QR 앞)', () => {
    const lines = buildMaterialLotLabel({ ...FIELDS, kind: 'iqc' }).split('\r\n');
    const iqc = lines.indexOf('TEXT 548,19,"0",0,12,12,"IQC"');
    const reverse = lines.indexOf('REVERSE 540,16,67,40');
    const lastText = lines.reduce(
      (last, line, index) => (line.startsWith('TEXT ') ? index : last),
      -1,
    );

    expect(lines.some((line) => line.includes('"#2"'))).toBe(false);
    expect(iqc).toBeGreaterThan(-1);
    expect(reverse).toBe(iqc + 1);
    expect(iqc).toBe(lastText);
    expect(lines[reverse + 1]).toMatch(/^QRCODE /u);

    /* 뒤집는 상자가 IQC 글자를 품고, 품번은 상자 2 mm 앞에서 끝난다. */
    const { texts, reverse: box } = layoutMaterialLotLabel({ ...FIELDS, kind: 'iqc' });
    const mark = texts.find((line) => line.field === 'iqc');
    const itemCode = texts.find((line) => line.field === 'itemCode');

    expect(box).toEqual({ x: 540, y: 16, width: 67, height: 40 });
    expect(mark?.x).toBeGreaterThanOrEqual(540);
    expect((mark?.x ?? 0) + (mark?.width ?? 0)).toBeLessThanOrEqual(540 + 67);
    expect((mark?.y ?? 0) + lineHeight(mark?.point ?? 0)).toBeLessThanOrEqual(16 + 40);
    expect((itemCode?.x ?? 0) + (itemCode?.width ?? 0)).toBeLessThanOrEqual(540 - GAP_2MM);
  });

  it('자재 라벨에는 REVERSE 가 없다', () => {
    expect(buildMaterialLotLabel(FIELDS)).not.toContain('REVERSE');
  });

  it('너무 긴 품번은 줄였다가 잘라 끝에 ~ 를 남긴다 — 회차 칸 위로 넘치게 두지 않는다', () => {
    const { texts } = layoutMaterialLotLabel({ ...FIELDS, itemCode: 'X'.repeat(120) });
    const itemCode = texts.find((line) => line.field === 'itemCode');
    const seq = texts.find((line) => line.field === 'issueSeq');

    expect(itemCode?.point).toBe(7);
    expect(itemCode?.content).toMatch(/^X+~$/u);
    expect((itemCode?.x ?? 0) + (itemCode?.width ?? 0)).toBeLessThanOrEqual(
      (seq?.x ?? 0) - GAP_2MM,
    );
  });
});

/*
 * ⭐ 한글·베트남어 줄을 그림으로(사용자 승인 2026-10-24 · omf-all-around#184). jsdom 에는 Canvas 가
 *    없어 실제 글꼴 모양은 여기서 못 본다 — 손으로 만든 점판을 넣어 «바이트가 그 점판을 제 자리에
 *    싣는지»를 되읽는다. 글자 모양은 실기에서 본다.
 */
describe('buildMaterialLotLabelBytes — ASCII 밖 줄만 그림으로', () => {
  const ascii = (fields: MaterialLotLabelFields): number[] =>
    Array.from(new TextEncoder().encode(buildMaterialLotLabel(fields)));

  it('모든 줄이 ASCII 면 그림을 켜도 TEXT 판과 바이트까지 같다', () => {
    expect(Array.from(buildMaterialLotLabelBytes(FIELDS, fakeRaster))).toEqual(ascii(FIELDS));
    expect(Array.from(buildMaterialLotLabelBytes({ ...FIELDS, kind: 'iqc' }, fakeRaster))).toEqual(
      ascii({ ...FIELDS, kind: 'iqc' }),
    );
  });

  it('한글을 못 그리는 단말이면(그림 없음) 결정 17 대로 ? 로 찍는다', () => {
    expect(Array.from(buildMaterialLotLabelBytes(LOCAL, () => null))).toEqual(ascii(LOCAL));
    /* jsdom 에는 Canvas 가 없다 — 기본값이 이 갈래로 떨어진다. */
    expect(Array.from(buildMaterialLotLabelBytes(LOCAL))).toEqual(ascii(LOCAL));
  });

  it('품명·공급처·입하 줄만 같은 자리의 BITMAP 으로 바뀌고, 나머지 줄과 QR 은 TEXT 그대로다', () => {
    const bytes = buildMaterialLotLabelBytes(LOCAL, fakeRaster);
    const text = latin1(bytes);
    const layout = layoutMaterialLotLabel(LOCAL, materialLotLabelMeasure(fakeRaster));
    const drawn = layout.texts.filter((line) => /[^\x20-\x7e]/u.test(line.content));
    const decoded = decodeBitmaps(bytes);

    expect(drawn.map((line) => line.field)).toEqual(['itemName', 'receipt', 'supplier']);
    expect(decoded).toHaveLength(3);
    drawn.forEach((line, index) => {
      expect(decoded[index]?.x).toBe(line.x);
      expect(decoded[index]?.y).toBe(line.y);
      expect(decoded[index]?.bitmap.height).toBe(lineHeight(line.point));
    });

    /* ? 로 찍던 TEXT 줄은 사라지고, ASCII 줄은 그림 폭으로 잰 자리 그대로 TEXT 다. */
    for (const garbled of ['"V?ng ??m cao su (??)"', '"?? ??? (100330)"', '"?? 2026-09-14"']) {
      expect(text).not.toContain(garbled);
    }
    expect(text).toContain('TEXT 193,16,"0",0,14,14,"SYN-ITEM-01"\r\n');
    expect(text).toContain('TEXT 584,33,"0",0,8,8,"#2"\r\n');
    expect(text).toContain('"10,000 EA"\r\n');
    expect(text).toContain(`QRCODE 32,31,M,5,A,0,M2,"${LOCAL.lotNo}"\r\nPRINT 1,1\r\n`);

    /* 입하 그림은 오른쪽 여백에 붙는다 — 그린 폭(바이트 폭 올림 전)으로 맞춘다. */
    const receipt = drawn.find((line) => line.field === 'receipt');
    const receiptWidth = fakeRaster('입하 2026-09-14', lineHeight(8))?.width ?? 0;

    expect((receipt?.x ?? 0) + receiptWidth).toBe(RIGHT_EDGE);
  });

  it('판 위 여백(rise)만큼 올려 찍어 글자 윗변은 TEXT 줄과 같은 자리다 — 윗획이 깎이지 않게', () => {
    const rise = 4;
    const withRise: LotLabelRasterizer = (content, fontPx) => {
      const drawn = fakeRaster(content, fontPx);

      return drawn === null ? null : { ...drawn, rise };
    };
    const layout = layoutMaterialLotLabel(LOCAL, materialLotLabelMeasure(withRise));
    const name = layout.texts.find((line) => line.field === 'itemName');
    const [decoded] = decodeBitmaps(buildMaterialLotLabelBytes(LOCAL, withRise));

    expect(decoded?.y).toBe((name?.y ?? 0) - rise);
  });

  it('⛔ 그림은 글줄 칸을 넘지 않는다 — 넓으면 크기를 줄이고 그래도 넘치면 뒤를 잘라 ~ 를 남긴다', () => {
    const long: MaterialLotLabelFields = {
      ...LOCAL,
      itemName: 'Vòng đệm cao su chống rung (loại lớn) '.repeat(4),
    };
    const layout = layoutMaterialLotLabel(long, materialLotLabelMeasure(fakeRaster));
    const name = layout.texts.find((line) => line.field === 'itemName');
    const [decoded] = decodeBitmaps(buildMaterialLotLabelBytes(long, fakeRaster));

    expect(name?.point).toBe(7);
    expect(name?.content.endsWith('~')).toBe(true);
    expect(decoded?.x).toBe(layout.column.left);
    expect((decoded?.x ?? 0) + inkedRight(decoded?.bitmap ?? createBitmap(0, 0))).toBeLessThan(
      RIGHT_EDGE,
    );
  });

  it('⛔ IQC 의 REVERSE 는 그림 줄까지 다 찍은 뒤 QR 앞에 온다 — 뒤에 그린 그림이 상자를 덮지 않게', () => {
    const text = latin1(buildMaterialLotLabelBytes({ ...LOCAL, kind: 'iqc' }, fakeRaster));
    const reverse = text.indexOf('REVERSE ');

    expect(reverse).toBeGreaterThan(text.lastIndexOf('BITMAP '));
    expect(reverse).toBeGreaterThan(text.indexOf('"IQC"'));
    expect(reverse).toBeLessThan(text.indexOf('QRCODE '));
  });
});

describe('escapeTspl', () => {
  it('⛔ 따옴표·역슬래시가 명령을 가르지 못하게 하고 찍을 수 없는 글자는 ? 로 바꾼다', () => {
    expect(escapeTspl('A"B\\C한')).toBe('A\\"B\\\\C?');
  });
});

/* 공용 `buildLotLabelBytes` 는 위치 라벨만 그림을 켠다(omf-all-around#9) — 생산 LOT 은 결정 17 그대로다. */
describe('buildLotLabelBytes — 기본은 그림을 끈다', () => {
  it('선택 인자가 없으면 buildLotLabel 을 인코딩한 것과 바이트까지 같다(한글은 ?)', () => {
    const rows = [
      { point: 8, content: 'MATERIAL LOT  #1' },
      { point: 10, content: 'ITEM 자재품번' },
    ];

    expect(Array.from(buildLotLabelBytes(rows, 'SYN-LOT'))).toEqual(
      Array.from(new TextEncoder().encode(buildLotLabel(rows, 'SYN-LOT'))),
    );
  });
});
