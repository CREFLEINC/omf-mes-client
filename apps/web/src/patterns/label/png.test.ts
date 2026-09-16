import { describe, expect, it } from 'vitest';

import { createBitmap, fillRect, readDot, type LabelBitmap } from './bitmap';
import { toPng } from './png';

/**
 * PNG 조립기의 감지기 — **해독기를 여기 세워 화소를 되읽는다.**
 *
 * ⭐ **바이트가 맞는지는 되읽어야만 안다.** 「길이가 0 이 아니다」나 「머리 여덟 바이트가 맞다」는
 *    **깨진 그림도 통과시킨다.** 이 파일은 규격대로 덩어리를 걸어가며 CRC 를 다시 계산하고,
 *    저장 블록을 풀어 화소를 점판과 **한 칸씩 대조**한다. 그래야 거르개 바이트를 빠뜨리거나
 *    비트를 뒤집은 것 같은 잘못이 잡힌다.
 *
 * ⚠ 해독기를 제품 코드에서 가져오지 않는다 — 같은 실수를 두 번 하면 서로를 통과시킨다.
 *   CRC·Adler 도 여기서 «따로» 셈한다.
 */

const SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

const readUint32 = (bytes: Uint8Array, at: number): number =>
  ((bytes[at]! << 24) | (bytes[at + 1]! << 16) | (bytes[at + 2]! << 8) | bytes[at + 3]!) >>> 0;

/** 시험이 스스로 셈하는 CRC-32. 제품 코드의 표를 빌리지 않는다. */
const crc32 = (bytes: Uint8Array): number => {
  let crc = 0xffffffff;

  for (const byte of bytes) {
    crc ^= byte;

    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc & 1) === 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
    }
  }

  return (crc ^ 0xffffffff) >>> 0;
};

const adler32 = (bytes: Uint8Array): number => {
  let a = 1;
  let b = 0;

  for (const byte of bytes) {
    a = (a + byte) % 65521;
    b = (b + a) % 65521;
  }

  return ((b << 16) | a) >>> 0;
};

interface Chunk {
  name: string;
  body: Uint8Array;
}

/** 덩어리를 차례로 걸으며 **CRC 를 다시 셈해 맞춰 본다.** */
const chunksOf = (png: Uint8Array): Chunk[] => {
  expect([...png.subarray(0, 8)]).toEqual(SIGNATURE);

  const chunks: Chunk[] = [];
  let at = 8;

  while (at < png.length) {
    const length = readUint32(png, at);
    const named = png.subarray(at + 4, at + 8 + length);
    const name = new TextDecoder().decode(named.subarray(0, 4));

    expect(readUint32(png, at + 8 + length)).toBe(crc32(named));

    chunks.push({ name, body: named.subarray(4) });
    at += 12 + length;
  }

  expect(at).toBe(png.length);

  return chunks;
};

/**
 * deflate 의 **저장(stored) 블록**만 푼다 — 이 조립기가 그것만 내보내기 때문이다.
 * 호프만 블록이 섞여 들어오면 여기서 실패한다(그것도 잡고 싶은 잘못이다).
 */
const inflateStored = (zlib: Uint8Array): Uint8Array => {
  expect([zlib[0], zlib[1]]).toEqual([0x78, 0x01]);

  const parts: Uint8Array[] = [];
  let at = 2;
  let final = false;

  while (!final) {
    const header = zlib[at]!;
    final = (header & 1) === 1;
    /* 블록 유형은 비트 1~2 다. 00 이 저장 블록. */
    expect((header >> 1) & 0b11).toBe(0b00);

    const length = zlib[at + 1]! | (zlib[at + 2]! << 8);
    const nlength = zlib[at + 3]! | (zlib[at + 4]! << 8);
    expect(nlength).toBe(~length & 0xffff);

    parts.push(zlib.subarray(at + 5, at + 5 + length));
    at += 5 + length;
  }

  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;

  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }

  /* 꼬리의 Adler-32 가 푼 자료와 맞아야 한다 — 틀리면 해독기가 자료를 버린다. */
  expect(readUint32(zlib, at)).toBe(adler32(out));
  expect(at + 4).toBe(zlib.length);

  return out;
};

interface Decoded {
  width: number;
  height: number;
  /** `true` 가 검은 화소. */
  dark: boolean[];
}

