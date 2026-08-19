import { Chip } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { notificationFixture } from './fixtures';
import { NotificationCard, describeMessage, titleIdOf } from './notification-card';
import { toNotificationView } from './types';

const t = messages.notificationCenter;

/**
 * 제목은 **부모가 푼 결과**를 받는다(`lookups.ts`의 `describeEvent`). 기본값을 코드로 두는
 * 이유는 그것이 「풀 수 없을 때」의 실제 값이기 때문이다 — 이 부품에는 그 두 경우가 같다.
 */
const renderCard = (
  overrides: Parameters<typeof notificationFixture>[0] = {},
  title = 'SYN-EVENT-01',
  extra: Partial<{ isRead: boolean; isPending: boolean }> = {},
) => {
  const onRead = vi.fn();
  const view = toNotificationView(notificationFixture(overrides));

  render(
    <NotificationCard
      view={view}
      title={title}
      /* 기본은 **서버 값 그대로** — 화면이 얹는 집합은 이 부품 밖의 일이다. */
      isRead={extra.isRead ?? view.read}
      isPending={extra.isPending ?? false}
      onRead={onRead}
    />,
  );

  return { onRead, user: userEvent.setup() };
};

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
  it('제목 · 발생 시각 · 본문을 그린다', () => {
    renderCard();

    expect(screen.getByText('SYN-EVENT-01')).toBeInTheDocument();
    expect(screen.getByText('08-17 14:05')).toBeInTheDocument();
    expect(screen.getByText('합성 알림 문구 가입니다.')).toBeInTheDocument();
  });

  /**
   * ⭐ **제목은 받은 글자를 그린다 — 카드가 코드를 직접 그리지 않는다.**
   *
   * 코드를 그대로 그리는 형태로 되돌아가면 이름 풀이가 통째로 무의미해지는데, 카드가 든
   * `view.eventCode`가 그때도 같은 자리에 있어 **다른 시험은 하나도 울지 않는다.**
   */
  it('제목이 푼 이름이면 코드 대신 그 이름이 선다', () => {
    renderCard({}, '합성 이벤트 가');

    expect(screen.getByText('합성 이벤트 가')).toBeInTheDocument();
    expect(screen.queryByText('SYN-EVENT-01')).not.toBeInTheDocument();
  });

  it('시각에 원문을 함께 둔다 — 표기 조각만으로는 언제인지 되짚을 수 없다', () => {
    renderCard();

    expect(screen.getByText('08-17 14:05')).toHaveAttribute(
      'dateTime',
      '2026-08-17T14:05:00+09:00',
    );
  });

  it('안 읽은 알림과 읽은 알림의 표시가 갈린다', () => {
    renderCard();

    expect(screen.getByText(t.card.unread)).toBeInTheDocument();
    expect(screen.queryByText(t.card.read)).not.toBeInTheDocument();
  });

  /**
   * ⭐ **읽음 표시의 출처가 `view.read`가 아니라 화면의 판정이다**(`isRead`).
   *
   * 서버 값만 보면 「이 회차에 읽음 처리한 번호」가 표시에 닿지 못해, 카드를 눌러도 표시가
   * 그대로 남는다 — 사용자는 자기가 누른 것이 먹혔는지 알 수 없다.
   */
  it('서버가 아직 안 읽음이라 해도 화면 판정이 읽음이면 읽음으로 보인다', () => {
    renderCard({ read: false }, 'SYN-EVENT-01', { isRead: true });

    expect(screen.getByText(t.card.read)).toBeInTheDocument();
    expect(screen.queryByText(t.card.unread)).not.toBeInTheDocument();
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

    expect(screen.getByRole('button', { name: 'SYN-EVENT-01' })).toBeInTheDocument();
  });

  /**
   * ⭐ **이름이 같다는 것만으로는 부족하다 — 기제를 잰다.**
   *
   * `aria-label`에 같은 글자를 직접 박아도 접근성 이름이 같아 위 시험이 통과한다.
   * ⭐ **그 두 형태가 실제로 갈라졌다** — 이름 풀이가 붙어 제목이 코드에서 이름으로 바뀌었다.
   * `aria-label`로 두면 코드에 묶인 채 남아 **보이는 글자와 들리는 이름이 갈린다.**
   */
  it('카드가 제목을 aria-labelledby로 가리킨다 — 이름을 직접 박지 않는다', () => {
    renderCard();

    const card = screen.getByRole('button', { name: 'SYN-EVENT-01' });

    expect(card).toHaveAttribute('aria-labelledby', titleIdOf(7101));
    expect(card).not.toHaveAttribute('aria-label');
  });

  it('제목이 이름으로 풀리면 카드의 접근성 이름도 그 이름이다', () => {
    renderCard({}, '합성 이벤트 가');

    /* 보이는 글자와 들리는 이름이 같은 자리에서 나온다. */
    expect(screen.getByRole('button', { name: '합성 이벤트 가' })).toBeInTheDocument();
  });

  it('카드가 둘이면 각자 자기 제목을 가리킨다 — 상수 id면 둘 다 앞 카드를 가리킨다', () => {
    render(
      <>
        <NotificationCard
          view={toNotificationView(notificationFixture())}
          title="SYN-EVENT-01"
          isRead={false}
          isPending={false}
          onRead={() => undefined}
        />
        <NotificationCard
          view={toNotificationView(
            notificationFixture({ notificationId: 7102, eventCode: 'SYN-EVENT-02' }),
          )}
          title="SYN-EVENT-02"
          isRead={false}
          isPending={false}
          onRead={() => undefined}
        />
      </>,
    );

    /* 짝 양성 — 카드가 실제로 둘이다. 그래야 아래 이름 단언이 뜻을 갖는다. */
    expect(screen.getAllByRole('button')).toHaveLength(2);
    expect(screen.getByRole('button', { name: 'SYN-EVENT-01' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'SYN-EVENT-02' })).toBeInTheDocument();
  });

  it('제목 id가 알림 번호로 격리된다', () => {
    expect(titleIdOf(7101)).not.toBe(titleIdOf(7102));
  });
});

