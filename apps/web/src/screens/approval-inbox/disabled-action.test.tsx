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

  /**
   * **주 액션이 잠기는 자리가 이 회차에 생겼다**(승인). 활성일 때와 같은 위계로 보이지 않으면
   * 사용자가 「어느 버튼이 원래 주 액션인지」를 잃는다 — 잠긴 이유를 읽기도 전에 자리를 잃는다.
   *
   * 클래스 이름은 디자인 시스템의 것이라 값을 단언하지 않고 **서로 다르다는 사실**만 잰다.
   */
  it('주 액션으로 잠기면 부 액션과 다른 위계로 그려진다', () => {
    render(
      <>
        <DisabledAction label="승인" reason="승인: 막힘" variant="filled" />
        <DisabledAction label="열기" reason={REASON} />
      </>,
    );

    const primary = screen.getByRole('button', { name: '승인' });
    const secondary = screen.getByRole('button', { name: '열기' });

    expect(primary.className).not.toBe(secondary.className);
    /* 짝 방향 — 위계가 갈려도 잠긴 사실과 사유는 그대로다. */
    expect(primary).toBeDisabled();
    expect(primary).toHaveAccessibleDescription('승인: 막힘');
  });

  /**
   * 크기도 갈린다 — 「열기」는 구획 안 부 액션이라 작고, 승인·반려는 이 화면의 주 액션이다.
   * 기본값이 잠긴 자리에서만 커지면 활성 버튼과 나란히 섰을 때 줄이 어긋난다.
   */
  it('크기를 지정하지 않으면 기본 크기이고, 지정하면 그 크기로 그려진다', () => {
    render(
      <>
        <DisabledAction label="승인" reason="승인: 막힘" />
        <DisabledAction label="열기" reason={REASON} size="sm" />
      </>,
    );

    expect(screen.getByRole('button', { name: '승인' }).className).not.toBe(
      screen.getByRole('button', { name: '열기' }).className,
    );
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
