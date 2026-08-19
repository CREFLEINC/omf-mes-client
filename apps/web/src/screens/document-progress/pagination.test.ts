import { messages } from '@omf-mes/i18n';
import { describe, expect, it } from 'vitest';

import { toPageView } from './pagination';

const t = messages.documentProgress;

describe('toPageView', () => {
  it('보고 있는 범위와 전체 건수를 함께 낸다', () => {
    const view = toPageView({ page: 2, size: 50, total: 120 }, 50);

    expect(view.rangeLabel).toBe(t.pageNav.range(51, 100, 120));
    expect(view.totalPages).toBe(3);
    expect(view.canPrev).toBe(true);
    expect(view.canNext).toBe(true);
  });

  it('첫 쪽에서는 이전으로 갈 수 없다', () => {
    const view = toPageView({ page: 1, size: 50, total: 20 }, 20);

    expect(view.canPrev).toBe(false);
    expect(view.canNext).toBe(false);
  });

  /* 보이는 것이 없으면 범위를 지어내지 않는다. 전체 건수는 그대로 밝힌다. */
  it('보이는 것이 없으면 범위 대신 전체 건수만 낸다', () => {
    expect(toPageView({ page: 1, size: 50, total: 0 }, 0).rangeLabel).toBe(t.pageNav.totalOnly(0));
  });

  /* 서버가 0을 주면 나눗셈이 무한대가 된다 — 계산이 깨지지 않게 하한을 둔다. */
  it('쪽 크기가 0으로 와도 계산이 깨지지 않는다', () => {
    const view = toPageView({ page: 0, size: 0, total: 3 }, 3);

    expect(view.page).toBe(1);
    expect(Number.isFinite(view.totalPages)).toBe(true);
  });

  /* 결과는 있는데 이 쪽에는 없다 — 「결과가 없다」와 사용자가 할 조치가 다르다. */
  it('마지막 쪽을 넘어선 상태를 가려낸다', () => {
    expect(toPageView({ page: 5, size: 50, total: 120 }, 0).isBeyondLast).toBe(true);
    expect(toPageView({ page: 1, size: 50, total: 0 }, 0).isBeyondLast).toBe(false);
  });
});
