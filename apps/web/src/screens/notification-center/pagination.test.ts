import { messages } from '@omf-mes/i18n';
import { describe, expect, it } from 'vitest';

import { toPageView } from './pagination';

const t = messages.notificationCenter;

describe('toPageView', () => {
  it('서버가 준 쪽을 정본으로 쓴다', () => {
    /* 주소의 쪽 번호를 쓰면 서버가 다른 쪽을 돌려줬을 때 표시와 내용이 어긋난다. */
    expect(toPageView({ page: 3, size: 50, total: 137 }, 37).page).toBe(3);
  });

  it('범위 표기가 응답의 size에서 나온다 — 화면이 쪽 크기를 지어내지 않는다', () => {
    expect(toPageView({ page: 3, size: 50, total: 137 }, 37).rangeLabel).toBe(
      t.pageNav.range(101, 137, 137),
    );
  });

  it('쪽 크기가 달라지면 범위도 따라 달라진다', () => {
    /* 화면이 50을 상수로 심었다면 이 단언이 깨진다 — 서버 기본이 바뀌면 표기가 어긋난다. */
    expect(toPageView({ page: 2, size: 20, total: 45 }, 20).rangeLabel).toBe(
      t.pageNav.range(21, 40, 45),
    );
  });

  it('보이는 것이 없으면 범위를 지어내지 않고 전체 건수만 밝힌다', () => {
    expect(toPageView({ page: 9, size: 50, total: 137 }, 0).rangeLabel).toBe(
      t.pageNav.totalOnly(137),
    );
  });

  it('경계에서 잠근다 — 첫 쪽에 이전이 없고 마지막 쪽에 다음이 없다', () => {
    const first = toPageView({ page: 1, size: 50, total: 137 }, 50);
    expect(first.canPrev).toBe(false);
    expect(first.canNext).toBe(true);

    const last = toPageView({ page: 3, size: 50, total: 137 }, 37);
    expect(last.canPrev).toBe(true);
    expect(last.canNext).toBe(false);
  });

  it('한 쪽에 다 들어가면 양쪽이 다 잠긴다', () => {
    const only = toPageView({ page: 1, size: 50, total: 12 }, 12);

    expect(only.canPrev).toBe(false);
    expect(only.canNext).toBe(false);
    expect(only.totalPages).toBe(1);
  });

  /**
   * ⭐ **결과가 있는데 이 쪽에 없는 것은 0건과 다르다.** 가르지 않으면 사용자가 조건을 헛되이
   * 넓힌다 — 넓혀도 그 쪽에는 여전히 아무것도 없다.
   */
  it('결과가 있는데 이 쪽에 없으면 그 사실을 든다', () => {
    expect(toPageView({ page: 9, size: 50, total: 137 }, 0).isBeyondLast).toBe(true);
  });

  it('결과가 0건이면 넘어선 쪽이 아니다 — 그 둘은 다른 사태다', () => {
    expect(toPageView({ page: 1, size: 50, total: 0 }, 0).isBeyondLast).toBe(false);
    expect(toPageView({ page: 3, size: 50, total: 0 }, 0).isBeyondLast).toBe(false);
  });

  it('마지막 쪽 자체는 넘어선 것이 아니다', () => {
    expect(toPageView({ page: 3, size: 50, total: 137 }, 37).isBeyondLast).toBe(false);
  });

  it('서버가 0을 줘도 계산이 깨지지 않는다', () => {
    /* size가 0이면 나눗셈이 무한대가 되어 totalPages가 Infinity로 샌다. */
    const view = toPageView({ page: 0, size: 0, total: 0 }, 0);

    expect(view.page).toBe(1);
    expect(Number.isFinite(view.totalPages)).toBe(true);
    expect(view.canPrev).toBe(false);
    expect(view.canNext).toBe(false);
  });
});
