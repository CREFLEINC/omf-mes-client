import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { DisabledAction } from './disabled-action';

describe('DisabledAction', () => {
  it('버튼이 잠기고 사유가 함께 보인다', () => {
    render(<DisabledAction label="저장" reason="저장은 고친 것이 있을 때 누를 수 있습니다." />);

    expect(screen.getByRole('button', { name: '저장' })).toBeDisabled();
    expect(screen.getByText('저장은 고친 것이 있을 때 누를 수 있습니다.')).toBeInTheDocument();
  });

  /**
   * 비활성 컨트롤은 포커스를 받지 못해 사유를 시각으로만 두면 보조기술이 닿을 수 없다 —
   * 항상 보이는 DOM 텍스트로 렌더하고 `aria-describedby`로 잇는다(배치 규범 4).
   */
  it('사유가 접근성 설명으로 이어진다', () => {
    render(<DisabledAction label="저장" reason="사유" />);

    const describedBy = screen
      .getByRole('button', { name: '저장' })
      .getAttribute('aria-describedby');

    expect(describedBy).not.toBeNull();
    expect(document.getElementById(describedBy ?? '')).toHaveTextContent('사유');
  });

  /** 주 액션이 막힌 자리는 활성일 때와 같은 위계로 보여야 어느 것이 주 액션인지 잃지 않는다. */
  it('주 액션 자리에는 채운 버튼을 쓴다', () => {
    render(<DisabledAction variant="filled" label="등록" reason="사유" />);

    expect(screen.getByRole('button', { name: '등록' })).toBeDisabled();
  });

  it('배치 클래스를 받으면 함께 붙인다', () => {
    const { container } = render(
      <DisabledAction label="저장" reason="사유" className="form-actions-secondary" />,
    );

    expect(container.querySelector('.field-cell.form-actions-secondary')).not.toBeNull();
  });
});
