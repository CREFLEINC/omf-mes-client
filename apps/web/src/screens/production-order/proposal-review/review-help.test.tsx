import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { ReviewHelp } from './review-help';
describe('검토 도움말', () => {
  it('스크롤 영역 밖에 전체 설명을 표시하고 Escape로 닫는다', async () => {
    const user = userEvent.setup();
    const { container } = render(
      <div style={{ overflow: 'hidden', height: 20 }}>
        <ReviewHelp title="검토">전체 안내 문구를 유지합니다.</ReviewHelp>
      </div>,
    );
    await user.tab();
    const tip = screen.getByRole('tooltip');
    expect(tip).toHaveTextContent('전체 안내 문구를 유지합니다.');
    expect(container.contains(tip)).toBe(false);
    expect(screen.getByRole('button', { name: '검토 도움말' })).toHaveAttribute(
      'aria-describedby',
      tip.id,
    );
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });
  it('클릭으로 열고 바깥을 누르면 닫는다', async () => {
    const user = userEvent.setup();
    render(
      <>
        <ReviewHelp title="보완">보완 설명</ReviewHelp>
        <button>다른 영역</button>
      </>,
    );
    await user.click(screen.getByRole('button', { name: '보완 도움말' }));
    expect(screen.getByRole('tooltip')).toHaveTextContent('보완 설명');
    await user.click(screen.getByRole('button', { name: '다른 영역' }));
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });
});
