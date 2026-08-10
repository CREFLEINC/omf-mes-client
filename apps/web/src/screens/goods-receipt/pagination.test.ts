import { messages } from '@omf-mes/i18n';
import { describe, expect, it } from 'vitest';

import { toPageView } from './pagination';

const t = messages.goodsReceipt;

describe('toPageView', () => {
  it('서버가 준 쪽을 정본으로 쓴다', () => {
    const view = toPageView({ page: 2, size: 50, total: 120 }, 50);

    expect(view.page).toBe(2);
    expect(view.totalPages).toBe(3);
    expect(view.canPrev).toBe(true);
    expect(view.canNext).toBe(true);
  });

  it('첫 쪽에서는 이전으로 갈 수 없다', () => {
    expect(toPageView({ page: 1, size: 50, total: 120 }, 50).canPrev).toBe(false);
  });

  it('마지막 쪽에서는 다음으로 갈 수 없다', () => {
    expect(toPageView({ page: 3, size: 50, total: 120 }, 20).canNext).toBe(false);
  });

  it('보이는 범위를 사람이 읽는 문구로 낸다', () => {
    expect(toPageView({ page: 2, size: 50, total: 120 }, 50).rangeLabel).toBe(
      t.pageNav.range(51, 100, 120),
    );
  });

  /* 보이는 것이 없으면 범위를 지어내지 않는다. 전체 건수는 그대로 밝힌다. */
  it('보이는 것이 없으면 전체 건수만 낸다', () => {
    expect(toPageView({ page: 1, size: 50, total: 0 }, 0).rangeLabel).toBe(t.pageNav.totalOnly(0));
  });

  /*
   * **M06** — 「결과가 없다」와 「이 쪽에는 없다」는 사용자가 할 조치가 다르다.
   * 판정을 없애면 3쪽에서 조건을 좁힌 사용자에게 「조건에 맞는 것이 없다」로만 보인다.
   */
  it('결과가 있는데 이 쪽에 없으면 쪽 밖으로 본다', () => {
    expect(toPageView({ page: 5, size: 50, total: 120 }, 0).isBeyondLast).toBe(true);
  });

  it('결과 자체가 없으면 쪽 밖이 아니다', () => {
    expect(toPageView({ page: 1, size: 50, total: 0 }, 0).isBeyondLast).toBe(false);
  });

  /* 서버가 0을 주면 나눗셈이 무한대가 된다. 계산이 깨지지 않게 하한을 둔다. */
  it('쪽 크기가 0이어도 계산이 깨지지 않는다', () => {
    const view = toPageView({ page: 0, size: 0, total: 3 }, 3);

    expect(view.page).toBe(1);
    expect(Number.isFinite(view.totalPages)).toBe(true);
  });
});
