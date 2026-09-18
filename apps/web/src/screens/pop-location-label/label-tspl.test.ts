import { describe, expect, it } from 'vitest';

import { createBitmap, type LabelBitmap } from '../../patterns/label/bitmap';
import { layoutLotLabel, type LotLabelRasterizer } from '../pop-material-lot-label/label-tspl';
import { buildLocationLabel, buildLocationLabelBytes } from './label-tspl';

const fields = {
  warehouseCode: 'S230',
  locationCode: 'S230-A-01-02',
  locationName: 'RACK A LEVEL 1',
  issueSeq: 3,
};

/** 80 × 30 mm 를 203 dpi 로 옮긴 점 수. */
const WIDTH = 640;
const HEIGHT = 240;

describe('창고 적재 위치 라벨 80 × 30 mm', () => {
  it('대지는 80 × 30 mm 이고, 글줄과 QR 이 라벨지 안에 선다', () => {
    const command = buildLocationLabel(fields);

    expect(command).toContain('SIZE 80 mm,30 mm');

    const texts = [...command.matchAll(/^TEXT (\d+),(\d+),"0",0,(\d+),/gmu)].map((match) => ({
      x: Number(match[1]),
      y: Number(match[2]),
      point: Number(match[3]),
    }));

    expect(texts).toHaveLength(4);
    for (const text of texts) {
      expect(text.x).toBeGreaterThan(0);
      /* 글줄 아래 끝까지 본다 — 시작점만 보면 잘림을 못 잡는다. */
      expect(text.y + Math.ceil(text.point * (203 / 72))).toBeLessThan(HEIGHT);
    }

    const qr = /^QRCODE (\d+),(\d+),M,(\d+),/mu.exec(command);

    expect(qr).not.toBeNull();
    expect(Number(qr?.[2])).toBeGreaterThanOrEqual(0);

    /* QR 은 끝점까지 본다 — 잘림은 오른쪽·아래 끝에서 났다. */
    const { qr: box } = layoutLotLabel([], fields.locationCode);

    expect(box.x).toBe(Number(qr?.[1]));
    expect(box.x + box.side).toBeLessThanOrEqual(WIDTH);
    expect(box.y + box.side).toBeLessThanOrEqual(HEIGHT);
  });

  it('QR 에는 위치 코드만 싣는다', () => {
    expect(buildLocationLabel(fields)).toMatch(/^QRCODE [^\r\n]*,"S230-A-01-02"\r$/mu);
  });

  it('위치명이 한글이어도 줄을 지키고, 못 그리는 글자만 ? 로 찍는다(결정 17)', () => {
    const command = buildLocationLabel({ ...fields, locationName: '자재 랙 1단' });

    expect(command.match(/^TEXT /gmu)).toHaveLength(4);
    expect(command).toContain('"?? ? 1?"');
  });
});

/*
 * ⭐ 한글 줄을 그림으로(사용자 지시 2026-09-18 · omf-all-around#9). jsdom 에는 Canvas 가 없어
 *    실제 글꼴 모양은 여기서 못 본다 — 손으로 만든 점판을 넣어 «바이트가 그 점판을 그대로
 *    싣는지»를 되읽는다. 글자 모양은 실기에서 본다.
 */
const KOREAN = { ...fields, locationName: 'A구역 01열 01단' };

/** 글자 수 × 글꼴 크기 절반 폭의 체크무늬 점판 — 폭이 글꼴 크기를 따라가 줄이기를 시험할 수 있다. */
const fakeRaster: LotLabelRasterizer = (text, fontPx) => {
  const bitmap = createBitmap(Math.ceil(text.length * fontPx * 0.9), fontPx);

  bitmap.dots.forEach((_, index) => {
    bitmap.dots[index] = (index + Math.floor(index / bitmap.width)) % 3 === 0;
  });

  return bitmap;
};

const latin1 = (bytes: Uint8Array): string =>
  Array.from(bytes, (byte) => String.fromCharCode(byte)).join('');

interface DecodedBitmap {
  x: number;
  y: number;
  bitmap: LabelBitmap;
}

