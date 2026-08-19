import { messages } from '@omf-mes/i18n';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { notificationFixture } from './fixtures';
import { NotificationCard, describeMessage, titleIdOf } from './notification-card';
import { toNotificationView } from './types';

const t = messages.notificationCenter;

const renderCard = (overrides: Parameters<typeof notificationFixture>[0] = {}) =>
  render(<NotificationCard view={toNotificationView(notificationFixture(overrides))} />);

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

  it('본문이 공백뿐이면 빈 자리 대신 안내가 선다', () => {
    renderCard({ message: '   ' });

    expect(screen.getByText(t.card.emptyMessage)).toBeInTheDocument();
  });

  it('카드가 자기 제목을 이름으로 든다', () => {
    renderCard();

    expect(screen.getByRole('group', { name: 'SYN-EVENT-01' })).toBeInTheDocument();
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
