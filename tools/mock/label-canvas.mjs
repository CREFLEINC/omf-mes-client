/**
 * 라벨을 점으로 그리는 자리 — **회색조 1바이트/픽셀 위에 사각형과 글자만 얹는다.**
 *
 * ⛔ **제품 코드가 아니다.** 실제 라벨은 서버가 그린다(설계 결정 18). 여기 있는 것은 그 서버가
 *    없는 동안 같은 자리에서 같은 모양을 내주는 대역이며, 씨앗 서버 안에서만 쓰인다.
 */
import { deflateSync } from 'node:zlib';

import { GLYPH_GAP, GLYPH_H, GLYPH_W, glyphRows } from './label-font.mjs';

/** 사양의 프린터 해상도. 좌표를 mm 로 적고 여기서 점으로 바꾼다. */
export const DPI = 203;
export const mm = (value) => Math.round((value / 25.4) * DPI);

/**
 * pt 를 점 배율로 바꾼다.
 *
 * ⚠ pt 는 글자 «전체» 높이라 대문자 높이는 그보다 낮다. 0.62 를 곱해 대문자 높이를 잡고
 *   7 행으로 나눠 배율을 얻는다 — 사양의 9~16pt 가 배율 3~5 로 떨어진다.
 */
export const scaleFor = (pt) => Math.max(2, Math.round(((pt / 72) * DPI * 0.7) / GLYPH_H));

export function createCanvas(width, height) {
  return { width, height, pixels: new Uint8Array(width * height).fill(0xff) };
}

const put = (canvas, x, y, value) => {
  if (x < 0 || y < 0 || x >= canvas.width || y >= canvas.height) return;
  canvas.pixels[y * canvas.width + x] = value;
};

export function fillRect(canvas, x, y, width, height, value = 0x00) {
  for (let row = 0; row < height; row += 1) {
    for (let column = 0; column < width; column += 1) put(canvas, x + column, y + row, value);
  }
}

/** 테두리 — 안쪽을 채우지 않는다. 라벨 가장자리가 잘렸는지 눈으로 가리는 선이다. */
export function strokeRect(canvas, x, y, width, height, thickness = 2) {
  fillRect(canvas, x, y, width, thickness);
  fillRect(canvas, x, y + height - thickness, width, thickness);
  fillRect(canvas, x, y, thickness, height);
  fillRect(canvas, x + width - thickness, y, thickness, height);
}

/** 글자 한 줄. 돌려주는 값은 **그린 너비**라 옆에 이어 붙일 때 쓴다. */
export function drawText(canvas, text, x, y, scale) {
  let cursor = x;

  for (const character of text) {
    const rows = glyphRows(character);

    rows.forEach((row, rowIndex) => {
      for (let column = 0; column < GLYPH_W; column += 1) {
        if (row[column] !== '#') continue;
        fillRect(canvas, cursor + column * scale, y + rowIndex * scale, scale, scale);
      }
    });

    cursor += (GLYPH_W + GLYPH_GAP) * scale;
  }

  return cursor - x - GLYPH_GAP * scale;
}

/** 그 배율로 글자를 그렸을 때의 높이·너비. 자리 배치를 여기 한 곳에서 계산한다. */
export const textHeight = (scale) => GLYPH_H * scale;
export const textWidth = (text, scale) =>
  text.length === 0 ? 0 : text.length * (GLYPH_W + GLYPH_GAP) * scale - GLYPH_GAP * scale;

/**
 * 2D 바코드 자리 — **읽히는 코드가 아니다.**
 *
 * ⛔ 실제 DataMatrix 는 서버가 만든다. 씨앗이 만드는 것은 **같은 자리·같은 크기의 모양**이며,
 *    스캐너로 읽으면 아무 값도 나오지 않는다. 자리와 여백을 눈으로 확인하기 위한 것이다.
 *    읽히는 것처럼 보이면 안 되므로 이 사실을 로그·문서에 함께 적는다.
 */
export function drawMatrixPlaceholder(canvas, x, y, size, seed) {
  const cells = 22;
  const cell = Math.max(1, Math.floor(size / cells));
  let state = (seed * 2654435761) >>> 0;
  const next = () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state >>> 16;
  };

  for (let row = 0; row < cells; row += 1) {
    for (let column = 0; column < cells; column += 1) {
      /* 왼쪽·아래는 채운 선, 위·오른쪽은 한 칸 걸러 — DataMatrix 의 겉모양이다. */
      const onSolid = column === 0 || row === cells - 1;
      const onTimed = (row === 0 || column === cells - 1) && (row + column) % 2 === 0;
      const inner =
        row > 0 && column > 0 && row < cells - 1 && column < cells - 1 && next() % 2 === 0;

      if (onSolid || onTimed || inner) {
        fillRect(canvas, x + column * cell, y + row * cell, cell, cell);
      }
    }
  }
}

const CRC = Array.from({ length: 256 }, (_, index) => {
  let value = index;
  for (let bit = 0; bit < 8; bit += 1)
    value = (value & 1) === 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  return value >>> 0;
});

const crc32 = (buffer) => {
  let value = 0xffffffff;
  for (const byte of buffer) value = CRC[(value ^ byte) & 0xff] ^ (value >>> 8);
  return (value ^ 0xffffffff) >>> 0;
};

const chunk = (type, data) => {
  const head = Buffer.alloc(4);
  head.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const tail = Buffer.alloc(4);
  tail.writeUInt32BE(crc32(body));
  return Buffer.concat([head, body, tail]);
};

/** 회색조 8비트 PNG 로 굳힌다. 필터는 쓰지 않는다 — 크기보다 단순함이 중요하다. */
export function toPng(canvas) {
  const raw = Buffer.alloc((canvas.width + 1) * canvas.height);

  for (let y = 0; y < canvas.height; y += 1) {
    const at = y * (canvas.width + 1);
    raw[at] = 0;
    canvas.pixels.copy?.(raw, at + 1, y * canvas.width, (y + 1) * canvas.width);
    if (canvas.pixels.copy === undefined) {
      raw.set(canvas.pixels.subarray(y * canvas.width, (y + 1) * canvas.width), at + 1);
    }
  }

  const header = Buffer.alloc(13);
  header.writeUInt32BE(canvas.width, 0);
  header.writeUInt32BE(canvas.height, 4);
  header[8] = 8;
  header[9] = 0;

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}
