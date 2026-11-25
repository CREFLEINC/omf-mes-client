import { messages } from '@omf-mes/i18n';
import { fireEvent, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { createStubFetch, jsonResponse, renderWithProviders } from '../../test/api-harness';
import { RecipientPicker } from './recipient-picker';

const t = messages.alarmRecipientSettings;

const candidate = (id: number, departmentName = '합성 부서') => ({
  appUserId: id,
  loginId: `syn.c${String(id)}`,
  userName: `후보 ${String(id)}`,
  departmentName,
  hasPhone: true,
});

const CANDIDATES = [61, 62, 63, 64].map((id) => candidate(id));

const DEPARTMENTS = [
  { departmentId: 7001, departmentCode: 'D-SYN', departmentName: '합성 부서' },
  { departmentId: 7002, departmentCode: 'D-QC', departmentName: '품질 부서' },
].map((row) => ({ ...row, parentDepartmentId: null, businessUnitId: null, isActive: true }));

const renderPicker = (
  props: { max?: number; existing?: number[]; candidates?: ReturnType<typeof candidate>[] } = {},
) => {
  const items = props.candidates ?? CANDIDATES;
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
          match: (request) => new URL(request.url).pathname === '/mdm/departments',
          respond: () =>
            jsonResponse({
              items: DEPARTMENTS,
              page: { page: 1, size: 100, total: DEPARTMENTS.length },
            }),
        },
        {
          match: (request) =>
            new URL(request.url).pathname === '/app/notification-settings/recipient-candidates',
          respond: () => jsonResponse({ items, page: { page: 1, size: 200, total: items.length } }),
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

describe('RecipientPicker — 부서 · 쪽 이동 · 닫기', () => {
  /* 체크 칸이 아니라 줄 어디를 눌러도 고르거나 푼다(사용자 지시 2026-11-25). */
  it('줄을 누르면 고르고, 다시 누르면 풀린다 — 이미 수신자인 줄은 반응하지 않는다', async () => {
    const user = userEvent.setup();
    renderPicker({ existing: [61] });

    await user.click(await screen.findByText('후보 62'));
    expect(box(62)).toBeChecked();
    expect(screen.getByRole('button', { name: '1명 추가' })).toBeEnabled();

    await user.click(screen.getByText('syn.c62'));
    expect(box(62)).not.toBeChecked();

    await user.click(box(63));
    expect(box(63)).toBeChecked();

    await user.click(screen.getByText('syn.c61'));
    expect(screen.queryByRole('checkbox', { name: '후보 61 선택' })).toBeNull();
    expect(screen.getByRole('button', { name: '1명 추가' })).toBeEnabled();
  });

  /* 후보 조회에 부서 조건이 없어 화면에서 부서 이름으로 거른다. */
  it('부서를 고르면 그 부서 사람만 남고, 고른 사람은 그대로 남는다', async () => {
    const user = userEvent.setup();
    renderPicker({
      candidates: [candidate(61), candidate(62, '품질 부서'), candidate(63, '품질 부서')],
    });

    await screen.findByText('후보 61');
    const department = screen.getByRole('combobox', { name: t.fields.department });
    expect(department).toHaveTextContent(t.picker.departmentAll);
    await user.click(box(61));

    await user.click(department);
    await user.click(await screen.findByRole('option', { name: 'D-QC · 품질 부서' }));
    expect(screen.queryByText('후보 61')).toBeNull();
    expect(screen.getByText('후보 62')).toBeInTheDocument();
    expect(screen.getByText('후보 63')).toBeInTheDocument();
    expect(screen.getByText(messages.screenPatterns.pageNav.total(2))).toBeInTheDocument();

    await user.click(box(62));
    expect(screen.getByRole('button', { name: '2명 추가' })).toBeEnabled();

    await user.click(screen.getByRole('combobox', { name: t.fields.department }));
    await user.click(await screen.findByRole('option', { name: t.picker.departmentAll }));
    expect(box(61)).toBeChecked();
    expect(box(62)).toBeChecked();
  });

  it('쪽을 넘겨도 고른 사람이 남고, 「N명 추가」가 모두 더한다', async () => {
    const user = userEvent.setup();
    const many = Array.from({ length: 12 }, (_, index) => candidate(101 + index));
    const { onAdd } = renderPicker({ candidates: many });
    const nav = messages.screenPatterns.pageNav;

    await screen.findByText('후보 101');
    expect(screen.getByText(nav.total(12))).toBeInTheDocument();
    expect(screen.getByText(nav.position(1, 2))).toBeInTheDocument();
    expect(screen.queryByText('후보 111')).toBeNull();
    await user.click(box(101));

    await user.click(screen.getByRole('button', { name: nav.next }));
    expect(screen.getByText(nav.position(2, 2))).toBeInTheDocument();
    await user.click(box(111));
    expect(screen.getByRole('button', { name: '2명 추가' })).toBeEnabled();

    await user.click(screen.getByRole('button', { name: nav.first }));
    expect(box(101)).toBeChecked();

    await user.click(screen.getByRole('button', { name: '2명 추가' }));
    expect(onAdd).toHaveBeenCalledWith([
      expect.objectContaining({ appUserId: 101 }),
      expect.objectContaining({ appUserId: 111 }),
    ]);
  });

  /* 모든 창의 닫기(X)를 없앴다 — [취소] · Esc 로 닫는다(사용자 지시 2026-11-25). */
  it('닫기(X) 단추가 없고 [취소] · Esc 로 닫는다', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    renderWithProviders(
      <RecipientPicker open existingIds={new Set()} onAdd={vi.fn()} onClose={onClose} />,
      {
        fetch: createStubFetch([
          {
            match: () => true,
            respond: () => jsonResponse({ items: [], page: { page: 1, size: 200, total: 0 } }),
          },
        ]),
      },
    );

    const dialog = within(screen.getByRole('dialog'));
    expect(dialog.queryByRole('button', { name: messages.common.close })).toBeNull();
    expect(dialog.queryByRole('button', { name: '닫기' })).toBeNull();
    await user.click(dialog.getByRole('button', { name: t.actions.cancel }));
    /* Esc — native `<dialog>` 의 `cancel` 을 디자인 시스템이 닫기 요청으로 잇는다(jsdom 은 키로 내지 않는다). */
    fireEvent(
      screen.getByRole('dialog'),
      new Event('cancel', { bubbles: false, cancelable: true }),
    );
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});
