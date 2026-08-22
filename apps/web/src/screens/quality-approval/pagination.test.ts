import { describe, expect, it } from 'vitest';

import { toPageView } from './pagination';

describe('toPageView', () => {
  it('첫 쪽은 이전만 잠그고 1~20 범위를 표시한다', () => {
    expect(toPageView({ page: 1, size: 20, total: 45 }, 20)).toEqual({
      page: 1,
      canPrev: false,
      canNext: true,
      isBeyondLast: false,
      rangeLabel: '1–20 / 전체 45건',
    });
  });

  it('가운데 쪽은 양방향 이동과 21~40 범위를 연다', () => {
    expect(toPageView({ page: 2, size: 20, total: 45 }, 20)).toEqual({
      page: 2,
      canPrev: true,
      canNext: true,
      isBeyondLast: false,
      rangeLabel: '21–40 / 전체 45건',
    });
  });

  it('마지막 쪽은 다음을 잠그고 실제 표시 건수까지만 센다', () => {
    expect(toPageView({ page: 3, size: 20, total: 45 }, 5)).toEqual({
      page: 3,
      canPrev: true,
      canNext: false,
      isBeyondLast: false,
      rangeLabel: '41–45 / 전체 45건',
    });
  });

  it('범위 밖 쪽은 이동 가능한 이전과 전체 건수만 표시한다', () => {
    expect(toPageView({ page: 4, size: 20, total: 45 }, 0)).toEqual({
      page: 4,
      canPrev: true,
      canNext: false,
      isBeyondLast: true,
      rangeLabel: '전체 45건',
    });
  });
});
