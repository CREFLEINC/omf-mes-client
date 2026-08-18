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

  /**
   * 주 액션이 막힌 자리는 활성일 때와 같은 위계로 보여야 어느 것이 주 액션인지 잃지 않는다.
   *
   * ⛔ **`toBeDisabled()`만 재면 동어반복이다** — 이 부품은 무엇을 받든 늘 잠긴 버튼을 낸다.
   * 요청한 변형이 실제로 **산출물에 반영되는지**를 재야 인자가 무시돼도 감지기가 문다.
   */
  it('주 액션 자리에는 채운 버튼을, 그 밖에는 테두리 버튼을 쓴다', () => {
    const { unmount } = render(<DisabledAction variant="filled" label="등록" reason="사유" />);
    const filledClass = screen.getByRole('button', { name: '등록' }).className;

    unmount();
    render(<DisabledAction label="저장" reason="사유" />);
    const outlinedClass = screen.getByRole('button', { name: '저장' }).className;

    /* 두 변형이 **서로 다른 산출물**을 낸다 — 인자를 무시하면 이 단언이 문다. */
    expect(filledClass).not.toBe(outlinedClass);
  });

  /**
   * **배치 클래스를 받지 않는다.** 전례에는 있으나 이 슬라이스의 두 소비처가 자리를 따로
   * 정하지 않는다 — 값만 안 넘기고 인자를 남기면 죽은 통로가 된다(사본 체크리스트 7번).
   */
  it('겉을 감싸는 칸이 늘 같은 배치 클래스 하나뿐이다', () => {
    const { container } = render(<DisabledAction label="저장" reason="사유" />);

    expect(container.querySelector('.field-cell')?.className).toBe('field-cell');
  });
});
