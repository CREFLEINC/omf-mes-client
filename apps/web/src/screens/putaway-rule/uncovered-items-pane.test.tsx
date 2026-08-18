import { messages } from '@omf-mes/i18n';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { uncoveredItemFixtures } from './fixtures';
import { UncoveredItemsPane, type UncoveredItemsPaneProps } from './uncovered-items-pane';

const t = messages.putawayRule;

const baseProps = (overrides: Partial<UncoveredItemsPaneProps> = {}): UncoveredItemsPaneProps => ({
  items: uncoveredItemFixtures,
  total: uncoveredItemFixtures.length,
  isLoading: false,
  loadError: null,
  ...overrides,
});

const renderPane = (overrides: Partial<UncoveredItemsPaneProps> = {}) => {
  const props = baseProps(overrides);
  const result = render(<UncoveredItemsPane {...props} />);

  return { ...props, ...result, user: userEvent.setup() };
};

const expandToggle = (): HTMLElement =>
  screen.getByRole('button', { name: t.actions.expandUncovered });

describe('UncoveredItemsPane — 건수', () => {
  /**
   * ⭐ 등록된 것만 보이면 「비어 있다」는 사실이 화면 어디에도 드러나지 않는다(공유계약 G-12).
   * 건수는 **펼치기 전에** 보여야 한다.
   */
  it('펼치기 전에도 건수가 보인다', () => {
    renderPane();

    expect(screen.getByText(t.uncovered.countTitle(2))).toBeInTheDocument();
    expect(screen.getByText(t.uncovered.countDescription)).toBeInTheDocument();
  });

  /**
   * **0건은 좋은 상태다.** 경고 톤을 쓰면 사용자가 조치할 것이 있다고 읽는다 —
   * 라이브 강도가 assertive인 `alert`가 아니라 `status`로 서야 한다.
   */
  it('0건은 경고 톤을 쓰지 않는다', () => {
    renderPane({ items: [], total: 0 });

    expect(screen.getByText(t.uncovered.noneTitle)).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  /** 0건이면 펼칠 것이 없다 — 눌러도 아무 일이 없는 손잡이를 두지 않는다. */
  it('0건에서는 펼침 손잡이를 두지 않는다', () => {
    renderPane({ items: [], total: 0 });

    expect(
      screen.queryByRole('button', { name: t.actions.expandUncovered }),
    ).not.toBeInTheDocument();
  });

  /** 건수가 있으면 경고다 — 그 품목들이 현장에서 위치 검증 없이 통과한다. */
  it('건수가 있으면 경고로 선다', () => {
    renderPane();

    expect(screen.getByRole('alert')).toBeInTheDocument();
  });
});

describe('UncoveredItemsPane — 펼침', () => {
  it('처음에는 접혀 있다', () => {
    renderPane();

    expect(expandToggle()).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('펼치면 품목 목록이 보인다', async () => {
    const { user } = renderPane();

    await user.click(expandToggle());

    expect(await screen.findByRole('table')).toBeInTheDocument();
    expect(screen.getByText('SYN-ITEM-03')).toBeInTheDocument();
    expect(screen.getByText('합성품목 다')).toBeInTheDocument();
  });

  it('펼친 뒤에는 접는 손잡이가 된다', async () => {
    const { user } = renderPane();

    await user.click(expandToggle());

    const toggle = screen.getByRole('button', { name: t.actions.collapseUncovered });

    expect(toggle).toHaveAttribute('aria-expanded', 'true');

    await user.click(toggle);

    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  /**
   * **접혀 있는 동안에는 가리키지 않는다.** 본문이 조건부 렌더라 접히면 그 id를 가진 요소가
   * DOM에 없는데, `aria-controls`는 존재하는 요소를 가리켜야 한다.
   */
  it('접혀 있는 동안 없는 요소를 가리키지 않는다', async () => {
    const { user } = renderPane();

    expect(expandToggle()).not.toHaveAttribute('aria-controls');

    await user.click(expandToggle());

    const controls = screen
      .getByRole('button', { name: t.actions.collapseUncovered })
      .getAttribute('aria-controls');

    expect(controls).not.toBeNull();
    expect(document.getElementById(controls ?? '')).not.toBeNull();
  });

  /** 입고 시각이 없는 것과 못 알아본 것은 다르다 — 없는 것은 그 사실을 적는다. */
  it('입고 이력이 없는 품목은 그 사실을 적는다', async () => {
    const { user } = renderPane();

    await user.click(expandToggle());

    expect(await screen.findByText(t.values.neverReceived)).toBeInTheDocument();
  });

  it('입고 시각을 연·월·일 시·분으로 낸다', async () => {
    const { user } = renderPane();

    await user.click(expandToggle());

    expect(await screen.findByText('2026-08-06 09:14')).toBeInTheDocument();
  });

  /** 잘림을 감추면 사용자가 앞쪽 일부를 전부로 읽는다. */
  it('건수보다 적게 왔으면 잘림을 밝힌다', async () => {
    const { user } = renderPane({ total: 12 });

    await user.click(expandToggle());

    expect(await screen.findByText(t.uncovered.truncated)).toBeInTheDocument();
  });

  it('전부 왔으면 잘림을 말하지 않는다', async () => {
    const { user } = renderPane();

    await user.click(expandToggle());

    expect(await screen.findByRole('table')).toBeInTheDocument();
    expect(screen.queryByText(t.uncovered.truncated)).not.toBeInTheDocument();
  });

  /** 건수와 목록이 어긋난 상태를 감추지 않는다. */
  it('건수는 있는데 목록이 비면 그 사실을 말한다', async () => {
    const { user } = renderPane({ items: [], total: 3 });

    await user.click(expandToggle());

    expect(await screen.findByText(t.uncovered.emptyListTitle)).toBeInTheDocument();
  });
});

describe('UncoveredItemsPane — 로딩과 실패', () => {
  /**
   * **실패를 로딩보다 앞에서 판정한다**(사본 대조 추가 ①). 먼저 로딩을 보면 실패한 조회가
   * 영원히 「불러오는 중」으로 보인다.
   */
  it('실패는 로딩보다 앞에서 판정한다', () => {
    renderPane({ isLoading: true, loadError: <p>조회 실패</p> });

    expect(screen.getByText('조회 실패')).toBeInTheDocument();
    expect(screen.queryByRole('status', { name: t.loading.uncovered })).not.toBeInTheDocument();
  });

  /**
   * **실패했으면 건수를 내지 않는다.** 0을 내면 「규칙 없는 품목이 없다」는 좋은 소식으로
   * 읽히는데, 실제로는 그것을 확인하지 못한 것이다.
   */
  it('실패했으면 건수를 내지 않는다', () => {
    renderPane({ items: [], total: 0, loadError: <p>조회 실패</p> });

    expect(screen.getByText('조회 실패')).toBeInTheDocument();
    expect(screen.queryByText(t.uncovered.noneTitle)).not.toBeInTheDocument();
  });

  it('불러오는 중임을 이름으로 밝힌다', () => {
    renderPane({ isLoading: true });

    expect(screen.getByRole('status', { name: t.loading.uncovered })).toBeInTheDocument();
  });

  it('불러오는 중에는 건수를 내지 않는다', () => {
    renderPane({ items: [], total: 0, isLoading: true });

    expect(screen.queryByText(t.uncovered.noneTitle)).not.toBeInTheDocument();
  });
});
