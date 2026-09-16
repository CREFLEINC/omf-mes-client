import { describe, expect, it } from 'vitest';

import {
  GLYPH_GAP,
  GLYPH_W,
  createBitmap,
  drawText,
  fillRect,
  fitText,
  readDot,
  strokeRect,
  textDots,
} from './bitmap';

/**
 * 점판과 점 글꼴의 감지기.
 *
 * ⭐ **이 모듈에는 그물이 여기뿐이다.** 라벨은 서버가 그려 주지 않으므로(POP 자체 생성)
 *    틀려도 서버 쪽에서 걸릴 자리가 없고, 점판은 화면에 그려지지도 않아 렌더 시험이 닿지
 *    않는다. 그래서 **점이 실제로 놓였는지를 좌표로 묻는다** — 「그리기 함수를 불렀다」는
 *    빈 라벨도 통과시킨다.
 */

const dotCount = (bitmap: ReturnType<typeof createBitmap>): number =>
  bitmap.dots.filter(Boolean).length;

describe('점판', () => {
  it('새 판은 온통 흰색이다 — 라벨지는 흰 종이다', () => {
    const bitmap = createBitmap(4, 3);

    expect(bitmap.dots).toHaveLength(12);
    expect(dotCount(bitmap)).toBe(0);
  });

  it('찍은 자리만 검어진다', () => {
    const bitmap = createBitmap(4, 3);
    fillRect(bitmap, 1, 1, 2, 1);

    expect(readDot(bitmap, 1, 1)).toBe(true);
    expect(readDot(bitmap, 2, 1)).toBe(true);
    expect(readDot(bitmap, 0, 1)).toBe(false);
    expect(readDot(bitmap, 1, 0)).toBe(false);
    expect(dotCount(bitmap)).toBe(2);
  });

  /*
   * ⛔ **판 밖을 찍어도 멎지 않는다**(`bitmap.ts` 의 `setDot` — 「자리를 잘못 잡아도 라벨 생성이
   *    통째로 멎지 않게」). 그 대신 **옆줄로 새지도 않아야** 한다 — 1차원 배열이라 x 를 넘기면
   *    다음 줄 머리에 찍히기 쉬운 자리다.
   */
  it('판 밖은 버린다 — 그리고 옆줄로 새지 않는다', () => {
    const bitmap = createBitmap(4, 3);

    fillRect(bitmap, -2, -2, 2, 2);
    fillRect(bitmap, 4, 0, 2, 2);
    fillRect(bitmap, 0, 3, 2, 2);

    expect(dotCount(bitmap)).toBe(0);
  });

  it('판 밖을 읽으면 흰색이다', () => {
    const bitmap = createBitmap(2, 2);
    fillRect(bitmap, 0, 0, 2, 2);

    expect(readDot(bitmap, -1, 0)).toBe(false);
    expect(readDot(bitmap, 2, 0)).toBe(false);
    expect(readDot(bitmap, 0, 2)).toBe(false);
  });

  it('테두리는 안쪽으로 자라고 속은 비운다', () => {
    const bitmap = createBitmap(6, 6);
    strokeRect(bitmap, 0, 0, 6, 6, 1);

    expect(readDot(bitmap, 0, 0)).toBe(true);
    expect(readDot(bitmap, 5, 5)).toBe(true);
    expect(readDot(bitmap, 1, 1)).toBe(false);
    /* 네 변 = 6*4 − 모서리 중복 4 */
    expect(dotCount(bitmap)).toBe(20);
  });
});

