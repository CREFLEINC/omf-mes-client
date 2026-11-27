import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { CutHint } from './cut-hint';

const FULL = '아주 긴 검사 항목 이름 — 칸 폭보다 길어 말줄임으로 잘린다';

/** jsdom 은 배치를 하지 않는다 — 글 폭 · 칸 폭을 정해 잘린(또는 다 보이는) 상태를 만든다. */
const setWidths = (element: HTMLElement, client: number, scroll: number): void => {
  Object.defineProperty(element, 'clientWidth', { configurable: true, value: client });
  Object.defineProperty(element, 'scrollWidth', { configurable: true, value: scroll });
};

const renderHint = () => {
  render(
    <CutHint className="box" text={FULL}>
      <span data-cut-text>{FULL}</span>
    </CutHint>,
  );
  const text = screen.getByText(FULL);
  return { text, box: text.parentElement! };
};

describe('CutHint — 잘린 글 힌트', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('글이 잘렸으면 커서를 두고 잠시 뒤 전체 글을 힌트로 띄운다', () => {
    const { text, box } = renderHint();
    setWidths(text, 100, 240);

    fireEvent.mouseEnter(box);
    /* 표를 훑으며 지나갈 때마다 깜빡이지 않게 곧바로 띄우지 않는다. */
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(300);
    });

    expect(screen.getByRole('tooltip')).toHaveTextContent(FULL);
  });

  it('글이 다 보이면 힌트를 띄우지 않는다', () => {
    const { text, box } = renderHint();
    setWidths(text, 240, 240);

    fireEvent.mouseEnter(box);
    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  it('커서가 칸을 떠나면 힌트를 닫는다', () => {
    const { text, box } = renderHint();
    setWidths(text, 100, 240);

    fireEvent.mouseEnter(box);
    act(() => {
      vi.advanceTimersByTime(300);
    });
    fireEvent.mouseLeave(box);

    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  it('뜨기 전에 칸을 떠나면 띄우지 않는다', () => {
    const { text, box } = renderHint();
    setWidths(text, 100, 240);

    fireEvent.mouseEnter(box);
    fireEvent.mouseLeave(box);
    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });
});
