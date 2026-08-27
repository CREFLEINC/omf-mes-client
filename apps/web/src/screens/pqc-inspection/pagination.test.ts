import { messages } from '@omf-mes/i18n';
import { describe, expect, it } from 'vitest';

import { toPageView } from './pagination';

const t = messages.pqcInspection.pageNav;

describe('toPageView', () => {
  it('보고 있는 범위와 전체 건수를 밝힌다', () => {
    const view = toPageView({ page: 2, size: 50, total: 120 }, 50);

    expect(view.rangeLabel).toBe(t.range(51, 100, 120));
  });

  it('마지막 쪽은 실제로 보이는 만큼만 범위로 낸다', () => {
    const view = toPageView({ page: 3, size: 50, total: 120 }, 20);

    expect(view.rangeLabel).toBe(t.range(101, 120, 120));
  });

  it('보이는 것이 없으면 범위를 지어내지 않고 전체 건수만 밝힌다', () => {
    expect(toPageView({ page: 1, size: 50, total: 0 }, 0).rangeLabel).toBe(t.totalOnly(0));
  });

  it('서버가 준 쪽을 정본으로 쓴다 — 주소와 어긋나도 내용을 따른다', () => {
    expect(toPageView({ page: 4, size: 10, total: 100 }, 10).page).toBe(4);
  });

  it('첫 쪽에서는 이전으로 갈 수 없고 마지막 쪽에서는 다음으로 갈 수 없다', () => {
    expect(toPageView({ page: 1, size: 50, total: 120 }, 50)).toMatchObject({
      canPrev: false,
      canNext: true,
    });
    expect(toPageView({ page: 3, size: 50, total: 120 }, 20)).toMatchObject({
      canPrev: true,
      canNext: false,
    });
  });

  it('결과는 있는데 이 쪽에는 없는 상태를 가른다 — 조건이 아니라 쪽이 문제다', () => {
    expect(toPageView({ page: 9, size: 50, total: 120 }, 0).isBeyondLast).toBe(true);
  });

  it('결과가 아예 없으면 쪽을 넘어선 것이 아니다 — 조건을 넓히라고 말해야 하는 자리다', () => {
    expect(toPageView({ page: 1, size: 50, total: 0 }, 0).isBeyondLast).toBe(false);
  });

  it.each([
    ['크기가 0', { page: 1, size: 0, total: 10 }],
    ['쪽이 0', { page: 0, size: 50, total: 10 }],
  ])('서버가 %s 을 줘도 계산이 깨지지 않는다', (_label, meta) => {
    const view = toPageView(meta, 5);

    expect(Number.isFinite(view.totalPages)).toBe(true);
    expect(view.page).toBeGreaterThanOrEqual(1);
  });
});