describe('NotificationCard — 누름', () => {
  it('안 읽은 카드를 누르면 그 번호를 알린다', async () => {
    const { onRead, user } = renderCard();

    await user.click(screen.getByRole('button', { name: 'SYN-EVENT-01' }));

    expect(onRead).toHaveBeenCalledWith(7101);
  });

  /**
   * ⭐ **이미 읽은 카드는 요청을 부르지 않는다.** 서버 상태가 이미 목표 상태라 보낼 것이 없고,
   * 보내면 사용자가 목록을 훑는 동안 요청이 계속 나간다.
   *
   * 음성 단언을 **짝 양성 뒤 시점**에 잰다 — 안 읽은 카드가 실제로 부른다는 것을 먼저 보였다.
   */
  it('이미 읽은 카드를 눌러도 부르지 않는다', async () => {
    const { onRead, user } = renderCard({ read: true });

    /* 짝 양성 — 그 카드는 실제로 눌린다(버튼으로 남아 있다). */
    const card = screen.getByRole('button', { name: 'SYN-EVENT-01' });
    expect(card).toBeInTheDocument();

    await user.click(card);

    expect(onRead).not.toHaveBeenCalled();
  });

  /**
   * ⭐ **읽은 카드도 버튼으로 남긴다**(결정 ⑦). 눌리지 않는 요소로 바꾸면 키보드로 Enter를
   * 눌러 읽음 처리한 **그 순간 포커스가 사라진다.**
   */
  it('읽은 카드도 버튼으로 남는다', () => {
    renderCard({ read: true });

    expect(screen.getByRole('button', { name: 'SYN-EVENT-01' })).toBeInTheDocument();
  });

  it('나가는 중인 카드는 잠긴다', () => {
    renderCard({}, 'SYN-EVENT-01', { isPending: true });

    expect(screen.getByRole('button', { name: 'SYN-EVENT-01' })).toHaveAttribute(
      'aria-disabled',
      'true',
    );
  });

  it('나가는 중인 카드를 눌러도 부르지 않는다', async () => {
    const { onRead, user } = renderCard({}, 'SYN-EVENT-01', { isPending: true });

    await user.click(screen.getByRole('button', { name: 'SYN-EVENT-01' }));

    expect(onRead).not.toHaveBeenCalled();
  });

  /** 카드 안에 또 다른 대화형 요소를 두지 않는다 — 디자인 시스템 제약이자 키보드 순회 규율. */
  it('카드 안에 다른 대화형 요소가 없다', () => {
    const { container } = render(
      <NotificationCard
        view={toNotificationView(notificationFixture())}
        title="SYN-EVENT-01"
        isRead={false}
        isPending={false}
        onRead={() => undefined}
      />,
    );

    const card = screen.getByRole('button', { name: 'SYN-EVENT-01' });

    expect(card.querySelector('button, a, [role="button"]')).toBeNull();
    expect(container.querySelector('button button')).toBeNull();
  });
});
