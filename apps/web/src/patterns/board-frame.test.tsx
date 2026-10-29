import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';

import { BoardFrame, type BoardFrameProps } from './board-frame';

const SPLIT_KEY = 'omf-mes:board-frame-test:split';

const SPLITTER = {
  label: '끌어서 합성 목록·상세 폭 조절',
  collapseLabel: '합성 목록 접기',
  expandLabel: '합성 목록 펼치기',
};

const renderFrame = (extra: { above?: BoardFrameProps['above']; detailScroll?: boolean } = {}) =>
  render(
    <BoardFrame
      splitKey={SPLIT_KEY}
      splitter={SPLITTER}
      list={{ label: '합성 목록', content: <p>목록 내용</p> }}
      detail={{
        label: '합성 상세',
        content: <p>상세 내용</p>,
        ...(extra.detailScroll === undefined ? {} : { scroll: extra.detailScroll }),
      }}
      {...(extra.above === undefined ? {} : { above: extra.above })}
    />,
  );

describe('BoardFrame', () => {
  afterEach(() => {
    window.localStorage.clear();
  });

  it('위 상자 · 목록 · 상세를 이름 붙은 구획으로 세운다', () => {
    renderFrame({ above: { label: '합성 조회 조건', content: <p>조건 줄</p> } });

    expect(screen.getByRole('region', { name: '합성 조회 조건' })).toHaveTextContent('조건 줄');
    expect(screen.getByRole('region', { name: '합성 목록' })).toHaveTextContent('목록 내용');
    expect(screen.getByRole('region', { name: '합성 상세' })).toHaveTextContent('상세 내용');
    expect(screen.getByRole('separator', { name: SPLITTER.label })).toBeInTheDocument();
  });

  it('위 상자가 없으면 두 구획만 선다', () => {
    renderFrame();

    expect(screen.queryByRole('region', { name: '합성 조회 조건' })).toBeNull();
    expect(screen.getByRole('region', { name: '합성 목록' })).toBeInTheDocument();
  });

  it('상세는 기본으로 구획을 통째로 스크롤하고, scroll: false 면 표가 구획 안에서 스크롤한다', () => {
    const { unmount } = renderFrame();
    expect(screen.getByRole('region', { name: '합성 상세' })).toHaveClass('po-board-scroll');
    unmount();

    renderFrame({ detailScroll: false });
    expect(screen.getByRole('region', { name: '합성 상세' })).not.toHaveClass('po-board-scroll');
  });

  it('상세를 주지 않으면 목록 한 구획만 서고 막대도 접기 단추도 없다', () => {
    render(<BoardFrame list={{ label: '합성 목록', content: <p>목록 내용</p> }} />);

    const list = screen.getByRole('region', { name: '합성 목록' });
    expect(list.parentElement).toHaveClass('po-board-split', 'board-frame-single');
    expect(screen.queryByRole('separator')).toBeNull();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('막대 위 단추로 목록을 접고 펴며, 접힘을 화면 열쇠로 남긴다', async () => {
    const user = userEvent.setup();
    renderFrame();
    const split = screen.getByRole('region', { name: '합성 목록' }).parentElement;

    await user.click(screen.getByRole('button', { name: SPLITTER.collapseLabel }));

    expect(split).toHaveAttribute('data-left-collapsed', 'true');
    expect(window.localStorage.getItem(`${SPLIT_KEY}:collapsed`)).toBe('1');

    await user.click(screen.getByRole('button', { name: SPLITTER.expandLabel }));

    expect(split).not.toHaveAttribute('data-left-collapsed');
  });
});
