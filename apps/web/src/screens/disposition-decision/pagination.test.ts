import { messages } from '@omf-mes/i18n';
import { describe, expect, it } from 'vitest';

import { toPageView } from './pagination';

describe('toPageView', () => {
  it('첫 쪽에서는 이전으로 갈 수 없다', () => {
    const view = toPageView({ page: 1, size: 50, total: 120 }, 50);

    expect(view.canPrev).toBe(false);
    expect(view.canNext).toBe(true);
  });

  it('마지막 쪽에서는 다음으로 갈 수 없다', () => {
    const view = toPageView({ page: 3, size: 50, total: 120 }, 20);

    expect(view.canPrev).toBe(true);
    expect(view.canNext).toBe(false);
  });

  it('마지막 쪽을 넘어서면 그 사실을 알린다', () => {
    expect(toPageView({ page: 4, size: 50, total: 120 }, 0).isBeyondLast).toBe(true);
  });

  it('결과가 하나도 없으면 넘어선 것이 아니다 — 첫 쪽이 비었을 뿐이다', () => {
    expect(toPageView({ page: 1, size: 50, total: 0 }, 0).isBeyondLast).toBe(false);
  });

  it('보이는 구간을 전체 건수와 함께 적는다', () => {
    expect(toPageView({ page: 2, size: 50, total: 120 }, 50).rangeLabel).toBe(
      messages.dispositionDecision.page.range(51, 100, 120),
    );
  });

  it('보이는 행이 없으면 전체 건수만 적는다', () => {
    expect(toPageView({ page: 1, size: 50, total: 0 }, 0).rangeLabel).toBe(
      messages.dispositionDecision.page.total(0),
    );
  });

  it('마지막 쪽이 덜 찬 경우에도 그 쪽까지 갈 수 있다', () => {
    // 120건을 50씩 나누면 3쪽이고 마지막 쪽은 20건이다. 쪽수를 내림으로 세면
    // 2쪽에서 다음으로 갈 수 없게 되어 101–120이 영영 보이지 않는다.
    expect(toPageView({ page: 2, size: 50, total: 120 }, 50).canNext).toBe(true);
  });

  it('마지막 쪽 자체는 넘어선 쪽이 아니다', () => {
    // 경계를 「이상」으로 잘못 잡으면 마지막 쪽이 「없는 쪽」으로 표시된다.
    expect(toPageView({ page: 3, size: 50, total: 120 }, 20).isBeyondLast).toBe(false);
  });

  it('크기가 0으로 와도 나눗셈이 깨지지 않는다', () => {
    expect(() => toPageView({ page: 0, size: 0, total: 3 }, 3)).not.toThrow();
    expect(toPageView({ page: 0, size: 0, total: 3 }, 3).page).toBe(1);
  });
});
