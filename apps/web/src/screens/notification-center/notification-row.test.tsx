import { messages } from '@omf-mes/i18n';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation } from 'react-router';
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

const APPROVAL = { targetTypeCode: 'APPROVAL_REQUEST', targetId: 7201 };

const renderRow = (overrides: Parameters<typeof notificationFixture>[0] = {}) => {
  const onRead = vi.fn();
  const view = toNotificationView(notificationFixture(overrides));

  render(
    <MemoryRouter initialEntries={['/notification/center']}>
      <NotificationRow
        view={view}
        title="SYN-EVENT-01"
        isRead={view.read}
        isPending={false}
        onRead={onRead}
      />
      <LocationProbe />
    </MemoryRouter>,
  );

  return { onRead, user: userEvent.setup() };
};

const card = () => screen.getByRole('button', { name: 'SYN-EVENT-01' });
const moveButton = () => screen.getByRole('button', { name: t.actions.openTarget('SYN-EVENT-01') });

describe('NotificationRow — 이동 버튼이 서는 갈래', () => {
  it('대응표에 있는 유형에는 이동 버튼이 선다', () => {
    renderRow(APPROVAL);

    expect(moveButton()).toBeInTheDocument();
  });

  it('누르면 그 건의 결재함으로 간다', async () => {
    const { user } = renderRow(APPROVAL);

    await user.click(moveButton());

    expect(screen.getByTestId('location')).toHaveTextContent('/approval/inbox?rq=7201');
  });

  /**
   * ⭐ **이동은 읽음 처리를 일으키지 않는다.** 버튼이 카드 **밖**에 있어 클릭이 카드로
   * 올라가지 않는다 — 두 조작이 한 클릭에 겹치면 사용자가 무엇을 했는지 가릴 수 없다.
   */
  it('이동 버튼을 눌러도 읽음 처리가 일어나지 않는다', async () => {
    const { onRead, user } = renderRow(APPROVAL);

    /* 짝 양성 — 카드를 누르면 실제로 읽음 처리가 일어난다. */
    await user.click(card());
    expect(onRead).toHaveBeenCalledTimes(1);

    await user.click(moveButton());

    expect(onRead).toHaveBeenCalledTimes(1);
  });
});

describe('NotificationRow — 이동 버튼이 서지 않는 갈래', () => {
  /** 음성 단언을 **짝 양성 뒤 시점**에 잰다 — 카드는 실제로 서 있다. */
  const expectNoMoveButton = (): void => {
    expect(card()).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: t.actions.openTarget('SYN-EVENT-01') }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText(t.actions.openTargetShort)).not.toBeInTheDocument();
  };

  it('도착지가 없는 계약 유형에는 서지 않는다', () => {
    renderRow({ targetTypeCode: 'LOT', targetId: 7201 });

    expectNoMoveButton();
  });

  it('모르는 코드에도 서지 않는다', () => {
    renderRow({ targetTypeCode: 'SYN-UNKNOWN', targetId: 7201 });

    expectNoMoveButton();
  });

  it('번호가 없으면 서지 않는다', () => {
    renderRow({ targetTypeCode: 'APPROVAL_REQUEST' });

    expectNoMoveButton();
  });

  it('대상이 아예 없으면 서지 않는다', () => {
    renderRow();

    expectNoMoveButton();
  });

  /** 버튼이 없어도 **원본 코드는 그대로 보인다** — 사용자가 담당자에게 전할 단서다. */
  it('버튼이 없어도 제목은 그대로 보인다', () => {
    renderRow({ targetTypeCode: 'LOT', targetId: 7201 });

    expect(screen.getByText('SYN-EVENT-01')).toBeInTheDocument();
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
  it('카드 안에 이동 버튼이 들어가지 않는다', () => {
    renderRow(APPROVAL);

    /* 짝 양성 — 이동 버튼이 실제로 서 있다. 그래야 「안에 없다」가 뜻을 갖는다. */
    expect(moveButton()).toBeInTheDocument();
    expect(card().querySelector('button, a, [role="button"]')).toBeNull();
  });

  it('버튼이 카드의 형제로 같은 줄에 선다', () => {
    renderRow(APPROVAL);

    expect(card().parentElement).toBe(moveButton().parentElement);
  });

  /** 키보드 순회가 카드 → 이동 버튼 차례다(T4-10의 감지기 가능한 부분). */
  it('카드 다음에 이동 버튼이 온다', async () => {
    const { user } = renderRow(APPROVAL);

    await user.tab();
    expect(card()).toHaveFocus();

    await user.tab();
    expect(moveButton()).toHaveFocus();
  });
});
