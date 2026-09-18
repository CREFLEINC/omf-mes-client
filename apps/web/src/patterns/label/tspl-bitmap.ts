/**
 * 점판 한 장을 **TSPL `BITMAP` 명령**으로 옮긴다 — 글자를 프린터 글꼴에 맡기지 않고 그림째 보낸다.
 *
 * ⭐ **왜 필요한가.** 프린터 내장 글꼴은 한글을 못 찍는다. 이름을 싣는 라벨(납품 라벨)은
 *    POP 이 그린 점판을 그대로 보내야 하는데, 그림(PNG) 인쇄 경로는 드라이버 대지를 거쳐
 *    크기가 틀어지고 뒤집혔다(사용자 확인 2026-09-17). TSPL 로 보내면 대지·방향을 셸이
 *    자재·생산 LOT 라벨과 같게 맞춘다.
 *
 * ⚠ **바이너리가 섞인다.** 자료 안에 줄바꿈 바이트가 나올 수 있어, 명령을 줄 단위로 다시 쓰는
 *   셸(`apps/pop/src/main/label-media.ts`)이 `BITMAP` 자료를 길이로 건너뛰어야 한다.
 *
 * ⚠ TSPL `BITMAP` 자료는 **비트 0 이 검은 점**이다. 실기(HT800)에서는 아직 확인 전이다 —
 *   흑백이 뒤집혀 나오면 이 자리부터 본다.
 */

import type { LabelBitmap } from './bitmap';

const ascii = (text: string): number[] => Array.from(text, (character) => character.charCodeAt(0));

/** 점판을 `BITMAP` 자료 바이트로 — 한 줄 `ceil(폭/8)` 바이트, **비트 0 이 검은 점**. */
const packBitmap = (bitmap: LabelBitmap): { rowBytes: number; data: Uint8Array } => {
  const rowBytes = Math.ceil(bitmap.width / 8);
  /* 흰 점(1)으로 채워 두고 검은 점만 0 으로 지운다 — 폭을 넘는 끝 비트도 흰색이 된다. */
  const data = new Uint8Array(rowBytes * bitmap.height).fill(0xff);

  for (let y = 0; y < bitmap.height; y += 1) {
    for (let x = 0; x < bitmap.width; x += 1) {
      if (bitmap.dots[y * bitmap.width + x] !== true) continue;

      const index = y * rowBytes + (x >> 3);
      data[index] = (data[index] ?? 0) & ~(0x80 >> (x & 7));
    }
  }

  return { rowBytes, data };
};

/**
 * 점판 하나를 `(x, y)` 에 찍는 **`BITMAP` 명령 한 줄** — 줄바꿈은 붙이지 않는다.
 *
 * ⭐ 라벨 한 장을 통째로 그림으로 보내지 않고, **글줄 하나만** 그림으로 바꿔 다른 TEXT·QRCODE
 *    명령 사이에 끼울 때 쓴다(`pop-location-label` · omf-all-around#9).
 */
export const tsplBitmapCommand = (bitmap: LabelBitmap, x: number, y: number): Uint8Array => {
  const { rowBytes, data } = packBitmap(bitmap);
  const head = ascii(
    `BITMAP ${String(x)},${String(y)},${String(rowBytes)},${String(bitmap.height)},0,`,
  );
  const bytes = new Uint8Array(head.length + data.length);
  bytes.set(head, 0);
  bytes.set(data, head.length);

  return bytes;
};

export const toTsplBitmap = (bitmap: LabelBitmap): Uint8Array<ArrayBuffer> => {
  const { rowBytes, data } = packBitmap(bitmap);

  const head = ascii(
    [
      `SIZE ${String(Math.round((bitmap.width / 203) * 25.4))} mm,${String(Math.round((bitmap.height / 203) * 25.4))} mm`,
      'GAP 2 mm,0 mm',
      'DIRECTION 1',
      'REFERENCE 0,0',
      'CLS',
      `BITMAP 0,0,${String(rowBytes)},${String(bitmap.height)},0,`,
    ].join('\r\n'),
  );
  const tail = ascii('\r\nPRINT 1,1\r\n');

  const bytes = new Uint8Array(head.length + data.length + tail.length);
  bytes.set(head, 0);
  bytes.set(data, head.length);
  bytes.set(tail, head.length + data.length);

  return bytes;
};
