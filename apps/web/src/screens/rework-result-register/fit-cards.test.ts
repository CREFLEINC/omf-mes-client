import { describe, expect, it } from 'vitest';

import { fitPageSize } from './fit-cards';

/* 실화면(1280×800) 잰 값: 목록 칸 401 · 간격 6 · 접힌 96 · 고른 158 · 배포 전 117. */
const cards = { compact: 96, expanded: 158, planned: 117 };

describe('fitPageSize', () => {
  it('고른 카드 한 장만 크게 잡아 접힌 카드가 한 장 더 들어간다', () => {
    /* 모든 줄을 고른 카드 높이로 재면 2건이었다(158+6+158=322, 3장은 486). */
    expect(fitPageSize({ height: 401, gap: 6, cards, releasedTotal: 5, plannedTotal: 0 })).toBe(3);
  });

  it('배포 전 줄이 같은 쪽에 서도 넘치지 않는 건수를 고른다', () => {
    /* 3건이면 첫 쪽 158+96+117+12=383 — 들어간다. */
    expect(fitPageSize({ height: 401, gap: 6, cards, releasedTotal: 2, plannedTotal: 1 })).toBe(3);
    /* 배포된 1 + 배포 전 2 → 158+117+117+12=404 > 401 — 2건으로 줄인다. */
    expect(fitPageSize({ height: 401, gap: 6, cards, releasedTotal: 1, plannedTotal: 2 })).toBe(2);
  });

  it('줄이 적어도 칸에 꽉 찬 쪽이 들어가는 만큼만 잡는다', () => {
    expect(fitPageSize({ height: 401, gap: 6, cards, releasedTotal: 1, plannedTotal: 0 })).toBe(3);
  });

  it('1024×768 칸(325)에는 2건', () => {
    expect(fitPageSize({ height: 325, gap: 6, cards, releasedTotal: 2, plannedTotal: 1 })).toBe(2);
  });
});
