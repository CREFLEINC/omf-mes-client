import { describe, expect, it } from 'vitest';

import { buildPackingLabel } from './packing-label-tspl';

/** 합성값이다 — 실 운영 값을 쓰지 않는다(공개 저장소 경계). */
const content = (index: number) => ({
  itemCode: `SYN-ITEM-0${String(index)}`,
  lotNo: `SYN-LOT-000${String(index)}`,
  quantity: '10 EA',
});

const FIELDS = {
  handlingUnitNo: 'SYN-HU-0001',
  shipmentNo: 'SYN-SH-0001',
  issueSeq: 2,
  contents: [content(1)],
};

const WIDTH = 639;
const HEIGHT = 240;
const BOTTOM = 48;
const RIGHT = 52;

const textLines = (label: string): string[] =>
  label.split('\r\n').filter((line) => line.startsWith('TEXT '));

describe('buildPackingLabel', () => {
  it('80 × 30 mm 대지에 QR 은 취급 단위 번호 원문이다', () => {
    const lines = buildPackingLabel(FIELDS).split('\r\n');

    expect(lines[0]).toBe('SIZE 80 mm,30 mm');
    expect(lines.find((line) => line.startsWith('QRCODE '))).toMatch(/"SYN-HU-0001"$/u);
    expect(
      textLines(buildPackingLabel(FIELDS)).map((line) => /"([^"]*)"$/u.exec(line)?.[1]),
    ).toEqual([
      'PACKING  #2',
      'HU SYN-HU-0001',
      'SH SYN-SH-0001',
      'SYN-ITEM-01 SYN-LOT-0001 10 EA',
    ]);
  });

  it('내용물이 넘치면 수로 말하고 글줄은 안전 여백 안에서 끝난다', () => {
    const label = buildPackingLabel({ ...FIELDS, contents: [content(1), content(2), content(3)] });
    const lines = textLines(label);

    expect(lines).toHaveLength(5);
    expect(lines[4]).toMatch(/"\+2 MORE ITEMS"$/u);

    for (const line of label.split('\r\n').filter((each) => /^(TEXT|QRCODE) /u.test(each))) {
      const [x, y] = (/^(?:TEXT|QRCODE) (\d+),(\d+),/u.exec(line) ?? []).slice(1).map(Number);

      expect(x).toBeLessThan(WIDTH - RIGHT);
      expect(y).toBeLessThan(HEIGHT - BOTTOM);
    }
  });
});
