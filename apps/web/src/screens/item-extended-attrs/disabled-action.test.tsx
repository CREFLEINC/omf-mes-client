import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { DisabledAction } from './disabled-action';

const REASON = '저장할 수 없습니다. 겹친 줄을 고치거나 지운 뒤 저장하세요.';

describe('DisabledAction — 배치 규범 4', () => {
  it('액션이 비활성이다', () => {
    render(<DisabledAction label="저장" reason={REASON} />);

    expect(screen.getByRole('button', { name: '저장' })).toBeDisabled();
  });

  /*
   * 비활성 컨트롤은 포커스를 받지 못해 툴팁만으로는 키보드·스크린리더 사용자가 닿을 수 없다.
   * 사유를 항상 보이는 DOM 텍스트로 두고 `aria-describedby`로 잇는 것이 그 답이다.
   */
  it('사유가 보이는 텍스트로 있고 액션과 이어져 있다', () => {
    render(<DisabledAction label="저장" reason={REASON} />);

    const button = screen.getByRole('button', { name: '저장' });
    const noteId = button.getAttribute('aria-describedby');

    expect(noteId).not.toBeNull();
    expect(screen.getByText(REASON)).toHaveAttribute('id', noteId);
  });

  it('배치 클래스를 덧붙일 수 있다', () => {
    const { container } = render(
      <DisabledAction label="저장" reason={REASON} className="form-actions-secondary" />,
    );

    expect(container.querySelector('.field-cell.form-actions-secondary')).not.toBeNull();
  });
});
