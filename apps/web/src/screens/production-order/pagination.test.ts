import { describe, expect, it } from 'vitest';

import { toPageView } from './pagination';

describe('toPageView', () => {
  it.each([
    [
      '첫 쪽',
      { page: 1, size: 20, total: 45 },
      20,
      { page: 1, canFirst: false, canPrev: false, canNext: true, isBeyondLast: false },
      '1–20 / 전체 45건',
    ],
    [
      '가운데 쪽',
      { page: 2, size: 20, total: 45 },
      20,
      { page: 2, canFirst: true, canPrev: true, canNext: true, isBeyondLast: false },
      '21–40 / 전체 45건',
    ],
    [
      '마지막 쪽',
      { page: 3, size: 20, total: 45 },
      5,
      { page: 3, canFirst: true, canPrev: true, canNext: false, isBeyondLast: false },
      '41–45 / 전체 45건',
    ],
    [
      '범위 밖 쪽',
      { page: 4, size: 20, total: 45 },
      0,
      { page: 4, canFirst: true, canPrev: true, canNext: false, isBeyondLast: true },
      '전체 45건',
    ],
  ])('%s 경계를 계산한다', (_name, meta, shown, flags, rangeLabel) => {
    expect(toPageView(meta, shown)).toEqual({ ...flags, rangeLabel });
  });

  it('0건과 잘못된 size를 안전하게 처리한다', () => {
    expect(toPageView({ page: 7, size: 0, total: 0 }, 0)).toEqual({
      page: 7,
      canFirst: true,
      canPrev: true,
      canNext: false,
      isBeyondLast: false,
      rangeLabel: '전체 0건',
    });
    expect(toPageView({ page: 2, size: 0, total: 2 }, 1)).toMatchObject({
      canFirst: true,
      canPrev: true,
      canNext: false,
      rangeLabel: '2–2 / 전체 2건',
    });
  });
});
