import { Card as DsCard, type CardProps } from '@crefle/web-ui';
import { forwardRef } from 'react';

import './card.css';

export type { CardProps };

/**
 * 디자인 시스템 카드를 이 셸의 작업대 위에 세운다. 화면은 디자인 시스템 카드 대신 이것을 쓴다.
 *
 * 본문 바탕(작업대)을 한 단 낮췄다(사용자 결정 2026-10-21, 개편 제안 v2). 디자인 시스템 카드의
 * 기본 바탕이 바로 그 낮은 단이라, 그대로 두면 카드가 바탕에 녹아 사라진다 - 누르는 카드는
 * 테두리까지 지워져 글자만 떠 있었다. 기본을 흰 카드로 올리고, 누르는 카드에는 테두리를 돌려준다.
 */
const CardRoot = forwardRef<HTMLElement, CardProps>(
  ({ surface = 'base', interactive, className, ...rest }, ref) => (
    <DsCard
      ref={ref}
      surface={surface}
      interactive={interactive}
      className={['pda-card', interactive === true ? 'pda-card--interactive' : '', className]
        .filter((name) => name !== undefined && name !== '')
        .join(' ')}
      {...rest}
    />
  ),
);

CardRoot.displayName = 'Card';

export const Card = Object.assign(CardRoot, {
  Header: DsCard.Header,
  Body: DsCard.Body,
  Footer: DsCard.Footer,
});
