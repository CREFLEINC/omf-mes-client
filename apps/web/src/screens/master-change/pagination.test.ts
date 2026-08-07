import { describe, expect, it } from 'vitest';

import { toPageView } from './pagination';

describe('toPageView — 지금 어디를 보고 있는가', () => {
  it('첫 쪽에서는 이전이 잠기고 다음이 열린다', () => {
    const view = toPageView({ page: 1, size: 50, total: 120 }, 50);

    expect(view.canPrev).toBe(false);
    expect(view.canNext).toBe(true);
    expect(view.rangeLabel).toBe('1–50 / 전체 120건');
  });

  it('가운데 쪽에서는 양쪽이 다 열린다', () => {
    const view = toPageView({ page: 2, size: 50, total: 120 }, 50);

    expect(view.canPrev).toBe(true);
    expect(view.canNext).toBe(true);
    expect(view.rangeLabel).toBe('51–100 / 전체 120건');
  });

  it('마지막 쪽에서는 다음이 잠긴다', () => {
    const view = toPageView({ page: 3, size: 50, total: 120 }, 20);

    expect(view.canNext).toBe(false);
    expect(view.rangeLabel).toBe('101–120 / 전체 120건');
  });

  /*
   * 경계 비교를 뒤집으면(`<=`) 여기서 드러난다 — 총 건수가 쪽 크기의 배수일 때
   * 마지막 쪽에서도 「다음」이 열려 빈 쪽으로 넘어간다.
   */
  it('총 건수가 쪽 크기의 배수여도 마지막 쪽 판정이 맞다', () => {
    expect(toPageView({ page: 2, size: 50, total: 100 }, 50).canNext).toBe(false);
    expect(toPageView({ page: 1, size: 50, total: 100 }, 50).canNext).toBe(true);
  });

  it('결과가 0건이면 양쪽이 다 잠기고 전체 건수만 밝힌다', () => {
    const view = toPageView({ page: 1, size: 50, total: 0 }, 0);

    expect(view.canPrev).toBe(false);
    expect(view.canNext).toBe(false);
    expect(view.rangeLabel).toBe('전체 0건');
    expect(view.isBeyondLast).toBe(false);
  });

  /* 결과는 있는데 이 쪽에는 없다 — 「결과가 없다」와 사용자가 할 조치가 다르다. */
  it('마지막 쪽보다 큰 쪽은 범위 밖으로 본다', () => {
    const view = toPageView({ page: 9, size: 50, total: 120 }, 0);

    expect(view.isBeyondLast).toBe(true);
    expect(view.rangeLabel).toBe('전체 120건');
  });

  it('서버가 쪽 크기를 0으로 주어도 계산이 깨지지 않는다', () => {
    const view = toPageView({ page: 1, size: 0, total: 0 }, 0);

    expect(view.totalPages).toBe(0);
    expect(view.canNext).toBe(false);
  });

  /* 서버가 준 쪽을 정본으로 쓴다. 주소의 쪽 번호를 쓰면 표시와 내용이 어긋난다. */
  it('서버가 준 쪽 번호로 위치를 만든다', () => {
    expect(toPageView({ page: 3, size: 10, total: 100 }, 10).page).toBe(3);
  });
});
