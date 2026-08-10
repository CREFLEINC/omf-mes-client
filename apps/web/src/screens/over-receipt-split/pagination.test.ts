import { messages } from '@omf-mes/i18n';
import { describe, expect, it } from 'vitest';

import { toPageView } from './pagination';

const t = messages.overReceiptSplit;

describe('toPageView — 지금 어디를 보고 있는가', () => {
  it('보이는 범위와 전체 건수를 함께 밝힌다', () => {
    const view = toPageView({ page: 3, size: 50, total: 240 }, 50);

    expect(view.page).toBe(3);
    expect(view.totalPages).toBe(5);
    expect(view.rangeLabel).toBe(t.pageNav.range(101, 150, 240));
    expect(view.canPrev).toBe(true);
    expect(view.canNext).toBe(true);
  });

  it('첫 쪽에서는 이전으로 갈 수 없고 마지막 쪽에서는 다음으로 갈 수 없다', () => {
    expect(toPageView({ page: 1, size: 50, total: 30 }, 30).canPrev).toBe(false);
    expect(toPageView({ page: 1, size: 50, total: 30 }, 30).canNext).toBe(false);
  });

  /* 보이는 것이 없으면 범위를 지어내지 않는다. 전체 건수는 그대로 밝힌다. */
  it('보이는 행이 없으면 범위 대신 전체 건수만 밝힌다', () => {
    expect(toPageView({ page: 9, size: 50, total: 45 }, 0).rangeLabel).toBe(t.pageNav.totalOnly(45));
  });

  /*
   * **M07** — 결과는 있는데 이 쪽에는 없다. 「결과가 없다」와 갈라야 사용자가 할 조치가 드러난다.
   */
  it('결과가 있는데 이 쪽에 없으면 쪽 밖으로 판정한다', () => {
    expect(toPageView({ page: 9, size: 50, total: 45 }, 0).isBeyondLast).toBe(true);
  });

  /* 짝이 되는 방향 — 전체가 0건이면 「쪽 밖」이 아니라 「결과 없음」이다. */
  it('전체가 0건이면 쪽 밖이 아니다', () => {
    expect(toPageView({ page: 1, size: 50, total: 0 }, 0).isBeyondLast).toBe(false);
  });

  /* 서버가 0을 주면 나눗셈이 무한대가 된다. 계산이 깨지지 않게 하한을 둔다. */
  it('쪽 크기가 0이어도 계산이 깨지지 않는다', () => {
    const view = toPageView({ page: 0, size: 0, total: 3 }, 3);

    expect(view.page).toBe(1);
    expect(Number.isFinite(view.totalPages)).toBe(true);
  });
});
