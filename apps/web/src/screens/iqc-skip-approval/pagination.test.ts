import { messages } from '@omf-mes/i18n';
import { describe, expect, it } from 'vitest';

import { toPageView } from './pagination';

const t = messages.iqcSkipApproval;

describe('toPageView', () => {
  it('보고 있는 범위와 전체 건수를 낸다', () => {
    const view = toPageView({ page: 2, size: 20, total: 45 }, 20);

    expect(view.page).toBe(2);
    expect(view.totalPages).toBe(3);
    expect(view.rangeLabel).toBe(t.pageNav.range(21, 40, 45));
    expect(view.canPrev).toBe(true);
    expect(view.canNext).toBe(true);
    expect(view.isBeyondLast).toBe(false);
  });

  it('첫 쪽에서는 이전이 잠기고 마지막 쪽에서는 다음이 잠긴다', () => {
    expect(toPageView({ page: 1, size: 20, total: 45 }, 20).canPrev).toBe(false);
    expect(toPageView({ page: 3, size: 20, total: 45 }, 5).canNext).toBe(false);
  });

  it('보이는 것이 없으면 범위를 지어내지 않고 전체 건수만 밝힌다', () => {
    expect(toPageView({ page: 1, size: 20, total: 0 }, 0).rangeLabel).toBe(t.pageNav.totalOnly(0));
  });

  /** 결과는 있는데 이 쪽에는 없다 — 주소 조작·조건 변경으로 실제로 생긴다. */
  it('결과가 있는데 쪽이 범위 밖이면 그 사실을 낸다', () => {
    expect(toPageView({ page: 5, size: 20, total: 45 }, 0).isBeyondLast).toBe(true);
  });

  it('결과가 아예 없으면 범위 밖이 아니다 — 두 빈 상태는 조치가 다르다', () => {
    expect(toPageView({ page: 5, size: 20, total: 0 }, 0).isBeyondLast).toBe(false);
  });

  it('서버가 0을 줘도 계산이 깨지지 않는다', () => {
    const view = toPageView({ page: 0, size: 0, total: 0 }, 0);

    expect(view.page).toBe(1);
    expect(Number.isFinite(view.totalPages)).toBe(true);
  });

  /** 서버가 준 쪽을 정본으로 쓴다 — 주소의 쪽을 쓰면 표시와 내용이 어긋난다. */
  it('서버가 준 쪽을 그대로 낸다', () => {
    expect(toPageView({ page: 3, size: 10, total: 100 }, 10).page).toBe(3);
  });
});
