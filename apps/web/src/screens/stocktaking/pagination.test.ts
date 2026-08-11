import { describe, expect, it } from 'vitest';

import { toPageView } from './pagination';

describe('toPageView', () => {
  it('보이는 범위와 전체 건수를 문구로 낸다', () => {
    const view = toPageView({ page: 2, size: 50, total: 120 }, 50);

    expect(view.rangeLabel).toBe('51–100 / 전체 120건');
    expect(view.page).toBe(2);
    expect(view.totalPages).toBe(3);
    expect(view.canPrev).toBe(true);
    expect(view.canNext).toBe(true);
  });

  it('첫 쪽과 마지막 쪽에서 이동을 닫는다', () => {
    expect(toPageView({ page: 1, size: 50, total: 30 }, 30).canPrev).toBe(false);
    expect(toPageView({ page: 1, size: 50, total: 30 }, 30).canNext).toBe(false);
  });

  /* 보이는 것이 없으면 범위를 지어내지 않는다. 전체 건수는 그대로 밝힌다. */
  it('보이는 것이 없으면 전체 건수만 낸다', () => {
    expect(toPageView({ page: 1, size: 50, total: 0 }, 0).rangeLabel).toBe('전체 0건');
  });

  /*
   * **M06** — 결과는 있는데 이 쪽에는 없다. 「결과가 없다」와 사용자가 할 조치가 다르므로
   * 빈 상태의 안내가 갈린다(완료 조건 C07). 판정을 없애면 3쪽을 주소로 열었을 때
   * 「조건에 맞는 실사가 없습니다」가 떠 조건을 넓히게 만든다 — 실제로는 첫 쪽에 결과가 있다.
   */
  it('결과가 있는데 이 쪽에 없으면 쪽 밖으로 본다', () => {
    expect(toPageView({ page: 3, size: 50, total: 10 }, 0).isBeyondLast).toBe(true);
    /* 짝 방향 — 결과 자체가 없으면 쪽 밖이 아니다. */
    expect(toPageView({ page: 3, size: 50, total: 0 }, 0).isBeyondLast).toBe(false);
    expect(toPageView({ page: 1, size: 50, total: 10 }, 10).isBeyondLast).toBe(false);
  });

  /* 서버가 0을 주면 나눗셈이 무한대가 된다. 계산이 깨지지 않게 하한을 둔다. */
  it('쪽 크기가 0이어도 계산이 깨지지 않는다', () => {
    const view = toPageView({ page: 0, size: 0, total: 3 }, 3);

    expect(view.page).toBe(1);
    expect(Number.isFinite(view.totalPages)).toBe(true);
  });
});