/** 바이트에서 `BITMAP` 명령을 찾아 점판으로 되읽는다 — 비트 0 이 검은 점이다. */
const decodeBitmaps = (bytes: Uint8Array): DecodedBitmap[] => {
  const text = latin1(bytes);
  const found: DecodedBitmap[] = [];
  const pattern = /BITMAP (\d+),(\d+),(\d+),(\d+),0,/gu;

  for (let match = pattern.exec(text); match !== null; match = pattern.exec(text)) {
    const [x, y, rowBytes, height] = match.slice(1, 5).map(Number) as [
      number,
      number,
      number,
      number,
    ];
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

describe('창고 적재 위치 라벨 — 한글 줄을 그림으로 (omf-all-around#9)', () => {
  it('한글이 없으면 그림을 켜도 지금 명령과 바이트까지 같다', () => {
    expect(Array.from(buildLocationLabelBytes(fields, fakeRaster))).toEqual(
      Array.from(new TextEncoder().encode(buildLocationLabel(fields))),
    );
  });

  it('한글 위치명 줄만 같은 자리의 BITMAP 으로 바뀌고, 나머지 줄과 QR 은 그대로다', () => {
    const bytes = buildLocationLabelBytes(KOREAN, fakeRaster);
    const text = latin1(bytes);
    const plain = buildLocationLabel(KOREAN).split('\r\n');
    const nameLine = plain.find((line) => line.includes('"A?? 01? 01?"'));

    expect(nameLine).toBeDefined();
    /* ? 로 찍던 TEXT 줄은 사라지고 다른 줄은 한 글자도 바뀌지 않는다. */
    expect(text).not.toContain('"A?? 01? 01?"');
    for (const line of plain.filter((each) => each !== nameLine && each !== '')) {
      expect(text).toContain(`${line}\r\n`);
    }

    const [decoded, ...rest] = decodeBitmaps(bytes);
    const [, x, y] = /^TEXT (\d+),(\d+),/u.exec(nameLine ?? '') ?? [];

    expect(rest).toHaveLength(0);
    expect(decoded?.x).toBe(Number(x));
    expect(decoded?.y).toBe(Number(y));

    /* 되읽은 점판이 넣은 점판과 같다(바이트 폭을 채운 끝 비트는 흰색). */
    const expected = fakeRaster('A구역 01열 01단', Math.ceil(8 * (203 / 72)));

    expect(expected).not.toBeNull();
    for (let row = 0; row < (expected?.height ?? 0); row += 1) {
      for (let col = 0; col < (decoded?.bitmap.width ?? 0); col += 1) {
        const want =
          col < (expected?.width ?? 0) && expected?.dots[row * expected.width + col] === true;
        expect(decoded?.bitmap.dots[row * decoded.bitmap.width + col]).toBe(want);
      }
    }
  });

  it('판 위 여백(rise)만큼 올려 찍어 글자 윗변은 TEXT 줄과 같은 자리다 — 윗획이 깎이지 않게', () => {
    const rise = 5;
    const withRise: LotLabelRasterizer = (text, fontPx) => {
      const drawn = fakeRaster(text, fontPx);

      return drawn === null ? null : { ...drawn, rise };
    };
    const nameLine = buildLocationLabel(KOREAN)
      .split('\r\n')
      .find((line) => line.includes('"A?? 01? 01?"'));
    const [, y] = /^TEXT \d+,(\d+),/u.exec(nameLine ?? '') ?? [];
    const [decoded] = decodeBitmaps(buildLocationLabelBytes(KOREAN, withRise));

    expect(decoded?.y).toBe(Number(y) - rise);

    /* 올려 찍어도 위 줄(위치 코드) 아래 끝과 아래 줄(ISSUE NO.) 윗변을 넘지 않는다. */
    const lines = buildLocationLabel(KOREAN).split('\r\n');
    const code = /^TEXT \d+,(\d+),"0",0,(\d+),/u.exec(
      lines.find((line) => line.includes('"S230-A-01-02"')) ?? '',
    );
    const issue = /^TEXT \d+,(\d+),/u.exec(lines.find((line) => line.includes('ISSUE NO.')) ?? '');
    const codeBottom = Number(code?.[1]) + Math.ceil(Number(code?.[2]) * (203 / 72));

    expect(decoded?.y).toBeGreaterThanOrEqual(codeBottom);
    expect((decoded?.y ?? 0) + (decoded?.bitmap.height ?? 0)).toBeLessThanOrEqual(
      Number(issue?.[1]),
    );
  });

  it('그림은 글줄 칸을 넘지 않는다 — 넓으면 크기를 줄이고 그래도 넘치면 뒤를 자른다', () => {
    const long = {
      ...fields,
      locationName: '아주 긴 한글 위치 이름입니다 아주 긴 한글 위치 이름입니다',
    };
    const { qr } = layoutLotLabel([], fields.locationCode);
    const [decoded] = decodeBitmaps(buildLocationLabelBytes(long, fakeRaster));

    expect(decoded).toBeDefined();
    /* 칸 폭 = QR 왼쪽 - 왼쪽 여백 - 2 mm. 그림의 바이트 폭 올림(최대 7점)만큼은 흰 점이다. */
    const column = qr.x - (decoded?.x ?? 0) - Math.round((2 / 25.4) * 203);
    const inked = (decoded?.bitmap.dots ?? []).reduce(
      (right, dot, index) => (dot ? Math.max(right, index % (decoded?.bitmap.width ?? 1)) : right),
      0,
    );

    expect(inked).toBeLessThan(column);
  });

  it('한글을 못 그리는 단말이면(그림 없음) 결정 17 대로 ? 로 찍는다', () => {
    expect(Array.from(buildLocationLabelBytes(KOREAN, () => null))).toEqual(
      Array.from(new TextEncoder().encode(buildLocationLabel(KOREAN))),
    );
    /* jsdom 에는 Canvas 가 없다 — 기본값이 이 갈래로 떨어진다. */
    expect(Array.from(buildLocationLabelBytes(KOREAN))).toEqual(
      Array.from(new TextEncoder().encode(buildLocationLabel(KOREAN))),
    );
  });
});
