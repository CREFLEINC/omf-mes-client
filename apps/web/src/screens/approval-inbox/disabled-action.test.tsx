import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { DisabledAction } from './disabled-action';

const REASON = '열기: 이 화면은 아직 관리웹에 없습니다';

/**
 * 이 부품이 존재하는 이유 하나를 잰다 — **비활성 컨트롤은 포커스를 받지 못한다.**
 * 사유를 툴팁이나 시각으로만 두면 키보드·스크린리더 사용자가 닿을 수 없어, 버튼이 왜 안
 * 눌리는지 알 방법이 사라진다(배치 규범 4).
 */
describe('DisabledAction', () => {
  it('사유가 그 버튼의 접근 설명이 된다', () => {
    render(<DisabledAction label="열기" reason={REASON} />);

    expect(screen.getByRole('button', { name: '열기' })).toHaveAccessibleDescription(REASON);
  });

  it('사유가 감춰지지 않은 글자로 함께 선다', () => {
    render(<DisabledAction label="열기" reason={REASON} />);

    /* 접근 설명만 있고 눈에 보이지 않으면 마우스 사용자가 이유를 모른다. */
    expect(screen.getByText(REASON)).toBeVisible();
  });

  it('버튼이 실제로 잠긴다', () => {
    render(<DisabledAction label="열기" reason={REASON} />);

    expect(screen.getByRole('button', { name: '열기' })).toBeDisabled();
  });

  it('사유가 서로 다르면 설명도 갈린다 — 한 문구로 뭉개지 않는다', () => {
    render(
      <>
        <DisabledAction label="열기" reason="열기: 이 대상은 열 수 있는 화면이 없습니다" />
        <DisabledAction label="닫기" reason={REASON} />
      </>,
    );

    expect(screen.getByRole('button', { name: '열기' })).toHaveAccessibleDescription(
      '열기: 이 대상은 열 수 있는 화면이 없습니다',
    );
    expect(screen.getByRole('button', { name: '닫기' })).toHaveAccessibleDescription(REASON);
  });
});
