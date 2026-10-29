import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { PaneLayoutToggle, PaneSplitter, usePaneLayout } from './po-board';

const STORAGE_KEY = 'test:pane-layout';
const LABELS = { group: '목록·상세 배치', side: '좌우 배치', stack: '상하 배치' };

const Harness = () => {
  const layout = usePaneLayout(STORAGE_KEY);

  return (
    <>
      <PaneLayoutToggle layout={layout.layout} onChange={layout.change} labels={LABELS} />
      <div data-testid="split" className={layout.className} />
    </>
  );
};

beforeEach(() => {
  globalThis.localStorage.clear();
});

describe('usePaneLayout · PaneLayoutToggle(#186)', () => {
  it('처음에는 좌우 배치이고, 고른 배치가 눌린 상태로 보이며 다시 열어도 그 배치다', async () => {
    const user = userEvent.setup();
    const { unmount } = render(<Harness />);

    expect(screen.getByRole('group', { name: LABELS.group })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: LABELS.side })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByRole('button', { name: LABELS.stack })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
    expect(screen.getByTestId('split')).toHaveClass('po-board-split');
    expect(screen.getByTestId('split')).not.toHaveClass('is-stacked');

    await user.click(screen.getByRole('button', { name: LABELS.stack }));
    expect(screen.getByRole('button', { name: LABELS.stack })).toHaveAttribute(
      'aria-pressed',
      'true',
    );

    expect(screen.getByTestId('split')).toHaveClass('is-stacked');
    expect(globalThis.localStorage.getItem(STORAGE_KEY)).toBe('stack');

    unmount();
    render(<Harness />);

    expect(screen.getByTestId('split')).toHaveClass('is-stacked');
    await user.click(screen.getByRole('button', { name: LABELS.side }));
    expect(screen.getByTestId('split')).not.toHaveClass('is-stacked');
    expect(globalThis.localStorage.getItem(STORAGE_KEY)).toBe('side');
  });

  it('저장값이 낯설면 나란히 둔다', () => {
    globalThis.localStorage.setItem(STORAGE_KEY, 'diagonal');
    render(<Harness />);

    expect(screen.getByTestId('split')).not.toHaveClass('is-stacked');
  });
});

/* 상하 배치의 가로 막대(#193) — 위아래 화살표로 높이를 나누고, 좌우 화살표에는 반응하지 않는다. */
describe('PaneSplitter — 가로 막대(#193)', () => {
  it('horizontal 이면 가로 막대로 읽히고 ↑·↓ 로 비율을 옮긴다', () => {
    const onChange = vi.fn();
    render(<PaneSplitter label="막대" ratio={0.4} onChange={onChange} orientation="horizontal" />);
    const bar = screen.getByRole('separator', { name: '막대' });

    expect(bar).toHaveAttribute('aria-orientation', 'horizontal');
    fireEvent.keyDown(bar, { key: 'ArrowRight' });
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.keyDown(bar, { key: 'ArrowDown' });
    expect(onChange).toHaveBeenLastCalledWith(expect.closeTo(0.42));
    fireEvent.keyDown(bar, { key: 'ArrowUp' });
    expect(onChange).toHaveBeenLastCalledWith(expect.closeTo(0.38));
  });

  it('기본은 세로 막대이고 ←·→ 로 비율을 옮긴다', () => {
    const onChange = vi.fn();
    render(<PaneSplitter label="막대" ratio={0.4} onChange={onChange} />);
    const bar = screen.getByRole('separator', { name: '막대' });

    expect(bar).toHaveAttribute('aria-orientation', 'vertical');
    fireEvent.keyDown(bar, { key: 'ArrowDown' });
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.keyDown(bar, { key: 'ArrowRight' });
    expect(onChange).toHaveBeenLastCalledWith(expect.closeTo(0.42));
  });
});
