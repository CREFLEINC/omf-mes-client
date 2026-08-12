import { messages } from '@omf-mes/i18n';
import { describe, expect, it } from 'vitest';

import { toPageView } from './pagination';

const t = messages.approvalInbox;

describe('toPageView', () => {
  it('서버가 준 쪽을 정본으로 쓴다', () => {
    const view = toPageView({ page: 2, size: 20, total: 45 }, 20);

    expect(view.page).toBe(2);
    expect(view.totalPages).toBe(3);
    expect(view.rangeLabel).toBe(t.pageNav.range(21, 40, 45));
    expect(view.canPrev).toBe(true);
    expect(view.canNext).toBe(true);
    expect(view.isBeyondLast).toBe(false);
  });

  it('첫 쪽에서는 이전으로 갈 수 없다', () => {
    expect(toPageView({ page: 1, size: 20, total: 45 }, 20).canPrev).toBe(false);
  });

  it('마지막 쪽에서는 다음으로 갈 수 없다', () => {
    expect(toPageView({ page: 3, size: 20, total: 45 }, 5).canNext).toBe(false);
  });

  it('보이는 것이 없으면 범위를 지어내지 않고 전체 건수만 밝힌다', () => {
    expect(toPageView({ page: 1, size: 20, total: 0 }, 0).rangeLabel).toBe(t.pageNav.totalOnly(0));
  });

  it('결과는 있는데 이 쪽에 없으면 범위 밖이다', () => {
    expect(toPageView({ page: 9, size: 20, total: 45 }, 0).isBeyondLast).toBe(true);
  });

  it('결과가 0건이면 범위 밖이 아니다 — 「없음」과 「이 쪽에 없음」은 다른 사실이다', () => {
    expect(toPageView({ page: 1, size: 20, total: 0 }, 0).isBeyondLast).toBe(false);
  });

  it('서버가 0을 줘도 계산이 깨지지 않는다', () => {
    const view = toPageView({ page: 0, size: 0, total: 0 }, 0);

    expect(view.page).toBe(1);
    expect(Number.isFinite(view.totalPages)).toBe(true);
  });
});
