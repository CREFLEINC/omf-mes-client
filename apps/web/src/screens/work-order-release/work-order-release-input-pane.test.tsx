import { messages } from '@omf-mes/i18n';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { renderWithProviders } from '../../test/api-harness';
import {
  WorkOrderReleaseInputPane,
  type WorkOrderReleaseInputPaneProps,
} from './work-order-release-input-pane';

const t = messages.workOrderRelease.input;

const propsOf = (
  overrides: Partial<WorkOrderReleaseInputPaneProps> = {},
): WorkOrderReleaseInputPaneProps => ({
  ownerKey: 704,
  orderQty: 5_000,
  uomLabel: 'EA',
  lockedReason: null,
  onBodyChange: vi.fn(),
  ...overrides,
});

const renderPane = (overrides: Partial<WorkOrderReleaseInputPaneProps> = {}) => {
  const props = propsOf(overrides);
  const user = userEvent.setup();
  return { ...renderWithProviders(<WorkOrderReleaseInputPane {...props} />), props, user };
};

describe('WorkOrderReleaseInputPane', () => {
  it('isolates no selection from stale input controls', async () => {
    const { props } = renderPane({ ownerKey: null, orderQty: null });

    expect(screen.getByText(t.empty.title)).toBeVisible();
    expect(screen.queryByRole('textbox')).toBeNull();
    await waitFor(() => expect(props.onBodyChange).toHaveBeenLastCalledWith(null));
  });

  it('reports the exact body and ceiling slot preview from controlled text', async () => {
    const { props, user } = renderPane();
    const pane = screen.getByRole('region', { name: t.pane });
    expect(pane).toHaveClass('work-order-release-input-pane');

    await user.type(screen.getByRole('textbox', { name: t.fields.lotSize }), '1200');
    await user.type(screen.getByRole('textbox', { name: t.fields.handoverNote }), ' 교대 전달 ');

    await waitFor(() =>
      expect(props.onBodyChange).toHaveBeenLastCalledWith({
        lotSize: 1_200,
        handoverNote: '교대 전달',
      }),
    );
    expect(screen.getByText(t.preview.title(5))).toBeVisible();
    expect(screen.getByText(/5,000 EA ÷ 1,200 EA = 5 슬롯/)).toBeVisible();
    expect(screen.getByText(new RegExp(t.preview.planNotice))).toBeVisible();
  });

  it('shows a nonblocking one-slot warning at the equal boundary', async () => {
    const { props, user } = renderPane({ orderQty: 120 });

    await user.type(screen.getByRole('textbox', { name: t.fields.lotSize }), '120');

    await waitFor(() => expect(props.onBodyChange).toHaveBeenLastCalledWith({ lotSize: 120 }));
    expect(screen.getByRole('alert')).toHaveTextContent(t.warning.title);
    expect(screen.getByText(t.warning.description)).toBeVisible();
    expect(screen.getByText(t.preview.title(1))).toBeVisible();
  });

  it('clears the owner-bound draft before reporting the next work order', async () => {
    const onBodyChange = vi.fn();
    const { rerender, user } = renderPane({ onBodyChange });
    await user.type(screen.getByRole('textbox', { name: t.fields.lotSize }), '500');
    await user.type(screen.getByRole('textbox', { name: t.fields.handoverNote }), 'OLD NOTE');
    await waitFor(() =>
      expect(onBodyChange).toHaveBeenLastCalledWith({ lotSize: 500, handoverNote: 'OLD NOTE' }),
    );

    rerender(
      <WorkOrderReleaseInputPane {...propsOf({ ownerKey: 705, orderQty: 120, onBodyChange })} />,
    );

    expect(screen.getByRole('textbox', { name: t.fields.lotSize })).toHaveValue('');
    expect(screen.getByRole('textbox', { name: t.fields.handoverNote })).toHaveValue('');
    expect(screen.queryByText(t.preview.title(10))).toBeNull();
    await waitFor(() => expect(onBodyChange).toHaveBeenLastCalledWith(null));
  });

  it('prioritizes local LOT errors, exposes server field errors, and clears each on edit', async () => {
    const onClearFieldError = vi.fn();
    const { user } = renderPane({
      fieldErrors: { lotSize: 'SERVER LOT ERROR', handoverNote: 'SERVER NOTE ERROR' },
      onClearFieldError,
    });
    const lotSize = screen.getByRole('textbox', { name: t.fields.lotSize });
    const note = screen.getByRole('textbox', { name: t.fields.handoverNote });

    expect(lotSize).toHaveAccessibleDescription(t.errors.lotSizeRequired);
    expect(note).toHaveAccessibleDescription('SERVER NOTE ERROR');
    await user.type(lotSize, '25');
    await user.type(note, 'N');
    expect(onClearFieldError).toHaveBeenCalledWith('lotSize');
    expect(onClearFieldError).toHaveBeenCalledWith('handoverNote');
  });

  it('locks both inputs with field-owned visible reasons and does not add a checkbox', () => {
    renderPane({ lockedReason: '배포 처리가 끝나면 다시 입력할 수 있습니다.' });

    const lotSize = screen.getByRole('textbox', { name: t.fields.lotSize });
    const note = screen.getByRole('textbox', { name: t.fields.handoverNote });
    expect(lotSize).toBeDisabled();
    expect(note).toBeDisabled();
    expect(lotSize).toHaveAccessibleDescription(
      t.locked.lotSize('배포 처리가 끝나면 다시 입력할 수 있습니다.'),
    );
    expect(note).toHaveAccessibleDescription(
      t.locked.handoverNote('배포 처리가 끝나면 다시 입력할 수 있습니다.'),
    );
    expect(
      screen.getByText(t.locked.lotSize('배포 처리가 끝나면 다시 입력할 수 있습니다.')),
    ).toBeVisible();
    expect(
      screen.getByText(t.locked.handoverNote('배포 처리가 끝나면 다시 입력할 수 있습니다.')),
    ).toBeVisible();
    expect(screen.queryByRole('checkbox')).toBeNull();
  });
});
