import { messages } from '@omf-mes/i18n';
import { describe, expect, it } from 'vitest';

import { toPageView } from './pagination';

const t = messages.putawayRule;

describe('toPageView', () => {
  it('첫 쪽에서 이전이 잠기고 다음이 열린다', () => {
    const view = toPageView({ page: 1, size: 20, total: 45 }, 20);

    expect(view.canPrev).toBe(false);
    expect(view.canNext).toBe(true);
    expect(view.totalPages).toBe(3);
    expect(view.rangeLabel).toBe(t.pageNav.range(1, 20, 45));
  });

  it('마지막 쪽에서 다음이 잠긴다', () => {
    const view = toPageView({ page: 3, size: 20, total: 45 }, 5);

    expect(view.canPrev).toBe(true);
    expect(view.canNext).toBe(false);
    expect(view.rangeLabel).toBe(t.pageNav.range(41, 45, 45));
  });

  /** 보이는 것이 없으면 범위를 지어내지 않는다. 전체 건수는 그대로 밝힌다. */
  it('보이는 행이 없으면 전체 건수만 밝힌다', () => {
    expect(toPageView({ page: 1, size: 20, total: 0 }, 0).rangeLabel).toBe(t.pageNav.totalOnly(0));
  });

  /** 결과는 있는데 이 쪽에 없다 — 주소 조작·조건 변경으로 생기며 빈 상태의 안내가 갈린다. */
  it('결과가 있는데 범위 밖 쪽이면 그 사실을 밝힌다', () => {
    expect(toPageView({ page: 9, size: 20, total: 45 }, 0).isBeyondLast).toBe(true);
  });

  it('결과가 0건이면 범위 밖으로 보지 않는다 — 그때는 그냥 비어 있는 것이다', () => {
    expect(toPageView({ page: 1, size: 20, total: 0 }, 0).isBeyondLast).toBe(false);
  });

  /** 서버가 0을 주면 나눗셈이 무한대가 된다. 계산이 깨지지 않게 하한을 둔다. */
  it('크기가 0이어도 계산이 깨지지 않는다', () => {
    const view = toPageView({ page: 0, size: 0, total: 3 }, 3);

    expect(view.page).toBe(1);
    expect(Number.isFinite(view.totalPages)).toBe(true);
  });
});
