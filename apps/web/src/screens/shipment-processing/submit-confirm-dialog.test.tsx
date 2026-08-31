import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { SubmitConfirmDialog } from './submit-confirm-dialog';

describe('SubmitConfirmDialog', () => {
  it('대상·되돌릴 수 없음·미확정 안내를 낸다', () => {
    render(
      <SubmitConfirmDialog
        shipmentRequestNo="SYN-SR-501"
        banner={null}
        isSubmitting={false}
        onClose={vi.fn()}
        onConfirm={vi.fn()}
      />,
    );

    expect(screen.getByText('SYN-SR-501 출하 처리')).toBeInTheDocument();
    expect(screen.getByText('SYN-SR-501을(를) 출하 처리합니다.')).toBeInTheDocument();
    expect(screen.getByText(/되돌릴 수 없습니다/)).toBeInTheDocument();
    expect(
      screen.getByText('처리 후에도 출하는 미확정 상태입니다. 확정은 별도 화면에서 진행합니다.'),
    ).toBeInTheDocument();
  });

  it('확인·취소 버튼이 각자의 콜백을 부른다', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    const onClose = vi.fn();

    render(
      <SubmitConfirmDialog
        shipmentRequestNo="SYN-SR-501"
        banner={null}
        isSubmitting={false}
        onClose={onClose}
        onConfirm={onConfirm}
      />,
    );

    await user.click(screen.getByRole('button', { name: '출하 처리' }));
    expect(onConfirm).toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: '취소' }));
    expect(onClose).toHaveBeenCalled();
  });

  it('제출 중이면 버튼을 잠그고 닫기를 막는다', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();

    render(
      <SubmitConfirmDialog
        shipmentRequestNo="SYN-SR-501"
        banner={null}
        isSubmitting
        onClose={onClose}
        onConfirm={vi.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: '취소' })).toBeDisabled();
  });

  it('배너가 있으면 함께 낸다', () => {
    render(
      <SubmitConfirmDialog
        shipmentRequestNo="SYN-SR-501"
        banner={<p>synthetic banner</p>}
        isSubmitting={false}
        onClose={vi.fn()}
        onConfirm={vi.fn()}
      />,
    );

    expect(screen.getByText('synthetic banner')).toBeInTheDocument();
  });
});
