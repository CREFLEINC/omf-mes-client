import { Icon } from '@crefle/web-ui';
import type { ReactNode } from 'react';

import './choice-card.css';

export interface ChoiceCardProps {
  /** Material Symbols 이름. 무엇을 고르는지 모양으로 먼저 말한다(발주 · 라인 · 지시). */
  icon: string;
  /** 굵게 서는 첫 줄. 실물과 대조하는 번호나 코드다. */
  title: ReactNode;
  /** 그 아래 작은 줄들. 한 덩어리씩 span 으로 넘기면 한 줄씩 선다. */
  children?: ReactNode;
  /** 오른쪽 끝의 수. 고르기 전에 알아야 하는 양(잔여 수량)이다. */
  aside?: { value: string; label: string };
  /** 지금 고른 것. 굵은 테두리와 채운 아이콘 칸으로 선다. */
  selected?: boolean;
  /** 고를 수는 있지만 할 일이 없는 것(다 받은 라인). 흐리게 뒤로 물린다. */
  muted?: boolean;
  onClick: () => void;
}

/**
 * 고르는 카드. 한 번 누르면 고른 것이다.
 *
 * 전에는 글자만 쌓인 상자라 어디까지가 한 장인지, 무엇이 남았는지 다 읽어야 알았다. 아이콘 칸 ·
 * 굵은 번호 · 오른쪽 수를 늘 같은 자리에 둬, 카드가 여러 장이어도 눈이 같은 자리만 훑는다.
 */
export const ChoiceCard = ({
  icon,
  title,
  children,
  aside,
  selected = false,
  muted = false,
  onClick,
}: ChoiceCardProps) => (
  <button
    type="button"
    className={[
      'choice-card',
      selected ? 'choice-card--selected' : '',
      muted ? 'choice-card--muted' : '',
    ]
      .filter((name) => name !== '')
      .join(' ')}
    aria-pressed={selected ? true : undefined}
    onClick={onClick}
  >
    <span className="choice-card__tile" aria-hidden="true">
      <Icon name={selected ? 'check' : icon} size={24} />
    </span>
    <span className="choice-card__body">
      <strong className="choice-card__title">{title}</strong>
      {children}
    </span>
    {aside === undefined ? null : (
      <span className="choice-card__aside">
        <b>{aside.value}</b>
        <small>{aside.label}</small>
      </span>
    )}
    <Icon name="chevron_right" size={24} className="choice-card__chevron" />
  </button>
);
