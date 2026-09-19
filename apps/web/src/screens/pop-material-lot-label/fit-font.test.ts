import { describe, expect, it } from 'vitest';

import { FIT_FONT_STEPS, fitFontSize, type FittableNode } from './fit-font';

/**
 * 크기마다 필요한 폭을 미리 정해 둔 가짜 노드. 실측 값을 그대로 쓴다
 * (`AD0303-00038 · CONNECTOR TERMINAL 【 40200-059000 】` · 1024×768).
 */
const node = (needed: Record<number, number>, box: number): FittableNode => ({
  style: { fontSize: '' },
  clientWidth: box,
  get scrollWidth() {
    const size = Number.parseInt(this.style.fontSize, 10);

    return needed[size] ?? 0;
  },
});

/** 실측: 17px 489 · 15px 431 · 14px 403 · 13px 374 · 12px 345 */
const REAL = { 17: 489, 15: 431, 14: 403, 13: 374, 12: 345 };

describe('fitFontSize', () => {
  it('들어가면 본래 크기를 그대로 쓴다 — 이유 없이 줄이지 않는다', () => {
    const target = node(REAL, 500);

    expect(fitFontSize(target)).toBe(17);
    expect(target.style.fontSize).toBe('17px');
  });

  it('넘치면 들어가는 첫 크기까지만 내린다', () => {
    /* 품목이 줄 전체(400px)를 쓰는 A안의 자리 — 14px 이 403 이라 한 단계 더 내려간다. */
    expect(fitFontSize(node(REAL, 400))).toBe(13);
    expect(fitFontSize(node(REAL, 440))).toBe(15);
  });

  it('바닥까지 넘쳐도 바닥에서 멈춘다 — 읽지 못하는 글자를 만들지 않는다', () => {
    const target = node(REAL, 300);
    const floor = FIT_FONT_STEPS[FIT_FONT_STEPS.length - 1];

    expect(fitFontSize(target)).toBe(floor);
    /* 남은 넘침은 말줄임이 받는다 — 노드에는 바닥 크기가 남아야 한다. */
    expect(target.style.fontSize).toBe(`${String(floor)}px`);
  });

  /**
   * ⛔ 아직 그려지지 않은 자리(폭 0)에서 줄이면, 폭이 생긴 뒤에도 작은 글자가 그대로 남는다 —
   *    첫 렌더와 글꼴 도착 사이에 실제로 지나가는 상태다.
   */
  it('폭을 모르는 동안에는 줄이지 않는다', () => {
    expect(fitFontSize(node(REAL, 0))).toBe(17);
  });
});
