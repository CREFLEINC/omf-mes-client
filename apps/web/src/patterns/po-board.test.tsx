import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';

import { PaneLayoutToggle, usePaneLayout } from './po-board';

const STORAGE_KEY = 'test:pane-layout';
const LABELS = { toStack: '상하로 보기', toSide: '좌우로 보기' };

const Harness = () => {
  const layout = usePaneLayout(STORAGE_KEY);

  return (
    <>
      <PaneLayoutToggle layout={layout.layout} onToggle={layout.toggle} labels={LABELS} />
      <div data-testid="split" className={layout.className} />
    </>
  );
};

beforeEach(() => {
  globalThis.localStorage.clear();
});

describe('usePaneLayout · PaneLayoutToggle(#186)', () => {
  it('처음에는 나란히 두고, 누르면 위아래 ↔ 나란히가 바뀌며 다시 열어도 그 배치다', async () => {
    const user = userEvent.setup();
    const { unmount } = render(<Harness />);

    expect(screen.getByTestId('split')).toHaveClass('po-board-split');
    expect(screen.getByTestId('split')).not.toHaveClass('is-stacked');

    await user.click(screen.getByRole('button', { name: LABELS.toStack }));

    expect(screen.getByTestId('split')).toHaveClass('is-stacked');
    expect(globalThis.localStorage.getItem(STORAGE_KEY)).toBe('stack');

    unmount();
    render(<Harness />);

    expect(screen.getByTestId('split')).toHaveClass('is-stacked');
    await user.click(screen.getByRole('button', { name: LABELS.toSide }));
    expect(screen.getByTestId('split')).not.toHaveClass('is-stacked');
    expect(globalThis.localStorage.getItem(STORAGE_KEY)).toBe('side');
  });

  it('저장값이 낯설면 나란히 둔다', () => {
    globalThis.localStorage.setItem(STORAGE_KEY, 'diagonal');
    render(<Harness />);

    expect(screen.getByTestId('split')).not.toHaveClass('is-stacked');
  });
});
