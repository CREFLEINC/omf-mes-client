import { messages } from '@omf-mes/i18n';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { PageNav, toPageView, type PageView } from './page-nav';

const t = messages.stockAdjust;

const view = (overrides: Partial<PageView> = {}): PageView => ({
  page: 2,
  totalPages: 5,
  rangeLabel: t.pageNav.range(51, 100, 220),
  canPrev: true,
  canNext: true,
  isBeyondLast: false,
  ...overrides,
});

const prevButton = (): HTMLElement => screen.getByRole('button', { name: t.actions.prevPage });
const nextButton = (): HTMLElement => screen.getByRole('button', { name: t.actions.nextPage });

describe('toPageView — 서버가 준 쪽이 정본이다', () => {
  it('보고 있는 쪽과 전체 쪽 수를 서버 응답에서 낸다', () => {
    expect(toPageView({ page: 2, size: 50, total: 220 }, 50)).toMatchObject({
      page: 2,
      totalPages: 5,
      canPrev: true,
      canNext: true,
      isBeyondLast: false,
    });
  });

  it('첫 쪽에서는 이전으로 갈 수 없고 끝 쪽에서는 다음으로 갈 수 없다', () => {
    expect(toPageView({ page: 1, size: 50, total: 20 }, 20)).toMatchObject({
      canPrev: false,
      canNext: false,
    });
  });

  it('보이는 범위를 서버가 준 수로 적는다', () => {
    expect(toPageView({ page: 2, size: 50, total: 220 }, 50).rangeLabel).toBe(
      t.pageNav.range(51, 100, 220),
    );
  });

  /** 보이는 것이 없으면 범위를 지어내지 않는다 — 「1–0」은 사실이 아니다. */
  it('보이는 줄이 없으면 전체 건수만 밝힌다', () => {
    expect(toPageView({ page: 3, size: 50, total: 220 }, 0).rangeLabel).toBe(
      t.pageNav.totalOnly(220),
    );
  });

  /**
   * 결과는 있는데 이 쪽에는 없다 — 조건을 바꾸거나 주소를 손으로 고치면 생긴다.
   * 「결과가 없다」와 사용자가 할 조치가 다르다.
   */
  it('마지막 쪽을 넘어선 자리를 따로 가른다', () => {
    expect(toPageView({ page: 9, size: 50, total: 220 }, 0).isBeyondLast).toBe(true);
    expect(toPageView({ page: 1, size: 50, total: 0 }, 0).isBeyondLast).toBe(false);
  });

  /**
   * ⭐ **경계를 잰다**(검증 문제 ②). 전체 220건·쪽 크기 50이면 마지막 쪽이 5다.
   *
   * 경계에서 멀리 떨어진 값(9)만 재면 **한 칸 어긋난 판정**(`> totalPages + 1`)이 그대로
   * 통과한다 — 그러면 **가장 흔한 갈래**(마지막 쪽 바로 다음)에서 「첫 쪽으로」 버튼이 사라지고
   * 사용자는 조건을 의심하게 된다. 마지막 쪽·그 다음 칸·그 다음을 **세 점으로** 못 박는다.
   */
  it('마지막 쪽은 넘어선 것이 아니고 그 다음 칸부터 넘어선 것이다', () => {
    expect(toPageView({ page: 5, size: 50, total: 220 }, 20).isBeyondLast).toBe(false);
    expect(toPageView({ page: 6, size: 50, total: 220 }, 0).isBeyondLast).toBe(true);
    expect(toPageView({ page: 7, size: 50, total: 220 }, 0).isBeyondLast).toBe(true);
  });

  /** 서버가 0을 주면 나눗셈이 무한대가 된다 — 계산이 깨지지 않아야 화면이 선다. */
  it('쪽 크기가 0으로 와도 계산이 깨지지 않는다', () => {
    expect(toPageView({ page: 0, size: 0, total: 0 }, 0)).toMatchObject({
      page: 1,
      totalPages: 0,
      canPrev: false,
      canNext: false,
    });
  });
});

describe('PageNav — 쪽 이동', () => {
  it('지금 보고 있는 범위를 글자로 보인다', () => {
    render(<PageNav view={view()} onChange={vi.fn()} />);

    expect(screen.getByRole('navigation', { name: t.pageNav.label })).toHaveTextContent(
      t.pageNav.range(51, 100, 220),
    );
  });

  it('이전·다음을 누르면 그 쪽으로 옮긴다', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();

    render(<PageNav view={view()} onChange={onChange} />);

    await user.click(nextButton());
    await user.click(prevButton());

    expect(onChange).toHaveBeenNthCalledWith(1, 3);
    expect(onChange).toHaveBeenNthCalledWith(2, 1);
  });

  it('갈 수 없는 쪽의 버튼은 잠긴다', () => {
    render(<PageNav view={view({ canPrev: false, canNext: false })} onChange={vi.fn()} />);

    expect(prevButton()).toBeDisabled();
    expect(nextButton()).toBeDisabled();
  });

  /**
   * **쪽을 옮기면 고른 전표가 풀린다** — 나가는 중인 쓰기가 있으면 그 되먹임이 다른 맥락에
   * 도착한다. 양성 앵커(열려 있는 상태)를 먼저 재고 그 뒤에 잠금을 잰다.
   */
  it('잠기면 갈 수 있는 쪽의 버튼도 잠긴다', () => {
    const { rerender } = render(<PageNav view={view()} onChange={vi.fn()} />);

    expect(nextButton()).toBeEnabled();

    rerender(<PageNav view={view()} isLocked onChange={vi.fn()} />);

    expect(prevButton()).toBeDisabled();
    expect(nextButton()).toBeDisabled();
  });

  /** 쪽 번호 목록을 만들지 않는다 — 버튼은 이전·다음 둘뿐이다. */
  it('쪽 번호 버튼을 만들지 않는다', () => {
    render(<PageNav view={view()} onChange={vi.fn()} />);

    const nav = screen.getByRole('navigation', { name: t.pageNav.label });

    expect(within(nav).getAllByRole('button')).toHaveLength(2);
  });
});
