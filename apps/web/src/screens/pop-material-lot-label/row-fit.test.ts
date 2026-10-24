import { describe, expect, it } from 'vitest';

import { FALLBACK_ROWS, ROW_HEIGHT, rowsThatFit } from './row-fit';

describe('rowsThatFit', () => {
  it('칸 높이에 잘리지 않고 들어가는 줄 수 — 1920×1080 표 칸(약 670px)이면 11줄이다', () => {
    expect(rowsThatFit(670)).toBe(11);
    expect(rowsThatFit(ROW_HEIGHT * 13)).toBe(13);
  });

  it('하나 아래로는 내려가지 않는다', () => {
    expect(rowsThatFit(10)).toBe(1);
  });

  it('높이를 아직 모르면(첫 그림 · 시험 환경) 설계 기준 줄 수를 쓴다', () => {
    expect(rowsThatFit(0)).toBe(FALLBACK_ROWS);
  });
});
