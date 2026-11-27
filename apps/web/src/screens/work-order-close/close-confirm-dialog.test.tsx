import { messages } from '@omf-mes/i18n';
import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi } from 'vitest';

import { WorkOrderCloseConfirmDialog } from './close-confirm-dialog';

const t = messages.workOrderClose.confirm;

const renderDialog = (
  overrides: Partial<React.ComponentProps<typeof WorkOrderCloseConfirmDialog>> = {},
) => {
  const props = {
    workOrderNo: 'SYN-WO-ALPHA',
    details: [],
    openLotNos: [],
    warnings: [],
    banner: null,
    isSubmitting: false,
    onClose: vi.fn(),
    onConfirm: vi.fn(),
    ...overrides,
  };
  render(<WorkOrderCloseConfirmDialog {...props} />, { wrapper: MemoryRouter });
  return props;
};

describe('WorkOrderCloseConfirmDialog', () => {
  it('uses exact Korean copy and explicit Dialog structure', () => {
    renderDialog();
    const dialog = screen.getByRole('dialog');

    expect(t.title).toBe('작업지시 마감');
    expect(t.irreversible).toBe(
      '마감 후에는 작업지시 마감을 취소할 수 없습니다. 실적 정정이 필요하면 생산실적을 정정 처리해 주세요.',
    );
    expect(t.cancel).toBe('취소');
    expect(t.confirm).toBe('작업지시 마감');
    expect(dialog).toHaveAttribute('open');
    expect(dialog).toHaveTextContent(t.title);
    /* 번호는 정보 상자에 한 번만 */
    expect(within(dialog).getByText(t.workOrderNo).nextElementSibling).toHaveTextContent(
      'SYN-WO-ALPHA',
    );
    expect(within(dialog).getAllByText('SYN-WO-ALPHA')).toHaveLength(1);
    expect(dialog).toHaveTextContent(t.irreversible);
    expect(dialog).toHaveTextContent('마감하면 생산실적이 ERP 송신 대기 상태로 등록됩니다.');
    expect(within(dialog).getByRole('link', { name: 'ERP 연동 현황·이력' })).toHaveAttribute(
      'href',
      '/master-data/integration-sync',
    );
    expect(screen.queryByRole('button', { name: /닫기/ })).not.toBeInTheDocument();
  });

  it('미마감 LOT 이 없으면 그 구획을 내지 않고, 있으면 「미마감 LOT N건」 아래 번호를 줄마다 보인다', () => {
    const { unmount } = render(
      <WorkOrderCloseConfirmDialog
        workOrderNo="SYN-WO"
        details={[]}
        openLotNos={[]}
        warnings={[]}
        banner={null}
        isSubmitting={false}
        onClose={vi.fn()}
        onConfirm={vi.fn()}
      />,
      { wrapper: MemoryRouter },
    );
    expect(screen.getByRole('dialog')).not.toHaveTextContent(t.openLotsNote);
    expect(screen.queryByRole('listitem')).not.toBeInTheDocument();
    unmount();

    renderDialog({ openLotNos: ['LOT-SYN-1', 'LOT-SYN-2'] });
    const lots = screen.getByRole('region', { name: t.openLotsHeading(2) });
    expect(t.openLotsHeading(2)).toBe('미마감 LOT 2건');
    expect(lots).toHaveTextContent('작업지시를 마감해도 아래 LOT는 미마감 상태로 남습니다.');
    expect(
      within(lots)
        .getAllByRole('listitem')
        .map((item) => item.textContent),
    ).toEqual(['LOT-SYN-1', 'LOT-SYN-2']);
  });

  it('판정은 정보 상자 첫 줄에 상태 칩으로, 나머지 입력은 둘째 줄에 보인다', () => {
    renderDialog({
      details: [
        { label: t.fields.judgment, value: '정상', judgment: 'NORMAL' },
        { label: t.fields.reason, value: '자재 부족' },
      ],
    });
    const dialog = screen.getByRole('dialog');
    const rows = dialog.querySelectorAll('.info-facts-row');

    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveTextContent(t.workOrderNo);
    expect(rows[0]).toHaveTextContent(t.fields.judgment);
    expect(rows[1]).toHaveTextContent(t.fields.reason);
    expect(within(rows[0] as HTMLElement).getByText('정상')).toBeInTheDocument();
  });

  it('retains a supplied banner and omits it when null', () => {
    const props = {
      workOrderNo: 'SYN-WO-BANNER',
      details: [],
      openLotNos: [],
      warnings: [],
      isSubmitting: false,
      onClose: vi.fn(),
      onConfirm: vi.fn(),
    };
    const { rerender } = render(<WorkOrderCloseConfirmDialog {...props} banner={null} />, {
      wrapper: MemoryRouter,
    });
    expect(screen.queryByTestId('caller-banner')).not.toBeInTheDocument();

    rerender(
      <WorkOrderCloseConfirmDialog
        {...props}
        banner={<aside data-testid="caller-banner">Synthetic banner</aside>}
      />,
    );
    expect(screen.getByTestId('caller-banner')).toHaveTextContent('Synthetic banner');
  });

  it('orders cancel then confirm and delegates each callback once', async () => {
    const user = userEvent.setup();
    const props = renderDialog();
    const buttons = within(screen.getByRole('dialog')).getAllByRole('button');

    expect(buttons).toHaveLength(2);
    expect(buttons[0]).toHaveAccessibleName(t.cancel);
    expect(buttons[1]).toHaveAccessibleName(t.confirm);
    expect(buttons[0]?.className).toContain('outlined');
    await user.click(buttons[0]!);
    await user.click(buttons[1]!);
    expect(props.onClose).toHaveBeenCalledTimes(1);
    expect(props.onConfirm).toHaveBeenCalledTimes(1);
  });

  it('guards close attempts while submitting and loads confirm', () => {
    const props = renderDialog({ isSubmitting: true });
    const dialog = screen.getByRole('dialog');
    const cancel = screen.getByRole('button', { name: t.cancel });
    const confirm = screen.getByRole('button', { name: t.confirm });

    expect(cancel).toBeDisabled();
    expect(confirm).toBeDisabled();
    expect(confirm).toHaveAttribute('aria-busy', 'true');
    fireEvent(dialog, new Event('cancel', { bubbles: false, cancelable: true }));
    expect(props.onClose).not.toHaveBeenCalled();
  });

  it('delegates a non-submitting Dialog close attempt once and has no ERP-complete claim', () => {
    const props = renderDialog();
    const dialog = screen.getByRole('dialog');

    fireEvent.click(dialog);
    expect(props.onClose).not.toHaveBeenCalled();

    fireEvent(dialog, new Event('cancel', { bubbles: false, cancelable: true }));
    expect(props.onClose).toHaveBeenCalledTimes(1);
    expect(screen.queryByText(/ERP 송신(이|은) (성공|완료)되었습니다/)).not.toBeInTheDocument();
  });

  it('고른 내용을 한 칸에 한 값씩, 그 아래 마감과 함께 일어나는 일을 보인다', () => {
    renderDialog({
      details: [
        { label: t.fields.judgment, value: '미달', judgment: 'UNDER' },
        { label: t.fields.reason, value: '자재 부족' },
      ],
      warnings: [t.voidedSlots(2)],
    });
    const dialog = screen.getByRole('dialog');

    expect(within(dialog).getByText(t.fields.judgment).nextElementSibling).toHaveTextContent(
      '미달',
    );
    expect(within(dialog).getByText(t.fields.reason).nextElementSibling).toHaveTextContent(
      '자재 부족',
    );
    expect(dialog).toHaveTextContent('실적이 없는 선발행 LOT 2건은 마감과 함께 폐번됩니다.');
  });
});
