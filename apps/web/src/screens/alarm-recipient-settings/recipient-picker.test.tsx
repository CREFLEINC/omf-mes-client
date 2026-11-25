import { messages } from '@omf-mes/i18n';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { createStubFetch, jsonResponse, renderWithProviders } from '../../test/api-harness';
import { RecipientPicker } from './recipient-picker';

const t = messages.alarmRecipientSettings;

const CANDIDATES = [61, 62, 63, 64].map((id) => ({
  appUserId: id,
  loginId: `syn.c${String(id)}`,
  userName: `후보 ${String(id)}`,
  departmentName: '합성 부서',
  hasPhone: true,
}));

const renderPicker = (props: { max?: number; existing?: number[] } = {}) => {
  const onAdd = vi.fn();
  renderWithProviders(
    <RecipientPicker
      open
      existingIds={new Set(props.existing ?? [])}
      onAdd={onAdd}
      onClose={() => undefined}
      {...(props.max === undefined ? {} : { max: props.max })}
    />,
    {
      fetch: createStubFetch([
        {
          match: (request) =>
            new URL(request.url).pathname === '/app/notification-settings/recipient-candidates',
          respond: () =>
            jsonResponse({
              items: CANDIDATES,
              page: { page: 1, size: 20, total: CANDIDATES.length },
            }),
        },
      ]),
    },
  );
  return { onAdd };
};

const box = (id: number) => screen.getByRole('checkbox', { name: `후보 ${String(id)} 선택` });

describe('RecipientPicker — 상한(D-11)', () => {
  it('US2-3 상한을 주면 남은 자리를 알리고, 차면 남은 체크를 잠근다', async () => {
    const user = userEvent.setup();
    const { onAdd } = renderPicker({ max: 5, existing: [61, 62, 63] });

    expect(await screen.findByText(t.picker.addable(2))).toBeInTheDocument();
    await screen.findByText('후보 64');
    /* 이미 수신자인 사람은 체크 칸 없이 「추가됨」 표식만. */
    expect(screen.queryByRole('checkbox', { name: '후보 61 선택' })).toBeNull();
    const existingRow = screen.getByText('후보 61').closest('tr');
    expect(existingRow).not.toBeNull();
    expect(within(existingRow as HTMLElement).getByText(t.values.alreadyAdded)).toBeInTheDocument();

    const dialog = within(screen.getByRole('dialog'));
    /* 고르기 전에는 「추가」(잠김), 고르면 「N명 추가」. */
    expect(dialog.getByRole('button', { name: t.actions.addPick })).toBeDisabled();

    await user.click(box(64));
    expect(screen.getByText(t.picker.addable(1))).toBeInTheDocument();
    expect(box(64)).toBeEnabled();

    await user.click(dialog.getByRole('button', { name: '1명 추가' }));
    expect(onAdd).toHaveBeenCalledWith([expect.objectContaining({ appUserId: 64 })]);
  });

  it('US2-3 상한 4 에서 3명이 있고 1명을 고르면 남은 체크가 잠긴다', async () => {
    const user = userEvent.setup();
    renderPicker({ max: 4, existing: [61, 62] });

    await screen.findByText(t.picker.addable(2));
    await screen.findByText('후보 64');
    await user.click(box(63));
    await user.click(box(64));

    expect(screen.getByText(t.picker.addable(0))).toBeInTheDocument();
    expect(box(63)).toBeEnabled();
    await user.click(box(63));
    expect(screen.getByText(t.picker.addable(1))).toBeInTheDocument();
  });

  it('상한을 주지 않으면 안내가 없고 몇 명이든 고를 수 있다(W-CO-11 그대로)', async () => {
    const user = userEvent.setup();
    renderPicker({ existing: [61] });

    await screen.findByText('후보 64');
    await user.click(box(62));
    await user.click(box(63));
    await user.click(box(64));

    expect(screen.queryByText(/남은 자리|최대/)).toBeNull();
    for (const id of [62, 63, 64]) expect(box(id)).toBeChecked();
    expect(screen.getByRole('button', { name: '3명 추가' })).toBeEnabled();
  });
});
