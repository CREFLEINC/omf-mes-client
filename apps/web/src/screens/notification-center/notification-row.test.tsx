import { messages } from '@omf-mes/i18n';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation, useNavigate } from 'react-router';
import { describe, expect, it, vi } from 'vitest';

import { notificationFixture } from './fixtures';
import { NotificationRow } from './notification-row';
import { toNotificationView } from './types';

const t = messages.notificationCenter;

/** 주소를 읽어 내는 탐침. 이동이 실제로 어디로 갔는지 잴 유일한 근거다. */
const LocationProbe = () => {
  const location = useLocation();

  return <output data-testid="location">{`${location.pathname}${location.search}`}</output>;
};

/**
 * 한 칸 뒤로 간다. **히스토리가 몇 칸 늘었는지를 판정하는 유일한 수단**이다 —
 * 기억 라우터는 브라우저 히스토리를 쓰지 않아 `window.history.back()`이 닿지 않는다(T1 전례).
 */
const BackProbe = () => {
  const navigate = useNavigate();

  return (
    <button
      type="button"
      onClick={() => {
        void navigate(-1);
      }}
    >
      뒤로
    </button>
  );
};

const APPROVAL = { targetTypeCode: 'APPROVAL_REQUEST', targetId: 7201 } as const;

/** 카드 제목 — 풀린 이름이다. 링크 이름이 이것을 쓰는지가 이 파일의 한 축이다. */
const TITLE = '합성 이벤트 가';

const renderRow = (overrides: Parameters<typeof notificationFixture>[0] = {}, title = TITLE) => {
  const onRead = vi.fn();
  const view = toNotificationView(notificationFixture(overrides));

  render(
    <MemoryRouter initialEntries={['/notification/center']}>
      <NotificationRow
        view={view}
        title={title}
        isRead={view.read}
        isPending={false}
        onRead={onRead}
      />
      <LocationProbe />
      <BackProbe />
    </MemoryRouter>,
  );

  return { onRead, user: userEvent.setup() };
};

const card = () => screen.getByRole('button', { name: TITLE });

/** ⭐ **링크로 찾는다** — 버튼으로 찾으면 링크 전환이 조용히 되돌아가도 시험이 통과한다. */
const moveLink = () => screen.getByRole('link', { name: t.actions.openTarget(TITLE) });

describe('NotificationRow — 이동 버튼이 서는 갈래', () => {
  it('대응표에 있는 유형에는 이동 링크가 선다', () => {
    renderRow(APPROVAL);

    expect(moveLink()).toBeInTheDocument();
  });

  it('누르면 그 건의 결재함으로 간다', async () => {
    const { user } = renderRow(APPROVAL);

    await user.click(moveLink());

    expect(screen.getByTestId('location')).toHaveTextContent('/approval/inbox?rq=7201');
  });

  /**
   * ⭐ **이동은 읽음 처리를 일으키지 않는다.** 버튼이 카드 **밖**에 있어 클릭이 카드로
   * 올라가지 않는다 — 두 조작이 한 클릭에 겹치면 사용자가 무엇을 했는지 가릴 수 없다.
   */
  it('이동 링크를 눌러도 읽음 처리가 일어나지 않는다', async () => {
    const { onRead, user } = renderRow(APPROVAL);

    /* 짝 양성 — 카드를 누르면 실제로 읽음 처리가 일어난다. */
    await user.click(card());
    expect(onRead).toHaveBeenCalledTimes(1);

    await user.click(moveLink());

    expect(onRead).toHaveBeenCalledTimes(1);
  });
});

describe('NotificationRow — 이동 버튼이 서지 않는 갈래', () => {
  /** 음성 단언을 **짝 양성 뒤 시점**에 잰다 — 카드는 실제로 서 있다. */
  const expectNoMoveLink = (): void => {
    expect(card()).toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    expect(screen.queryByText(t.actions.openTargetShort)).not.toBeInTheDocument();
  };

  it('도착지가 없는 계약 유형에는 서지 않는다', () => {
    renderRow({ targetTypeCode: 'LOT', targetId: 7201 });

    expectNoMoveLink();
  });

  it('모르는 코드에도 서지 않는다', () => {
    /* 계약 밖 값 — 서버가 대상 유형을 더했을 때 화면이 링크를 지어내지 않는지 잰다. */
    renderRow({ targetTypeCode: 'SYN-UNKNOWN' as never, targetId: 7201 });

    expectNoMoveLink();
  });

  it('번호가 없으면 서지 않는다', () => {
    renderRow({ targetTypeCode: 'APPROVAL_REQUEST' });

    expectNoMoveLink();
  });

  it('대상이 아예 없으면 서지 않는다', () => {
    renderRow();

    expectNoMoveLink();
  });

  /** 버튼이 없어도 **원본 코드는 그대로 보인다** — 사용자가 담당자에게 전할 단서다. */
  it('링크가 없어도 제목은 그대로 보인다', () => {
    renderRow({ targetTypeCode: 'LOT', targetId: 7201 });

    expect(screen.getByText(TITLE)).toBeInTheDocument();
  });
});

