import { render, screen, waitFor } from '@testing-library/react';
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
      <button type="button" onClick={field.openManual}>
        직접 입력
      </button>
      <button type="button" onClick={field.submitManual}>
        찾기
      </button>
      <p>{field.manual ? '손 입력 중' : '스캔 대기'}</p>
    </>
  );
};

describe('스캔 필드 결선', () => {
  it('붙는 순간 포커스를 가져간다', () => {
    render(<Probe onScan={vi.fn()} />);

    expect(screen.getByLabelText('스캔')).toHaveFocus();
  });

  it('직접 입력을 열면 소프트 키보드를 받는다', async () => {
    const user = userEvent.setup();
    render(<Probe onScan={vi.fn()} />);

    expect(screen.getByLabelText('스캔')).toHaveAttribute('inputmode', 'none');

    await user.click(screen.getByRole('button', { name: '직접 입력' }));

    expect(screen.getByLabelText('스캔')).toHaveAttribute('inputmode', 'text');
    expect(screen.getByText('손 입력 중')).toBeTruthy();
  });

  it('손으로 적은 것을 스캔값과 같은 길로 넘긴다', async () => {
    const user = userEvent.setup();
    const onScan = vi.fn();
    render(<Probe onScan={onScan} />);

    await user.click(screen.getByRole('button', { name: '직접 입력' }));
    await user.type(screen.getByLabelText('스캔'), 'SYN-LOT-0010');
    await user.click(screen.getByRole('button', { name: '찾기' }));

    expect(onScan).toHaveBeenCalledWith('SYN-LOT-0010');
    expect(screen.getByText('스캔 대기')).toBeTruthy();
  });

  /*
   * 손으로 넘기면 칸을 비우는데, 그것을 어댑터가 모르면 다음 스캔의 첫 글자를 지우기로
   * 읽어 세지 않는다. 종료 문자를 붙이지 않는 단말에서 짧은 스캔이 그대로 사라진다.
   */
  it('손으로 넘긴 뒤에도 다음 스캔을 온전히 받는다', async () => {
    const user = userEvent.setup();
    const onScan = vi.fn();
    render(<Probe onScan={onScan} />);

    await user.click(screen.getByRole('button', { name: '직접 입력' }));
    await user.type(screen.getByLabelText('스캔'), 'ABC');
    await user.click(screen.getByRole('button', { name: '찾기' }));
    onScan.mockClear();

    await user.type(screen.getByLabelText('스캔'), 'XYZ');

    await waitFor(() => {
      expect(onScan).toHaveBeenCalledWith('XYZ');
    });
  });

  /* 실물을 읽은 값이 이긴다. 손으로 치던 것이 남으면 두 값이 한 칸에서 섞인다. */
  it('직접 입력 중에 스캔이 오면 손 입력을 접는다', async () => {
    const user = userEvent.setup();
    const onScan = vi.fn();
    render(<Probe onScan={onScan} />);

    await user.click(screen.getByRole('button', { name: '직접 입력' }));
    expect(screen.getByText('손 입력 중')).toBeTruthy();

    await user.type(screen.getByLabelText('스캔'), 'SYN-LOT-0011{Enter}');

    expect(onScan).toHaveBeenCalledWith('SYN-LOT-0011');
    expect(screen.getByText('스캔 대기')).toBeTruthy();
    expect(screen.getByLabelText('스캔')).toHaveAttribute('inputmode', 'none');
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

  it('포커스가 아무 데도 가지 않고 빠지면 되돌린다', async () => {
    render(<Probe onScan={vi.fn()} />);

    screen.getByLabelText('스캔').blur();

    await vi.waitFor(() => {
      expect(screen.getByLabelText('스캔')).toHaveFocus();
    });
  });

  it('다른 컨트롤로 옮겨 간 포커스는 뺏지 않는다', async () => {
    const user = userEvent.setup();
    render(<Probe onScan={vi.fn()} />);

    const elsewhere = screen.getByRole('button', { name: '다른 곳' });
    await user.click(elsewhere);

    expect(elsewhere).toHaveFocus();
  });

  it('Tab 으로 다음 컨트롤에 닿는다', async () => {
    const user = userEvent.setup();
    render(<Probe onScan={vi.fn()} />);

    await user.tab();

    expect(screen.getByRole('button', { name: '다른 곳' })).toHaveFocus();
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
