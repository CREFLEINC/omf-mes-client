import { messages } from '@omf-mes/i18n';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { NotificationFilterBar } from './filter-bar';
import { DEFAULT_FILTERS, type NotificationFilters } from './filters';
import type { SelectOption } from './types';

const t = messages.notificationCenter;

const PERIOD = { from: '2026-08-01', to: '2026-08-07' };

const OPTIONS: SelectOption[] = [
  { value: '', label: t.filters.all },
  { value: 'SYN-EVENT-01', label: '합성 이벤트 가' },
  { value: 'SYN-EVENT-02', label: '합성 이벤트 나' },
];

const renderBar = (filters: NotificationFilters = DEFAULT_FILTERS, eventNote?: string) => {
  const onChangePeriod = vi.fn();
  const onChangeFilters = vi.fn();

  render(
    <NotificationFilterBar
      period={PERIOD}
      filters={filters}
      eventOptions={OPTIONS}
      eventNote={eventNote}
      onChangePeriod={onChangePeriod}
      onChangeFilters={onChangeFilters}
    />,
  );

  return { onChangePeriod, onChangeFilters, user: userEvent.setup() };
};

describe('NotificationFilterBar', () => {
  it('세 조건이 이름을 갖고 선다', () => {
    renderBar();

    expect(screen.getByLabelText(t.fields.period)).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: t.fields.unreadOnly })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: t.fields.eventCode })).toBeInTheDocument();
  });

  /**
   * ⭐ **「조회」 버튼을 두지 않는다.** 세 컨트롤이 전부 완결된 값만 방출하므로 조작 하나가 곧
   * 조회다. 전례들이 그 버튼을 두는 이유는 자유 입력 칸이 있어 치는 도중의 반쪽 값으로 요청이
   * 나가기 때문인데, 이 화면에는 그 칸이 하나도 없다.
   */
  it('조회·초기화 버튼을 두지 않는다 — 조작 하나가 곧 조회다', () => {
    renderBar();

    /* 짝 양성 — 조건 컨트롤은 실제로 서 있다. */
    expect(screen.getByRole('checkbox', { name: t.fields.unreadOnly })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: messages.common.search })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: messages.common.reset })).not.toBeInTheDocument();
  });

  it('기본 상태에서 「안 읽음만」이 켜져 있다', () => {
    renderBar();

    expect(screen.getByRole('checkbox', { name: t.fields.unreadOnly })).toBeChecked();
  });

  it('「안 읽음만」을 끄면 그 사실만 알린다', async () => {
    const { onChangeFilters, user } = renderBar();

    await user.click(screen.getByRole('checkbox', { name: t.fields.unreadOnly }));

    expect(onChangeFilters).toHaveBeenCalledWith({ unreadOnly: false, eventCode: '' });
  });

  it('유형을 고르면 그 코드를 알린다 — 다른 조건은 그대로다', async () => {
    const { onChangeFilters, user } = renderBar({ unreadOnly: false, eventCode: '' });

    await user.click(screen.getByRole('combobox', { name: t.fields.eventCode }));
    await user.click(await screen.findByRole('option', { name: '합성 이벤트 가' }));

    expect(onChangeFilters).toHaveBeenCalledWith({ unreadOnly: false, eventCode: 'SYN-EVENT-01' });
  });

  /** 「전체」가 값이 빈 선택지로 없으면 한 번 고른 뒤 조건을 해제할 방법이 사라진다. */
  it('「전체」로 되돌릴 수 있다', async () => {
    const { onChangeFilters, user } = renderBar({
      unreadOnly: true,
      eventCode: 'SYN-EVENT-01',
    });

    await user.click(screen.getByRole('combobox', { name: t.fields.eventCode }));
    await user.click(await screen.findByRole('option', { name: t.filters.all }));

    expect(onChangeFilters).toHaveBeenCalledWith({ unreadOnly: true, eventCode: '' });
  });

  it('유형 목록을 못 받았으면 그 사실을 선택칸에 밝힌다', () => {
    renderBar(DEFAULT_FILTERS, t.filters.eventsFailed);

    expect(screen.getByText(t.filters.eventsFailed)).toBeInTheDocument();
  });

  it('정상일 때는 안내 자리를 만들지 않는다', () => {
    renderBar();

    expect(screen.queryByText(t.filters.eventsFailed)).not.toBeInTheDocument();
  });

  it('주소에 반영된 값을 그대로 보인다 — 자기 상태를 들지 않는다', () => {
    renderBar({ unreadOnly: false, eventCode: 'SYN-EVENT-02' });

    expect(screen.getByRole('checkbox', { name: t.fields.unreadOnly })).not.toBeChecked();
    expect(screen.getByRole('combobox', { name: t.fields.eventCode })).toHaveTextContent(
      '합성 이벤트 나',
    );
  });
});