describe('NotificationRow — 카드와 버튼은 형제다', () => {
  /**
   * ⭐ **카드 안에 다른 대화형 요소를 두지 않는다**(결정 ⑦ · 디자인 시스템 제약).
   *
   * ⚠ **`button` 중첩으로 재면 물지 못한다** — 이 판의 `interactive` 카드는 `<button>`이
   * 아니라 `<div role="button">`이다(런타임 실측). 그래서 **카드 안에 `button`·`a`·
   * `[role="button"]`이 없다**로 잰다.
   */
  it('카드 안에 이동 링크가 들어가지 않는다', () => {
    renderRow(APPROVAL);

    /* 짝 양성 — 이동 버튼이 실제로 서 있다. 그래야 「안에 없다」가 뜻을 갖는다. */
    expect(moveLink()).toBeInTheDocument();
    expect(card().querySelector('button, a, [role="button"]')).toBeNull();
  });

  it('링크가 카드의 형제로 같은 줄에 선다', () => {
    renderRow(APPROVAL);

    expect(card().parentElement).toBe(moveLink().parentElement);
  });

  /** 키보드 순회가 카드 → 이동 버튼 차례다(T4-10의 감지기 가능한 부분). */
  it('카드 다음에 이동 링크가 온다', async () => {
    const { user } = renderRow(APPROVAL);

    await user.tab();
    expect(card()).toHaveFocus();

    await user.tab();
    expect(moveLink()).toHaveFocus();
  });
});

describe('NotificationRow — 되돌아올 수 있다', () => {
  /**
   * ⭐ **밀어 넣는 이동이어야 한다.** 알림 → 대상 → **되돌아오기**가 이 화면의 정상 흐름인데,
   * 자리를 바꿔치는 이동(`replace`)이면 뒤로가기로 알림센터에 **돌아올 수 없다.**
   * T1-2가 세운 「뒤로가기 기록」 규율과 같은 계열이고, 자기 치유가 만들 수 없는 값으로 잰다.
   */
  it('이동한 뒤 뒤로가기 한 번에 알림센터로 돌아온다', async () => {
    const { user } = renderRow(APPROVAL);

    await user.click(moveLink());

    /* 짝 양성 — 실제로 대상으로 갔다. */
    expect(screen.getByTestId('location')).toHaveTextContent('/approval/inbox?rq=7201');

    await user.click(screen.getByRole('button', { name: '뒤로' }));

    expect(screen.getByTestId('location')).toHaveTextContent('/notification/center');
  });

  /** ⭐ 주소를 든 링크다 — 새 창으로 열기·주소 복사가 되고 보조 기술이 갈 곳을 읽는다. */
  it('링크가 주소를 든다', () => {
    renderRow(APPROVAL);

    expect(moveLink()).toHaveAttribute('href', '/approval/inbox?rq=7201');
  });
});

describe('NotificationRow — 목록에 여럿일 때', () => {
  /**
   * ⭐ **카드 둘이 각자 자기 대상 이름을 든다.** 이름이 같으면 음성 조작도 보조 기술도
   * 어느 것을 부르는지 가릴 수 없다 — 고정 문자열로 두는 실수를 이 자리가 막는다.
   */
  it('줄이 둘이면 링크 이름도 각자 자기 제목을 든다', () => {
    const rowOf = (notificationId: number, title: string) => {
      const view = toNotificationView(
        notificationFixture({ notificationId, ...APPROVAL, targetId: notificationId }),
      );

      return (
        <NotificationRow
          key={notificationId}
          view={view}
          title={title}
          isRead={false}
          isPending={false}
          onRead={() => undefined}
        />
      );
    };

    render(
      <MemoryRouter initialEntries={['/notification/center']}>
        {rowOf(7101, '합성 이벤트 가')}
        {rowOf(7102, '합성 이벤트 나')}
      </MemoryRouter>,
    );

    /* 짝 양성 — 링크가 실제로 둘이다. 그래야 이름 단언이 뜻을 갖는다. */
    expect(screen.getAllByRole('link')).toHaveLength(2);
    expect(
      screen.getByRole('link', { name: t.actions.openTarget('합성 이벤트 가') }),
    ).toHaveAttribute('href', '/approval/inbox?rq=7101');
    expect(
      screen.getByRole('link', { name: t.actions.openTarget('합성 이벤트 나') }),
    ).toHaveAttribute('href', '/approval/inbox?rq=7102');
  });
});
