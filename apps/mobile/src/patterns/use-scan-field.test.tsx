import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import type { ScannerAdapter } from './scanner';
import { useScanField } from './use-scan-field';

const Probe = ({ onScan, scanner }: { onScan: (v: string) => void; scanner?: ScannerAdapter }) => {
  const field = useScanField({ onScan, scanner });
  return (
    <>
      <input aria-label="스캔" ref={field.ref} />
      <button type="button">다른 곳</button>
    </>
  );
};

describe('스캔 필드 결선', () => {
  it('붙는 순간 포커스를 가져간다', () => {
    render(<Probe onScan={vi.fn()} />);

    expect(screen.getByLabelText('스캔')).toHaveFocus();
  });

  it('스캔값을 그대로 넘긴다', async () => {
    const user = userEvent.setup();
    const onScan = vi.fn();
    render(<Probe onScan={onScan} />);

    await user.type(screen.getByLabelText('스캔'), 'SYN-LOT-0001{Enter}');

    expect(onScan).toHaveBeenCalledWith('SYN-LOT-0001');
  });

  it('넘긴 뒤 입력 칸이 비워진다', async () => {
    const user = userEvent.setup();
    render(<Probe onScan={vi.fn()} />);

    const field = screen.getByLabelText('스캔');
    await user.type(field, 'SYN-LOT-0002{Enter}');

    expect(field).toHaveValue('');
  });

  it('포커스가 벗어나면 되돌린다', async () => {
    const user = userEvent.setup();
    render(<Probe onScan={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: '다른 곳' }));
    await vi.waitFor(() => {
      expect(screen.getByLabelText('스캔')).toHaveFocus();
    });
  });

  it('연결한 어댑터를 쓴다', () => {
    const attach = vi.fn().mockReturnValue(() => {});
    const fake: ScannerAdapter = {
      getStatus: () => 'ready',
      onStatusChange: () => () => {},
      attach,
    };

    render(<Probe onScan={vi.fn()} scanner={fake} />);

    expect(attach).toHaveBeenCalledTimes(1);
  });

  it('사라질 때 어댑터 연결을 끊는다', () => {
    const detach = vi.fn();
    const fake: ScannerAdapter = {
      getStatus: () => 'ready',
      onStatusChange: () => () => {},
      attach: () => detach,
    };

    const { unmount } = render(<Probe onScan={vi.fn()} scanner={fake} />);
    unmount();

    expect(detach).toHaveBeenCalled();
  });
});
