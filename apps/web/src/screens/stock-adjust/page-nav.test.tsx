import { messages } from '@omf-mes/i18n';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { PageNav, toPageView } from './page-nav';

const t = messages.stockAdjust;

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

type Meta = Parameters<typeof toPageView>[0];

const renderNav = (meta: Meta, shown: number, isLocked = false) => {
  const onChange = vi.fn<(page: number) => void>();

  render(<PageNav view={toPageView(meta, shown)} isLocked={isLocked} onChange={onChange} />);

  return { onChange, user: userEvent.setup() };
};

/* 공용 쪽 이동 줄(총 N건 · [처음] [이전] n / m [다음] [마지막])로 그린다 — 1쪽 · 0건이어도 늘 보인다(#360). */
describe('PageNav — 공용 쪽 이동 줄', () => {
  it('총 건수와 지금 위치를 보인다', () => {
    renderNav({ page: 2, size: 20, total: 45 }, 20);

    expect(screen.getByRole('navigation', { name: '쪽 이동' })).toBeInTheDocument();
    expect(screen.getByText('총 45건')).toBeInTheDocument();
    expect(screen.getByText('2 / 3')).toBeInTheDocument();
  });

  it('처음 · 이전 · 다음 · 마지막이 옮길 쪽을 알린다', async () => {
    const { onChange, user } = renderNav({ page: 2, size: 20, total: 45 }, 20);

    await user.click(screen.getByRole('button', { name: '처음' }));
    await user.click(screen.getByRole('button', { name: '이전' }));
    await user.click(screen.getByRole('button', { name: '다음' }));
    await user.click(screen.getByRole('button', { name: '마지막' }));

    expect(onChange.mock.calls).toEqual([[1], [1], [3], [3]]);
  });

  it('1쪽뿐이어도 줄은 보이고 단추만 잠긴다', () => {
    renderNav({ page: 1, size: 20, total: 5 }, 5);

    expect(screen.getByText('총 5건')).toBeInTheDocument();
    expect(screen.getByText('1 / 1')).toBeInTheDocument();
    for (const name of ['처음', '이전', '다음', '마지막']) {
      expect(screen.getByRole('button', { name })).toBeDisabled();
    }
  });

  it('0건이어도 줄이 보인다', () => {
    renderNav({ page: 1, size: 20, total: 0 }, 0);

    expect(screen.getByText('총 0건')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '다음' })).toBeDisabled();
  });

  it('잠기면 갈 수 있는 쪽의 단추도 잠긴다', () => {
    renderNav({ page: 2, size: 20, total: 45 }, 20, true);

    for (const name of ['처음', '이전', '다음', '마지막']) {
      expect(screen.getByRole('button', { name })).toBeDisabled();
    }
  });
});
