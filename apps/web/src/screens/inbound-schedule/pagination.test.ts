import { messages } from '@omf-mes/i18n';
import { describe, expect, it } from 'vitest';

import { toPageView } from './pagination';

const t = messages.inboundSchedule;

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

  /*
   * **서버가 준 `page`를 정본으로 쓴다.** 주소의 쪽 번호로 위치를 표시하면
   * 서버가 다른 쪽을 돌려줬을 때 표시와 내용이 어긋난다.
   */
  it('서버가 준 쪽을 그대로 위치로 쓴다', () => {
    expect(toPageView({ page: 2, size: 10, total: 35 }, 10).page).toBe(2);
  });

  /* 나눗셈이 무한대가 되지 않게 하한을 둔다 — 계산이 깨지면 이동 버튼이 전부 잠긴다. */
  it('쪽 크기가 0이어도 계산이 깨지지 않는다', () => {
    expect(toPageView({ page: 1, size: 0, total: 3 }, 3)).toMatchObject({
      totalPages: 3,
      canNext: true,
    });
  });

  it('쪽 번호가 0이어도 첫 쪽으로 본다', () => {
    expect(toPageView({ page: 0, size: 50, total: 10 }, 10).page).toBe(1);
  });

  /* 보이는 것이 없으면 범위를 지어내지 않는다. 전체 건수는 그대로 밝힌다. */
  it('보이는 행이 없으면 전체 건수만 밝힌다', () => {
    expect(toPageView({ page: 1, size: 50, total: 0 }, 0).rangeLabel).toBe(t.pageNav.totalOnly(0));
  });

  /*
   * **결과는 있는데 이 쪽에는 없다** — 주소 조작·조건 변경으로 생긴다.
   * 「결과가 없다」와 안내가 갈려야 사용자가 할 조치(첫 쪽으로)가 드러난다.
   */
  it('결과가 있는데 마지막 쪽을 넘어가면 쪽 밖으로 판정한다', () => {
    expect(toPageView({ page: 9, size: 50, total: 45 }, 0).isBeyondLast).toBe(true);
  });

  it('결과가 0건이면 쪽 밖이 아니다 — 안내가 갈린다', () => {
    expect(toPageView({ page: 9, size: 50, total: 0 }, 0).isBeyondLast).toBe(false);
  });

  it('마지막 쪽 자신은 쪽 밖이 아니다', () => {
    expect(toPageView({ page: 1, size: 50, total: 45 }, 45).isBeyondLast).toBe(false);
  });
});