describe('점 글꼴', () => {
  it('글 너비는 글자 사이 빈 칸을 «사이에만» 둔다', () => {
    expect(textDots('', 3)).toBe(0);
    expect(textDots('A', 1)).toBe(GLYPH_W);
    expect(textDots('AB', 1)).toBe(GLYPH_W * 2 + GLYPH_GAP);
    expect(textDots('AB', 2)).toBe((GLYPH_W * 2 + GLYPH_GAP) * 2);
  });

  it('찍은 글이 제 자리에서 시작한다', () => {
    const bitmap = createBitmap(20, 12);
    drawText(bitmap, 'I', 3, 2, 1);

    /* `I` 의 첫 줄은 다섯 칸이 전부 검다. */
    for (let x = 3; x < 3 + GLYPH_W; x += 1) expect(readDot(bitmap, x, 2)).toBe(true);
    expect(readDot(bitmap, 2, 2)).toBe(false);
    expect(readDot(bitmap, 3, 1)).toBe(false);
  });

  it('배율은 점 하나를 정사각형으로 키운다', () => {
    const one = createBitmap(40, 20);
    const two = createBitmap(40, 20);
    drawText(one, 'I', 0, 0, 1);
    drawText(two, 'I', 0, 0, 2);

    expect(dotCount(two)).toBe(dotCount(one) * 4);
  });

  /*
   * ⛔⛔ **없는 글자를 빈칸으로 흘리지 않는다**(`bitmap.ts` 머리말). 한글·특수문자가 조용히
   *    사라지면 **라벨에 값이 없는 것과 구별되지 않는다** — 현장은 「그 칸은 원래 비는가」를
   *    알 수 없다. 채운 상자로 나가야 빠진 사실이 보인다.
   */
  it('글꼴에 없는 글자는 «보이는» 상자로 나간다 — 빈칸이 아니다', () => {
    const blank = createBitmap(20, 12);
    const missing = createBitmap(20, 12);

    /* 빈칸은 글꼴에 «있는» 글자이고 실제로 아무것도 찍지 않는다. */
    drawText(blank, ' ', 0, 0, 1);
    drawText(missing, '한', 0, 0, 1);

    expect(dotCount(blank)).toBe(0);
    expect(dotCount(missing)).toBeGreaterThan(0);
  });

  it('소문자는 대문자로 찍힌다 — 글꼴에 대문자만 있다', () => {
    const upper = createBitmap(20, 12);
    const lower = createBitmap(20, 12);
    drawText(upper, 'A', 0, 0, 1);
    drawText(lower, 'a', 0, 0, 1);

    expect(lower.dots).toEqual(upper.dots);
  });
});

describe('폭 맞추기', () => {
  it('자리가 넉넉하면 가장 큰 배율을 쓴다', () => {
    expect(fitText('AB', 1000, 4)).toEqual({ text: 'AB', scale: 4 });
  });

  it('넘치면 배율을 한 단씩 줄인다', () => {
    const text = 'ABCDEF';
    const fitted = fitText(text, textDots(text, 3), 5);

    expect(fitted).toEqual({ text, scale: 3 });
    expect(textDots(fitted.text, fitted.scale)).toBeLessThanOrEqual(textDots(text, 3));
  });

  /*
   * ⛔ **최소 배율에서도 넘치면 잘라 낸다**(넘치게 두면 옆 칸 위로 겹쳐 찍혀 둘 다 못 읽는다 —
   *    실기 2026-09-08). 자른 뒤에도 **반드시 주어진 폭 안에** 들어가야 한다.
   */
  it('최소 배율에서도 넘치면 잘리고, 잘린 사실을 `~` 로 남긴다', () => {
    const fitted = fitText('ABCDEFGH', 50, 5);

    expect(fitted.scale).toBe(2);
    expect(fitted.text.endsWith('~')).toBe(true);
    expect(fitted.text.length).toBeLessThan('ABCDEFGH'.length);
    expect(textDots(fitted.text, fitted.scale)).toBeLessThanOrEqual(50);
  });

  it('한 글자도 못 들어가면 빈 글이 된다 — `~` 만 남기지 않는다', () => {
    const fitted = fitText('ABCDEFGH', 5, 5);

    expect(fitted.text).toBe('');
  });

  /* 어떤 폭을 주어도 넘지 않는다 — 자르기 셈이 한 칸 어긋나는 것을 잡는 그물이다. */
  it.each([12, 24, 37, 60, 121])('폭 %i 에서도 결과가 그 폭을 넘지 않는다', (available) => {
    const fitted = fitText('LOT-SEED-S230-0003', available, 4);

    expect(textDots(fitted.text, fitted.scale)).toBeLessThanOrEqual(available);
  });
});
