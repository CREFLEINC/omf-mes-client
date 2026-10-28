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
  it('고른 적이 없으면 넓은 창(1440px 이상)은 좌우, 고르면 그 배치다', () => {
    stubWidth(1536);
    const { result } = renderHook(() => useSplitOrientation('test:layout'));
    expect(result.current.orientation).toBe('row');
    act(() => result.current.change('column'));
    expect(result.current.orientation).toBe('column');
  });

  it('고른 적이 없으면 1440px보다 좁은 창은 위아래, 좌우를 고르면 좌우로 선다', () => {
    stubWidth(1366);
    const { result } = renderHook(() => useSplitOrientation('test:layout'));
    expect(result.current.orientation).toBe('column');
    expect(result.current.preferred).toBeNull();
    act(() => result.current.change('row'));
    expect(result.current.orientation).toBe('row');
  });

  it('관리웹 최소 폭(1280px)보다 좁으면 고른 값이 좌우여도 위아래이고, 고른 값은 남긴다', () => {
    window.localStorage.setItem('test:layout', 'row');
    stubWidth(1200);
    const { result } = renderHook(() => useSplitOrientation('test:layout'));
    expect(result.current.orientation).toBe('column');
    expect(result.current.preferred).toBe('row');
    expect(result.current.narrow).toBe(true);
  });

  it('1280px 이상에서는 단추에 잠김이 없다', async () => {
    stubWidth(1280);
    const target = document.createElement('div');
    target.id = HUB_ACTIONS_ID;
    document.body.append(target);
    const onChange = vi.fn();
    render(<SplitOrientationToggle orientation="column" onChange={onChange} />);

    const side = await screen.findByRole('button', { name: '좌우 배치' });
    expect(side).not.toHaveAttribute('aria-disabled');
    await userEvent.setup().click(side);
    expect(onChange).toHaveBeenCalledWith('row');
  });

  it('1280px보다 좁으면 단추는 상하를 눌린 상태로 보이고, 좌우는 사유와 함께 잠근다', async () => {
    stubWidth(1200);
    const target = document.createElement('div');
    target.id = HUB_ACTIONS_ID;
    document.body.append(target);
    const onChange = vi.fn();
    render(<SplitOrientationToggle orientation="row" onChange={onChange} />);

    const side = await screen.findByRole('button', { name: '좌우 배치' });
    expect(side).toHaveAttribute('aria-pressed', 'false');
    expect(side).toHaveAttribute('aria-disabled', 'true');
    expect(side).toHaveAccessibleDescription('창이 좁아 좌우 배치를 쓸 수 없습니다');
    expect(screen.getByRole('button', { name: '상하 배치' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );

    await userEvent.setup().click(side);
    expect(onChange).not.toHaveBeenCalled();
  });
});
