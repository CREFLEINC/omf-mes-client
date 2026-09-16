import { encodeQr } from '@omf-mes/ui';
import { describe, expect, it } from 'vitest';

import { createBitmap, readDot, type LabelBitmap } from './bitmap';
import { QUIET_ZONE, drawQr } from './qr';

/**
 * QR 찍기의 감지기 — **찍힌 격자를 되찾아 `encodeQr` 와 한 칸씩 대조한다.**
 *
 * ⛔ **자리 셈을 시험에 다시 적지 않는다.** 제품과 같은 식을 옮겨 적으면 둘이 함께 틀렸을 때
 *    서로를 통과시킨다. 그래서 여기서는 **찍힌 결과에서** 칸 크기와 자리를 되찾는다 —
 *    QR 은 세 모서리에 위치 표식이 있어 격자의 가장자리 행·열에 반드시 검은 칸이 있고,
 *    그 덕에 검은 점의 테두리 상자가 곧 격자의 테두리다.
 */

const PAYLOAD = 'OMF-GIL|17|GI-20260916-0001|1';

interface Bounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

const boundsOf = (bitmap: LabelBitmap): Bounds | null => {
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;

  for (let y = 0; y < bitmap.height; y += 1) {
    for (let x = 0; x < bitmap.width; x += 1) {
      if (!readDot(bitmap, x, y)) continue;

      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }

  return maxX === Number.NEGATIVE_INFINITY ? null : { minX, minY, maxX, maxY };
};

describe('QR 찍기', () => {
  it('찍힌 격자가 `encodeQr` 와 한 칸씩 같다', () => {
    const box = 96;
    const bitmap = createBitmap(box, box);
    drawQr(bitmap, PAYLOAD, 0, 0, box);

    const matrix = encodeQr(PAYLOAD);
    const bounds = boundsOf(bitmap);
    expect(bounds).not.toBeNull();

    /* 칸 크기를 «찍힌 것»에서 되찾는다 — 제품의 식을 옮겨 적지 않는다. */
    const cell = (bounds!.maxX - bounds!.minX + 1) / matrix.size;
    expect(Number.isInteger(cell)).toBe(true);
    expect(cell).toBeGreaterThanOrEqual(1);
    /* 정사각형이어야 한다 — 한 축만 어긋나면 판독기가 격자를 못 읽는다. */
    expect(bounds!.maxY - bounds!.minY + 1).toBe(matrix.size * cell);

    for (const [row, cells] of matrix.modules.entries()) {
      for (const [column, isDark] of cells.entries()) {
        expect(readDot(bitmap, bounds!.minX + column * cell, bounds!.minY + row * cell)).toBe(
          isDark,
        );
      }
    }
  });

  /*
   * ⛔⛔ **여백이 없으면 읽히지 않는 QR 이 나간다**(`qr.ts` 머리말 — `encodeQr` 는 격자만 낸다).
   *    라벨에 찍힌 뒤에는 아무도 알아채지 못하고, 현장에서 스캔이 안 될 때야 드러난다.
   */
  it('격자 둘레에 여백이 적어도 네 칸 남는다', () => {
    const box = 96;
    const bitmap = createBitmap(box, box);
    drawQr(bitmap, PAYLOAD, 0, 0, box);

    const matrix = encodeQr(PAYLOAD);
    const bounds = boundsOf(bitmap)!;
    const cell = (bounds.maxX - bounds.minX + 1) / matrix.size;
    /*
     * ⛔ **`QUIET_ZONE` 을 빌려 쓰지 않는다.** 그 상수로 단언을 세우면 상수를 0 으로 낮췄을 때
     *    단언도 0 이 되어 **함께 통과한다**(실측 — 변이 시험에서 이 시험만 살아남았다).
     *    규격이 권하는 최소 네 칸은 «고를 수 있는 값»이 아니므로 시험이 제 수를 갖는다.
     */
    const minimumQuietCells = 4;
    const quiet = minimumQuietCells * cell;

    expect(bounds.minX).toBeGreaterThanOrEqual(quiet);
    expect(bounds.minY).toBeGreaterThanOrEqual(quiet);
    expect(box - 1 - bounds.maxX).toBeGreaterThanOrEqual(quiet);
    expect(box - 1 - bounds.maxY).toBeGreaterThanOrEqual(quiet);
  });

  /* 상수 자체도 규격 아래로 내려가지 못하게 못박는다 — 위 시험은 «그려진 결과»만 본다. */
  it('여백 상수가 규격 최소 아래로 내려가지 않는다', () => {
    expect(QUIET_ZONE).toBeGreaterThanOrEqual(4);
  });

  it('자리를 옮겨 찍어도 그 자리에 선다', () => {
    const box = 96;
    const at = createBitmap(box + 40, box + 30);
    const origin = createBitmap(box, box);

    drawQr(at, PAYLOAD, 40, 30, box);
    drawQr(origin, PAYLOAD, 0, 0, box);

    const moved = boundsOf(at)!;
    const base = boundsOf(origin)!;

    expect(moved.minX - base.minX).toBe(40);
    expect(moved.minY - base.minY).toBe(30);
  });

  /* 남는 자리는 가운데로 민다 — 한쪽으로 몰리면 라벨의 다른 줄과 부딪힌다. */
  it('상자 안에서 가운데로 선다', () => {
    const box = 100;
    const bitmap = createBitmap(box, box);
    drawQr(bitmap, PAYLOAD, 0, 0, box);

    const bounds = boundsOf(bitmap)!;
    const left = bounds.minX;
    const right = box - 1 - bounds.maxX;

    /* 정수로 나누므로 한 점까지는 갈릴 수 있다. */
    expect(Math.abs(left - right)).toBeLessThanOrEqual(1);
  });

  /*
   * ⚠ **칸을 정수 배율로만 키운다.** 소수로 키우면 칸 경계가 흔들려 판독률이 떨어진다.
   *   그래서 상자를 조금 키워도 **칸이 한 단 오르기 전까지는 크기가 그대로**여야 한다.
   */
  it('상자를 조금 키워도 칸 크기는 정수로만 오른다', () => {
    const matrix = encodeQr(PAYLOAD);
    const widthAt = (box: number): number => {
      const bitmap = createBitmap(box, box);
      drawQr(bitmap, PAYLOAD, 0, 0, box);
      const bounds = boundsOf(bitmap)!;

      return (bounds.maxX - bounds.minX + 1) / matrix.size;
    };

    for (const box of [90, 96, 120, 180, 240]) {
      expect(Number.isInteger(widthAt(box))).toBe(true);
    }

    expect(widthAt(240)).toBeGreaterThan(widthAt(90));
  });

  /* 상자가 격자보다 작아도 아무것도 안 찍고 끝내지 않는다 — 빈 자리는 「QR 이 없다」로 보인다. */
  it('상자가 작아도 격자를 찍는다', () => {
    const bitmap = createBitmap(20, 20);
    drawQr(bitmap, PAYLOAD, 0, 0, 20);

    expect(bitmap.dots.filter(Boolean).length).toBeGreaterThan(0);
  });
});
