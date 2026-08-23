import { messages } from '@omf-mes/i18n';
import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { WorkOrderCloseConfirmDialog } from './close-confirm-dialog';

const t = messages.workOrderClose.confirm;

const renderDialog = (
  overrides: Partial<React.ComponentProps<typeof WorkOrderCloseConfirmDialog>> = {},
) => {
  const props = {
    workOrderNo: 'SYN-WO-ALPHA',
    banner: null,
    isSubmitting: false,
    onClose: vi.fn(),
    onConfirm: vi.fn(),
    ...overrides,
  };
  render(<WorkOrderCloseConfirmDialog {...props} />);
  return props;
};

describe('WorkOrderCloseConfirmDialog', () => {
  it('uses exact Korean copy and explicit Dialog structure', () => {
    renderDialog();

    expect(t.title('SYN-WO-ALPHA')).toBe('작업지시 마감 — SYN-WO-ALPHA');
    expect(t.target('SYN-WO-ALPHA')).toBe('대상 작업지시: SYN-WO-ALPHA');
    expect(t.irreversible).toBe(
      '작업지시 마감은 되돌릴 수 없습니다. 정정이 필요하면 생산실적을 상계 처리하세요.',
    );
    expect(t.erp).toBe('ERP 송신은 별도로 진행되며, 이 확인은 ERP 송신 완료를 의미하지 않습니다.');
    expect(t.cancel).toBe('취소');
    expect(t.confirm).toBe('작업지시 마감');
    expect(screen.getByRole('dialog')).toHaveAttribute('open');
    expect(screen.getByRole('dialog')).toHaveTextContent(t.title('SYN-WO-ALPHA'));
    expect(screen.getByRole('dialog')).toHaveTextContent(t.target('SYN-WO-ALPHA'));
    expect(screen.getByRole('dialog')).toHaveTextContent(t.irreversible);
    expect(screen.getByRole('dialog')).toHaveTextContent(t.erp);
    expect(screen.queryByRole('button', { name: /닫기/ })).not.toBeInTheDocument();
  });

  it('retains a supplied banner and omits it when null', () => {
    const props = {
      workOrderNo: 'SYN-WO-BANNER',
      isSubmitting: false,
      onClose: vi.fn(),
      onConfirm: vi.fn(),
    };
    const { rerender } = render(<WorkOrderCloseConfirmDialog {...props} banner={null} />);
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
});
