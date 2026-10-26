import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';

import { PaneLayoutToggle, usePaneLayout } from './po-board';

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
