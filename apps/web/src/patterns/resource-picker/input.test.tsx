import { messages } from '@omf-mes/i18n';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { createStubFetch, jsonResponse, renderWithProviders } from '../../test/api-harness';

import { ResourcePickerInput } from './input';
import { RESOURCE_PAGE_SIZE } from './queries';

const t = messages.resourcePicker;

const renderInput = (props: Partial<Parameters<typeof ResourcePickerInput>[0]> = {}) => {
  const onPick = vi.fn();
  const onClear = vi.fn();

  renderWithProviders(
    <>
      <label htmlFor="resource">금형</label>
      <ResourcePickerInput
        id="resource"
        kind="mold"
        plantId={9001}
        valueLabel=""
        onPick={onPick}
        onClear={onClear}
        {...props}
      />
    </>,
    {
      fetch: createStubFetch([
        {
          match: (request) => new URL(request.url).pathname === '/mdm/molds',
          respond: () =>
            jsonResponse({
              items: [
                {
                  moldId: 8501,
                  plantId: 9001,
                  moldCode: 'SYN-MOLD-01',
                  moldName: '합성 금형 A',
                  isActive: true,
                },
              ],
              page: { page: 1, size: RESOURCE_PAGE_SIZE, total: 1 },
            }),
        },
      ]),
      route: '/',
    },
  );

  return { onPick, onClear, user: userEvent.setup() };
};

describe('ResourcePickerInput', () => {
  /* 칸에 직접 쳐서 값을 만들지 못하게 한다 — 값은 찾기 창에서 고른 것뿐이다. */
  it('고른 값을 읽기 전용으로 보인다', () => {
    renderInput({ valueLabel: 'SYN-MOLD-01 · 합성 금형 A' });

    const input = screen.getByLabelText('금형');
    expect(input).toHaveValue('SYN-MOLD-01 · 합성 금형 A');
    expect(input).toHaveAttribute('readonly');
  });

  it('칸을 누르면 찾기 창이 열리고, 고르면 넘기고 창을 닫는다', async () => {
    const { onPick, user } = renderInput();

    await user.click(screen.getByLabelText('금형'));
    const dialog = within(screen.getByRole('dialog', { name: t.title.mold }));

    await user.click(await dialog.findByRole('checkbox', { name: 'SYN-MOLD-01' }));
    await user.click(dialog.getByRole('button', { name: t.pick }));

    expect(onPick).toHaveBeenCalledWith(expect.objectContaining({ id: 8501, code: 'SYN-MOLD-01' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  /* 읽기 전용 칸이라 키보드 사용자에게는 엔터가 유일한 입구다. */
  it('칸에서 엔터를 치면 찾기 창이 열린다', async () => {
    const { user } = renderInput();

    screen.getByLabelText('금형').focus();
    await user.keyboard('{Enter}');

    expect(screen.getByRole('dialog', { name: t.title.mold })).toBeInTheDocument();
  });

  it('공장이 없으면 잠겨 창을 열지 않는다', async () => {
    const { user } = renderInput({ plantId: null });

    expect(screen.getByLabelText('금형')).toBeDisabled();
    await user.click(screen.getByLabelText('금형'));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('지우기 단추는 값을 비운다', async () => {
    const { onClear, user } = renderInput({ valueLabel: 'SYN-MOLD-01 · 합성 금형 A' });

    await user.click(screen.getByRole('button', { name: t.clear.mold }));

    expect(onClear).toHaveBeenCalledOnce();
  });

  it('잠긴 칸은 눌러도 창이 열리지 않는다', async () => {
    const { user } = renderInput({ disabled: true });

    await user.click(screen.getByLabelText('금형'));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
