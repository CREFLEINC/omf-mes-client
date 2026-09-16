/**
 * 점판을 **PNG 바이트**로 조립한다. 의존성 0.
 *
 * ⭐ **왜 손으로 만드나.** 브라우저 캔버스는 이 저장소의 시험 환경(jsdom)에서 돌지 않고,
 *    `canvas` 네이티브 패키지를 들이는 것은 CI·이미지까지 번지는 결정이라 하지 않기로 했다
 *    (통합 담당·사용자 승인 2026-09-16). PNG 는 형식이 단순해 손으로 조립하는 편이 싸다 —
 *    씨앗 서버가 이미 같은 수를 쓴다(`tools/mock/label-canvas.mjs`, 그쪽은 Node `zlib`).
 *
 * ⭐ **압축하지 않는다 — deflate 의 「저장(stored)」 블록으로 감싸기만 한다.** 브라우저에
 *    `node:zlib` 가 없고 `CompressionStream` 은 있는 곳과 없는 곳이 갈린다. 저장 블록은 규격이
 *    정한 합법 형식이라 어떤 해독기도 읽으며, **되는 곳과 안 되는 곳이 갈리지 않는다.**
 *    비트 깊이 1(흑백)이라 80×30mm 라벨이 20KB 안쪽이다 — 라벨 한 장에 충분히 작다.
 *
 * ⚠ **비트 깊이 1, 회색조다.** 0 이 검정, 1 이 흰색(`PNG` 회색조 규약). 흑백이라 QR 판독기가
 *    문턱값을 잡을 일이 없다.
 */

import type { LabelBitmap } from './label-bitmap';

const CRC_TABLE = ((): Uint32Array => {
  const table = new Uint32Array(256);

  for (let index = 0; index < 256; index += 1) {
    let value = index;

    for (let bit = 0; bit < 8; bit += 1) {
      value = (value & 1) === 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    }

    table[index] = value >>> 0;
  }

  return table;
})();

const crc32 = (bytes: Uint8Array): number => {
  let crc = 0xffffffff;

  for (const byte of bytes) crc = CRC_TABLE[(crc ^ byte) & 0xff]! ^ (crc >>> 8);

  return (crc ^ 0xffffffff) >>> 0;
};

/** zlib 이 자료 무결성 확인에 쓰는 검사값. 빠뜨리면 해독기가 자료를 버린다. */
const adler32 = (bytes: Uint8Array): number => {
  let a = 1;
  let b = 0;

  for (const byte of bytes) {
    a = (a + byte) % 65521;
    b = (b + a) % 65521;
  }

  return ((b << 16) | a) >>> 0;
};

const uint32 = (value: number): Uint8Array =>
  new Uint8Array([(value >>> 24) & 0xff, (value >>> 16) & 0xff, (value >>> 8) & 0xff, value & 0xff]);

const concat = (parts: readonly Uint8Array[]): Uint8Array<ArrayBuffer> => {
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;

  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }

  return out;
};

/** PNG 덩어리 하나 — 길이 · 이름 · 내용 · 검사값. */
const chunk = (name: string, body: Uint8Array): Uint8Array => {
  const named = concat([new TextEncoder().encode(name), body]);

  return concat([uint32(body.length), named, uint32(crc32(named))]);
};

/** 저장 블록 한 덩이가 담을 수 있는 최대 — 길이 칸이 2바이트다. */
const STORED_BLOCK_MAX = 0xffff;

/**
 * 압축 없이 zlib 흐름으로 감싼다.
 *
 * 머리 두 바이트는 `0x78 0x01`(deflate · 32KB 창 · 최저 압축 표기)이고, 그 뒤로 저장 블록이
 * 이어진 다음 꼬리에 Adler-32 가 붙는다. 각 블록은 «마지막인가» 한 비트 + 길이 + 길이의 보수다.
 */
const zlibStored = (data: Uint8Array): Uint8Array => {
  const parts: Uint8Array[] = [new Uint8Array([0x78, 0x01])];

  for (let offset = 0; offset < data.length || offset === 0; offset += STORED_BLOCK_MAX) {
    const slice = data.subarray(offset, offset + STORED_BLOCK_MAX);
    const isLast = offset + STORED_BLOCK_MAX >= data.length;
    const length = slice.length;

    parts.push(
      new Uint8Array([
        isLast ? 1 : 0,
        length & 0xff,
        (length >>> 8) & 0xff,
        ~length & 0xff,
        (~length >>> 8) & 0xff,
      ]),
      slice,
    );

    if (isLast) break;
  }

  parts.push(uint32(adler32(data)));

  return concat(parts);
};

const PNG_SIGNATURE = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/**
 * 점판 한 줄을 PNG 한 줄로 옮긴다.
 *
 * 줄마다 앞에 **거르개(filter) 번호 0**(거르지 않음)을 붙인다 — 이 바이트가 없으면 해독기가
 * 첫 화소를 거르개로 읽어 그림이 한 칸씩 밀린다.
 */
const toRaster = (bitmap: LabelBitmap): Uint8Array => {
  const bytesPerRow = Math.ceil(bitmap.width / 8);
  const raster = new Uint8Array((bytesPerRow + 1) * bitmap.height);

  for (let y = 0; y < bitmap.height; y += 1) {
    const rowStart = y * (bytesPerRow + 1);
    raster[rowStart] = 0;

    for (let x = 0; x < bitmap.width; x += 1) {
      /* 검은 점이 0 이므로, 흰 바탕을 1 로 먼저 세우고 검은 자리만 지운다. */
      if (bitmap.dots[y * bitmap.width + x] === true) continue;

      const index = rowStart + 1 + (x >> 3);
      raster[index] = (raster[index] ?? 0) | (0x80 >> (x & 7));
    }
  }

  return raster;
};

/** 점판을 흑백 1비트 PNG 바이트로. */
export const toPng = (bitmap: LabelBitmap): Uint8Array<ArrayBuffer> => {
  const header = concat([
    uint32(bitmap.width),
    uint32(bitmap.height),
    /* 비트 깊이 1 · 색 유형 0(회색조) · 압축 0 · 거르개 0 · 인터레이스 없음 */
    new Uint8Array([1, 0, 0, 0, 0]),
  ]);

  return concat([
    PNG_SIGNATURE,
    chunk('IHDR', header),
    chunk('IDAT', zlibStored(toRaster(bitmap))),
    chunk('IEND', new Uint8Array(0)),
  ]);
};
