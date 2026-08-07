import { messages } from '@omf-mes/i18n';
import { describe, expect, it } from 'vitest';

import { toPageView } from './pagination';

const t = messages.stockStatus;

describe('toPageView — 지금 어디를 보고 있는가', () => {
  it('첫 쪽의 범위와 이동 가능 여부를 낸다', () => {
    const view = toPageView({ page: 1, size: 50, total: 120 }, 50);

    expect(view.page).toBe(1);
    expect(view.totalPages).toBe(3);
    expect(view.rangeLabel).toBe(t.pageNav.range(1, 50, 120));
    expect(view.canPrev).toBe(false);
    expect(view.canNext).toBe(true);
    expect(view.isBeyondLast).toBe(false);
  });

  it('가운데 쪽은 앞뒤로 다 갈 수 있다', () => {
    const view = toPageView({ page: 2, size: 50, total: 120 }, 50);

    expect(view.rangeLabel).toBe(t.pageNav.range(51, 100, 120));
    expect(view.canPrev).toBe(true);
    expect(view.canNext).toBe(true);
  });

  it('마지막 쪽은 다음으로 갈 수 없다', () => {
    const view = toPageView({ page: 3, size: 50, total: 120 }, 20);

    expect(view.rangeLabel).toBe(t.pageNav.range(101, 120, 120));
    expect(view.canNext).toBe(false);
  });

  /* 서버가 0을 주면 나눗셈이 무한대가 된다. 계산이 깨지지 않게 하한을 둔다. */
  it('쪽 크기가 0이어도 계산이 깨지지 않는다', () => {
    const view = toPageView({ page: 1, size: 0, total: 3 }, 3);

    expect(Number.isFinite(view.totalPages)).toBe(true);
    expect(view.totalPages).toBe(3);
  });

  it('쪽 번호가 0 이하로 오면 첫 쪽으로 본다', () => {
    expect(toPageView({ page: 0, size: 50, total: 10 }, 10).page).toBe(1);
  });

  /* 결과는 있는데 이 쪽에는 없다 — 「결과가 없다」와 사용자가 할 조치가 다르다. */
  it('결과가 있는데 쪽이 범위 밖이면 밝힌다', () => {
    expect(toPageView({ page: 9, size: 50, total: 45 }, 0).isBeyondLast).toBe(true);
  });

  /* 0건은 쪽 밖이 아니다 — 조건을 줄이라고 말해야 할 자리다. */
  it('결과가 0건이면 쪽 밖이 아니다', () => {
    expect(toPageView({ page: 1, size: 50, total: 0 }, 0).isBeyondLast).toBe(false);
    expect(toPageView({ page: 9, size: 50, total: 0 }, 0).isBeyondLast).toBe(false);
  });

  /* 보이는 것이 없으면 범위를 지어내지 않는다. 전체 건수는 그대로 밝힌다. */
  it('보이는 행이 없으면 전체 건수만 밝힌다', () => {
    expect(toPageView({ page: 9, size: 50, total: 45 }, 0).rangeLabel).toBe(
      t.pageNav.totalOnly(45),
    );
  });
});
