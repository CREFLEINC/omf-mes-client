/**
 * QR 격자를 점판에 찍는다.
 *
 * ⛔ **여백(quiet zone)을 이 함수가 둔다.** `encodeQr` 는 격자만 낸다 — 여백을 넣지 않는다고
 *    못박혀 있다(`packages/ui/src/ds-candidates/qr-encode.ts`). 여백 없이 찍으면 판독기가
 *    격자의 끝을 찾지 못해 **읽히지 않는 QR** 이 나간다. 라벨마다 이 사실을 다시 기억하게
 *    두지 않으려고 여기 한 곳에 묶었다.
 *
 * ⛔ **담는 글을 만들지 않는다.** 무엇을 QR 에 싣는지는 라벨마다 다르고 업무 규약이다
 *    (출고 QR 은 `OMF-GIL|…`, 포장 라벨은 취급 단위 번호 원문). 부르는 쪽이 정한다.
 */

import { encodeQr } from '@omf-mes/ui';

import { fillRect, type LabelBitmap } from './bitmap';

/** 격자 둘레에 두는 빈 칸 수. 규격이 권하는 최소는 4다. */
export const QUIET_ZONE = 4;

/**
 * `box` 한 변 안에 QR 을 **가운데 맞춰** 찍는다.
 *
 * ⚠ 칸을 **정수 배율로만** 키운다 — 소수로 키우면 칸 경계가 흔들려 판독률이 떨어진다.
 *   그래서 실제로 그려지는 크기는 `box` 보다 작을 수 있고, 남는 자리는 가운데로 민다.
 */
export const drawQr = (
  bitmap: LabelBitmap,
  payload: string,
  x: number,
  y: number,
  box: number,
): void => {
  const matrix = encodeQr(payload);
  const withQuiet = matrix.size + QUIET_ZONE * 2;
  const cell = Math.max(1, Math.floor(box / withQuiet));
  const drawn = withQuiet * cell;
  const originX = x + Math.floor((box - drawn) / 2) + QUIET_ZONE * cell;
  const originY = y + Math.floor((box - drawn) / 2) + QUIET_ZONE * cell;

  for (const [row, cells] of matrix.modules.entries()) {
    for (const [column, isDark] of cells.entries()) {
      if (!isDark) continue;

      fillRect(bitmap, originX + column * cell, originY + row * cell, cell, cell);
    }
  }
};
