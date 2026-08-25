import { messages } from '@omf-mes/i18n';
import { describe, expect, it } from 'vitest';

import { toPageView } from './pagination';

const t = messages.shipmentSchedule;

describe('toPageView', () => {
  it('첫 쪽의 위치와 이동 가능 여부를 낸다', () => {
    expect(toPageView({ page: 1, size: 50, total: 240 }, 50)).toEqual({
      page: 1,
      totalPages: 5,
      rangeLabel: t.pageNav.range(1, 50, 240),
      canPrev: false,
      canNext: true,
      isBeyondLast: false,
    });
  });

  it('가운데 쪽에서는 양쪽으로 갈 수 있다', () => {
    expect(toPageView({ page: 3, size: 50, total: 240 }, 50)).toMatchObject({
      rangeLabel: t.pageNav.range(101, 150, 240),
      canPrev: true,
      canNext: true,
    });
  });

  it('마지막 쪽에서는 다음으로 갈 수 없다', () => {
    expect(toPageView({ page: 5, size: 50, total: 240 }, 40)).toMatchObject({
      totalPages: 5,
      rangeLabel: t.pageNav.range(201, 240, 240),
      canNext: false,
    });
  });

  it('서버가 준 쪽을 그대로 위치로 쓴다', () => {
    expect(toPageView({ page: 2, size: 10, total: 35 }, 10).page).toBe(2);
  });

  it('쪽 크기가 0이어도 계산이 깨지지 않는다', () => {
    expect(toPageView({ page: 1, size: 0, total: 3 }, 3)).toMatchObject({
      totalPages: 3,
      canNext: true,
    });
  });

  it('쪽 번호가 0이어도 첫 쪽으로 본다', () => {
    expect(toPageView({ page: 0, size: 50, total: 10 }, 10).page).toBe(1);
  });

  it('보이는 행이 없으면 전체 건수만 밝힌다', () => {
    expect(toPageView({ page: 1, size: 50, total: 0 }, 0).rangeLabel).toBe(t.pageNav.totalOnly(0));
  });

  it('결과가 있는데 마지막 쪽을 넘어가면 쪽 밖으로 판정한다', () => {
    expect(toPageView({ page: 9, size: 50, total: 45 }, 0).isBeyondLast).toBe(true);
  });

  it('결과가 0건이면 쪽 밖이 아니다', () => {
    expect(toPageView({ page: 9, size: 50, total: 0 }, 0).isBeyondLast).toBe(false);
  });

  it('마지막 쪽 자신은 쪽 밖이 아니다', () => {
    expect(toPageView({ page: 1, size: 50, total: 45 }, 45).isBeyondLast).toBe(false);
  });
});
