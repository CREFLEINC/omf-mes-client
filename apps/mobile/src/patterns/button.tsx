import { Button as DsButton, type ButtonProps } from '@crefle/web-ui';
import { forwardRef } from 'react';

import './button.css';

export type { ButtonProps };

/**
 * 디자인 시스템 단추에 이 셸의 겉을 입힌다. 화면은 디자인 시스템 단추 대신 이것을 쓴다.
 *
 * 디자인 시스템 단추는 관리웹 기준이다 - 알약 모양에 14px 글씨, 외곽선 · 글자 단추는 빨간 글씨.
 * 72px 단추에 그 글씨를 얹으니 단추만 크고 읽히지 않았고, 화면마다 빨간 글자가 열 군데 서서
 * 정작 주 단추가 묻혔다(사용자 결정 2026-10-21, 개편 제안 v2 ②④).
 *
 * 생김새만 바꾼다. 동작과 크기 규격(sm~2xl)은 디자인 시스템 그대로다. 디자인 시스템의 클래스는
 * 빌드마다 바뀌는 해시라 붙잡을 수 없어, 우리 클래스를 함께 붙여 그것으로 고른다.
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'filled', size = 'md', className, ...rest }, ref) => (
    <DsButton
      ref={ref}
      variant={variant}
      size={size}
      className={['pda-button', `pda-button--${variant}`, `pda-button--${size}`, className]
        .filter((name) => name !== undefined && name !== '')
        .join(' ')}
      {...rest}
    />
  ),
);

Button.displayName = 'Button';
