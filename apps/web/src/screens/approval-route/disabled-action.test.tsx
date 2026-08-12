import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { DisabledAction } from './disabled-action';

const REASON = '저장: 고친 내용이 없습니다. 값을 바꾸면 저장할 수 있습니다.';

/**
 * 이 부품이 존재하는 이유 하나를 잰다 — **비활성 컨트롤은 포커스를 받지 못한다.**
 * 사유를 툴팁이나 시각으로만 두면 키보드·스크린리더 사용자가 닿을 수 없어, 버튼이 왜 안
 * 눌리는지 알 방법이 사라진다(배치 규범 4).
 *
 * **「글자가 어딘가 있다」로는 부족하다.** 그 잣대는 이 슬라이스가 필드 오류에 이미 세웠고,
 * 비활성 사유에도 같은 잣대가 서야 한다 — 사유가 화면에 떠 있어도 **그 컨트롤의 설명이
 * 아니면** 닿지 못하는 것은 같다.
 */
describe('DisabledAction', () => {
  it('사유가 그 버튼의 접근 설명이 된다', () => {
    render(<DisabledAction label="저장" reason={REASON} />);

    expect(screen.getByRole('button', { name: '저장' })).toHaveAccessibleDescription(REASON);
  });

  it('사유가 감춰지지 않은 글자로 함께 선다', () => {
    render(<DisabledAction label="저장" reason={REASON} />);

    // 접근 설명만 있고 눈에 보이지 않으면 마우스 사용자가 이유를 모른다.
    expect(screen.getByText(REASON)).toBeVisible();
  });

  it('버튼이 실제로 잠긴다', () => {
    render(<DisabledAction label="저장" reason={REASON} />);

    expect(screen.getByRole('button', { name: '저장' })).toBeDisabled();
  });

  /**
   * 주 액션이 막힌 자리는 활성일 때와 **같은 위계**로 보여야 사용자가 「원래 주 액션이
   * 무엇인지」를 잃지 않는다. 기본값은 `outlined`이고, 그 둘이 실제로 갈리는지를 잰다.
   */
  it('주 액션 자리는 기본 변형과 다르게 그린다', () => {
    render(
      <>
        <DisabledAction label="등록" reason={REASON} variant="filled" />
        <DisabledAction label="저장" reason={REASON} />
      </>,
    );

    expect(screen.getByRole('button', { name: '등록' }).className).not.toBe(
      screen.getByRole('button', { name: '저장' }).className,
    );
  });

  /** 배치 클래스는 액션 줄에서 위치를 정한다 — 없으면 부 액션이 주 액션 옆에 붙는다. */
  it('배치 클래스를 감싸는 칸에 붙인다', () => {
    const { container } = render(
      <DisabledAction label="사용 중지" reason={REASON} className="form-actions-secondary" />,
    );

    expect(container.querySelector('.field-cell.form-actions-secondary')).not.toBeNull();
  });
});