const decode = (png: Uint8Array): Decoded => {
  const chunks = chunksOf(png);

  expect(chunks.map((each) => each.name)).toEqual(['IHDR', 'IDAT', 'IEND']);

  const header = chunks[0]!.body;
  const width = readUint32(header, 0);
  const height = readUint32(header, 4);

  /* 비트 깊이 1 · 색 유형 0(회색조) · 압축 0 · 거르개 0 · 인터레이스 없음 */
  expect([...header.subarray(8)]).toEqual([1, 0, 0, 0, 0]);
  expect(chunks[2]!.body).toHaveLength(0);

  const raster = inflateStored(chunks[1]!.body);
  const bytesPerRow = Math.ceil(width / 8);

  expect(raster).toHaveLength((bytesPerRow + 1) * height);

  const dark: boolean[] = [];

  for (let y = 0; y < height; y += 1) {
    const rowStart = y * (bytesPerRow + 1);

    /* ⛔ 줄머리의 거르개 번호가 0(거르지 않음)이어야 한다 — 없으면 그림이 한 칸 밀린다. */
    expect(raster[rowStart]).toBe(0);

    for (let x = 0; x < width; x += 1) {
      const byte = raster[rowStart + 1 + (x >> 3)]!;
      /* 회색조 1비트에서 0 이 검정이다. */
      dark.push((byte & (0x80 >> (x & 7))) === 0);
    }
  }

  return { width, height, dark };
};

const sameAs = (bitmap: LabelBitmap, decoded: Decoded): void => {
  expect([decoded.width, decoded.height]).toEqual([bitmap.width, bitmap.height]);

  for (let y = 0; y < bitmap.height; y += 1) {
    for (let x = 0; x < bitmap.width; x += 1) {
      expect(decoded.dark[y * bitmap.width + x]).toBe(readDot(bitmap, x, y));
    }
  }
};

describe('PNG 조립', () => {
  it('되읽은 화소가 점판과 한 칸씩 같다', () => {
    const bitmap = createBitmap(16, 5);
    fillRect(bitmap, 0, 0, 16, 1);
    fillRect(bitmap, 3, 2, 2, 2);
    fillRect(bitmap, 15, 4, 1, 1);

    sameAs(bitmap, decode(toPng(bitmap)));
  });

  it('온통 흰 판도 온통 희게 되읽힌다', () => {
    const bitmap = createBitmap(9, 3);
    const decoded = decode(toPng(bitmap));

    expect(decoded.dark.filter(Boolean)).toHaveLength(0);
  });

  /*
   * ⚠ **폭이 8 의 배수가 아니면 줄 끝에 남는 비트가 생긴다.** 그 비트를 검정(0)으로 두면
   *   라벨 오른쪽에 검은 띠가 생기고, 판독기가 QR 여백을 못 찾을 수 있다.
   */
  it('폭이 8 의 배수가 아니어도 줄 끝이 새지 않는다', () => {
    const bitmap = createBitmap(11, 2);
    fillRect(bitmap, 10, 0, 1, 1);

    const decoded = decode(toPng(bitmap));

    sameAs(bitmap, decoded);
    expect(decoded.dark.filter(Boolean)).toHaveLength(1);
  });

  /*
   * ⛔ **저장 블록 하나가 담는 길이는 2바이트가 상한(65535)이다.** 라벨 한 장은 그보다 작지만
   *    큰 판이 들어오면 블록이 여럿으로 갈린다 — 그 이음매에서 한 바이트만 어긋나도 그림이
   *    통째로 깨진다. 실제로 갈리는 크기로 한 번 밟아 둔다.
   */
  it('저장 블록 상한을 넘는 판도 이어 붙여 되읽힌다', () => {
    const bitmap = createBitmap(800, 700);
    expect((Math.ceil(800 / 8) + 1) * 700).toBeGreaterThan(0xffff);

    fillRect(bitmap, 0, 0, 800, 1);
    fillRect(bitmap, 799, 699, 1, 1);
    fillRect(bitmap, 400, 350, 3, 3);

    const decoded = decode(toPng(bitmap));

    expect([decoded.width, decoded.height]).toEqual([800, 700]);
    expect(decoded.dark.filter(Boolean)).toHaveLength(800 + 1 + 9);
    expect(decoded.dark[0]).toBe(true);
    expect(decoded.dark[700 * 800 - 1]).toBe(true);
  });

  it('바이트 배열은 제 버퍼를 갖는다 — Blob 에 그대로 실린다', () => {
    const bytes = toPng(createBitmap(8, 1));

    expect(bytes.byteOffset).toBe(0);
    expect(bytes.buffer.byteLength).toBe(bytes.length);
  });
});
