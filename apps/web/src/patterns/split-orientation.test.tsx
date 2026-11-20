import { act, render, renderHook, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { HUB_ACTIONS_ID } from './hub-actions';
import { SplitOrientationToggle, useSplitOrientation } from './split-orientation';

/** 창 폭을 흉내 낸다 — `(max-width: …)`, `(min-width: …)` 질의가 맞는지 정한다. */
const stubWidth = (width: number) => {
  const listeners = new Set<() => void>();
  vi.stubGlobal(
    'matchMedia',
    vi.fn((query: string) => ({
      matches: query.includes('max-width')
        ? width <= Number(/max-width: (\d+)px/.exec(query)?.[1])
        : width >= Number(/min-width: (\d+)px/.exec(query)?.[1]),
      media: query,
      addEventListener: (_: string, cb: () => void) => listeners.add(cb),
      removeEventListener: (_: string, cb: () => void) => listeners.delete(cb),
    })),
  );
  return listeners;
};

afterEach(() => {
  vi.unstubAllGlobals();
  window.localStorage.clear();
  document.getElementById(HUB_ACTIONS_ID)?.remove();
});

describe('목록 · 상세 배치', () => {
  it('배치 단추는 「더보기」 안에 접혀 있다', async () => {
    stubWidth(1536);
    const target = document.createElement('div');
    target.id = HUB_ACTIONS_ID;
    document.body.append(target);
    render(<SplitOrientationToggle orientation="row" onChange={vi.fn()} />);

    const more = await screen.findByRole('button', { name: '더보기' });
    expect(more).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('button', { name: '좌우 배치' })).toBeNull();
    await userEvent.setup().click(more);
    expect(more).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('group', { name: '목록·상세 배치' })).toBeInTheDocument();
  });

  it('고른 배치를 남기고 다시 읽는다', () => {
    stubWidth(1536);
    const { result } = renderHook(() => useSplitOrientation('test:layout'));
    expect(result.current.orientation).toBe('row');
    act(() => result.current.change('column'));
    expect(result.current.orientation).toBe('column');
    expect(window.localStorage.getItem('test:layout')).toBe('column');
  });

  it('1440px 이상에서는 단추가 고른 배치를 보이고 좌우를 고를 수 있다', async () => {
    stubWidth(1440);
    const target = document.createElement('div');
    target.id = HUB_ACTIONS_ID;
    document.body.append(target);
    const onChange = vi.fn();
    render(<SplitOrientationToggle orientation="column" onChange={onChange} />);

    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: '더보기' }));
    const side = screen.getByRole('button', { name: '좌우 배치' });
    expect(side).toBeEnabled();
    expect(side).toHaveAttribute('aria-pressed', 'false');
    await user.click(side);
    expect(onChange).toHaveBeenCalledWith('row');
    /* 고르면 판이 닫힌다. */
    expect(screen.queryByRole('button', { name: '좌우 배치' })).toBeNull();
  });

  it('1440px보다 좁으면 단추는 상하를 눌린 상태로 보이고, 좌우는 사유와 함께 끈다', async () => {
    stubWidth(1366);
    const target = document.createElement('div');
    target.id = HUB_ACTIONS_ID;
    document.body.append(target);
    const onChange = vi.fn();
    render(<SplitOrientationToggle orientation="row" onChange={onChange} />);

    await userEvent.setup().click(await screen.findByRole('button', { name: '더보기' }));
    const side = screen.getByRole('button', { name: '좌우 배치' });
    expect(side).toHaveAttribute('aria-pressed', 'false');
    expect(side).toBeDisabled();
    expect(side).toHaveAttribute('title', '창이 좁아 상하로 배치됩니다.');
    expect(screen.getByRole('button', { name: '상하 배치' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });
});
