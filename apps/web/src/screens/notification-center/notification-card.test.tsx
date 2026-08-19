import { Chip } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { notificationFixture } from './fixtures';
import { NotificationCard, describeMessage, titleIdOf } from './notification-card';
import { toNotificationView } from './types';

const t = messages.notificationCenter;

const renderCard = (overrides: Parameters<typeof notificationFixture>[0] = {}) =>
  render(<NotificationCard view={toNotificationView(notificationFixture(overrides))} />);

/**
 * 읽음 표시의 **강조 등급**을 재는 잣대.
 *
 * 디자인 시스템이 상태를 해시 클래스(`_status-info_…`)로 그리므로 그 이름을 직접 겨누지
 * 않는다(저장소 규율 — DS 해시 클래스는 판마다 바뀐다). 대신 **기대하는 등급으로 칩 하나를
 * 따로 그려** 그 클래스와 같은지 본다. 해시가 바뀌면 잣대도 함께 움직이고, 등급을 맞바꾸면
 * 어긋난다.
 */
const chipClassFor = (status: 'idle' | 'info'): string => {
  const { container, unmount } = render(
    <Chip size="sm" status={status}>
      기준
    </Chip>,
  );
  const className = container.querySelector('span')?.className ?? '';
  unmount();

  return className;
};

/** 칩의 뿌리. DS가 글자를 안쪽 `span`에 담으므로 한 칸 올라간다. */
const chipRootOf = (label: string): HTMLElement | null => screen.getByText(label).parentElement;

describe('describeMessage', () => {
  it('내용이 있으면 원문을 그대로 낸다', () => {
    expect(describeMessage('합성 알림 문구 가입니다.')).toBe('합성 알림 문구 가입니다.');
  });

  it('빈 문구는 공용 안내로 낙하한다', () => {
    expect(describeMessage('')).toBe(t.card.emptyMessage);
  });

  it('공백뿐인 문구도 낙하한다 — 다듬은 뒤에 판정해야 걸린다', () => {
    /* ⭐ `message === ''`로만 보면 이 값이 빠져나가 본문 없는 카드가 선다. */
    expect(describeMessage('   ')).toBe(t.card.emptyMessage);
    expect(describeMessage('\n\t ')).toBe(t.card.emptyMessage);
  });

  it('앞뒤 공백이 있는 문구는 다듬지 않고 낸다 — 서버가 준 것과 보이는 것이 갈리면 안 된다', () => {
    expect(describeMessage('  합성 문구  ')).toBe('  합성 문구  ');
  });
});

describe('NotificationCard', () => {
  it('이벤트 코드 원문 · 발생 시각 · 본문을 그린다', () => {
    renderCard();

    expect(screen.getByText('SYN-EVENT-01')).toBeInTheDocument();
    expect(screen.getByText('08-17 14:05')).toBeInTheDocument();
    expect(screen.getByText('합성 알림 문구 가입니다.')).toBeInTheDocument();
  });

  it('시각에 원문을 함께 둔다 — 표기 조각만으로는 언제인지 되짚을 수 없다', () => {
    renderCard();

    expect(screen.getByText('08-17 14:05')).toHaveAttribute(
      'dateTime',
      '2026-08-17T14:05:00+09:00',
    );
  });

  it('안 읽은 알림과 읽은 알림의 표시가 갈린다', () => {
    const { unmount } = renderCard();
    expect(screen.getByText(t.card.unread)).toBeInTheDocument();
    expect(screen.queryByText(t.card.read)).not.toBeInTheDocument();
    unmount();

    renderCard({ read: true });
    expect(screen.getByText(t.card.read)).toBeInTheDocument();
  });

  /**
   * ⭐ **글자만 재면 강조가 조용히 뒤집힌다.**
   *
   * 읽음 여부는 이 화면에서 목록을 훑는 **유일한 시각 단서**다. 두 등급을 맞바꿔도 글자는
   * 그대로라 「읽음/안 읽음이 보인다」는 시험이 전부 통과한다 — 강조를 잃은 채로.
   */
  it('안 읽은 알림이 강조 등급으로 선다', () => {
    renderCard();

    expect(chipRootOf(t.card.unread)?.className).toBe(chipClassFor('info'));
  });

  it('읽은 알림은 약한 등급으로 선다 — 강조는 안 읽은 쪽의 몫이다', () => {
    renderCard({ read: true });

    expect(chipRootOf(t.card.read)?.className).toBe(chipClassFor('idle'));
  });

  it('본문이 공백뿐이면 빈 자리 대신 안내가 선다', () => {
    renderCard({ message: '   ' });

    expect(screen.getByText(t.card.emptyMessage)).toBeInTheDocument();
  });

  it('카드가 자기 제목을 이름으로 든다', () => {
    renderCard();

    expect(screen.getByRole('group', { name: 'SYN-EVENT-01' })).toBeInTheDocument();
  });

  /**
   * ⭐ **이름이 같다는 것만으로는 부족하다 — 기제를 잰다.**
   *
   * `aria-label`에 같은 글자를 직접 박아도 지금은 접근성 이름이 같아 위 시험이 통과한다.
   * 두 형태가 갈라지는 시점은 **T2**다 — 이벤트 이름 풀이가 붙어 카드 제목이 코드에서 이름으로
   * 바뀌면, `aria-label`은 코드에 묶인 채 남아 **보이는 글자와 들리는 이름이 갈린다.**
   * 그때는 「T1이 원래 그랬는지 T2가 깬 것인지」를 가릴 수 없으므로 여기서 규격을 고정한다.
   */
  it('카드가 제목을 aria-labelledby로 가리킨다 — 이름을 직접 박지 않는다', () => {
    renderCard();

    const card = screen.getByRole('group', { name: 'SYN-EVENT-01' });

    expect(card).toHaveAttribute('aria-labelledby', titleIdOf(7101));
    expect(card).not.toHaveAttribute('aria-label');
  });

  it('카드가 둘이면 각자 자기 제목을 가리킨다 — 상수 id면 둘 다 앞 카드를 가리킨다', () => {
    render(
      <>
        <NotificationCard view={toNotificationView(notificationFixture())} />
        <NotificationCard
          view={toNotificationView(
            notificationFixture({ notificationId: 7102, eventCode: 'SYN-EVENT-02' }),
          )}
        />
      </>,
    );

    /* 짝 양성 — 카드가 실제로 둘이다. 그래야 아래 이름 단언이 뜻을 갖는다. */
    expect(screen.getAllByRole('group')).toHaveLength(2);
    expect(screen.getByRole('group', { name: 'SYN-EVENT-01' })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'SYN-EVENT-02' })).toBeInTheDocument();
  });

  it('제목 id가 알림 번호로 격리된다', () => {
    expect(titleIdOf(7101)).not.toBe(titleIdOf(7102));
  });
});
