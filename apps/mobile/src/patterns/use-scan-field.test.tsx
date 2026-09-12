import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import type { ScannerAdapter } from './scanner';
import { useScanField } from './use-scan-field';

const Probe = ({
  onScan,
  scanner,
  applied,
}: {
  onScan: (v: string) => void;
  scanner?: ScannerAdapter;
  applied?: string | null;
}) => {
  const field = useScanField({ onScan, scanner, applied });
  return (
    <>
      <input aria-label="스캔" ref={field.ref} />
      <button type="button">다른 곳</button>
      <input aria-label="수량" />
      <button type="button" onClick={field.openManual}>
        직접 입력
      </button>
      <button type="button" onClick={field.submitManual}>
        찾기
      </button>
      <p>{field.manual ? '손 입력 중' : '스캔 대기'}</p>
      {field.pending === null ? null : (
        <>
          <p>{`되물음 ${field.pending}`}</p>
          <button type="button" onClick={field.acceptPending}>
            바꾸기
          </button>
          <button type="button" onClick={field.dismissPending}>
            그대로
          </button>
        </>
      )}
    </>
  );
};

/** 화면 잠금처럼 문서를 가렸다 보였다 한다. */
const hide = (hidden: boolean) => {
  Object.defineProperty(document, 'hidden', { configurable: true, value: hidden });
  Object.defineProperty(document, 'visibilityState', {
    configurable: true,
    value: hidden ? 'hidden' : 'visible',
  });
  document.dispatchEvent(new Event('visibilitychange'));
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
  /**
   * 화면 잠금은 웹뷰를 가린다. 그동안 칸은 포커스를 잃는데, 그때 되돌리면 보이지도 않는
   * 화면에 소프트 키보드가 서므로 되돌리지 않는다 - 그것은 맞다.
   *
   * 문제는 다시 보이게 된 뒤다. 되찾는 자리가 없으면 스캐너가 밀어 넣는 입력이 갈 곳을
   * 잃는다. 현장에서는 잠금을 풀면 스캔이 되지 않는 것으로 나타났고, 화면을 늘 켜 두면
   * 증상이 사라졌다.
   */
  it('잠금에서 돌아오면 스캔 칸이 포커스를 되찾는다', async () => {
    render(<Probe onScan={vi.fn()} />);
    const field = screen.getByLabelText('스캔');
    expect(field).toHaveFocus();

    /* 잠긴다 - 가려진 채로 포커스가 빠진다. */
    hide(true);
    field.blur();
    expect(field).not.toHaveFocus();

    /* 풀린다. */
    hide(false);

    await waitFor(() => {
      expect(field).toHaveFocus();
    });
  });

  it('가려져 있는 동안에는 포커스를 되돌리지 않는다', async () => {
    render(<Probe onScan={vi.fn()} />);
    const field = screen.getByLabelText('스캔');

    hide(true);
    field.blur();

    await new Promise((resolve) => {
      setTimeout(resolve, 20);
    });

    expect(field).not.toHaveFocus();
    hide(false);
  });

  /**
   * 단추를 한 번 누르면 포커스가 그리로 간다. handleBlur 는 다른 컨트롤로 옮겨 간 포커스를
   * 뺏지 않으므로 칸은 비어 있는 채로 남고, 그 상태에서 스캔하면 글자가 단추로 가 사라진다.
   * 화면에는 아무 일도 일어나지 않아 작업자는 스캐너가 고장 난 것으로 읽는다.
   */
  it('포커스가 단추에 있어도 스캔이 닿는다', async () => {
    const user = userEvent.setup();
    const onScan = vi.fn();
    render(<Probe onScan={onScan} />);

    await user.click(screen.getByRole('button', { name: '다른 곳' }));
    expect(screen.getByRole('button', { name: '다른 곳' })).toHaveFocus();

    await user.keyboard('SYN-LOT-0042{Enter}');

    expect(onScan).toHaveBeenCalledWith('SYN-LOT-0042');
  });

  it('다른 칸에 치는 글자는 가져오지 않는다', async () => {
    const user = userEvent.setup();
    const onScan = vi.fn();
    render(<Probe onScan={onScan} />);

    const other = screen.getByLabelText('수량');
    await user.click(other);
    await user.keyboard('120');

    expect(other).toHaveValue('120');
    expect(onScan).not.toHaveBeenCalled();
    expect(screen.getByLabelText('스캔')).toHaveValue('');
  });

  it('이미 적용된 값이 있으면 바로 바꾸지 않고 되묻는다', async () => {
    const user = userEvent.setup();
    const onScan = vi.fn();
    render(<Probe onScan={onScan} applied="SYN-LOT-0001" />);

    await user.type(screen.getByLabelText('스캔'), 'SYN-LOT-0002{Enter}');

    expect(onScan).not.toHaveBeenCalled();
    expect(screen.getByText('되물음 SYN-LOT-0002')).toBeTruthy();
  });

  it('되물은 값을 받으면 그때 넘긴다', async () => {
    const user = userEvent.setup();
    const onScan = vi.fn();
    render(<Probe onScan={onScan} applied="SYN-LOT-0001" />);

    await user.type(screen.getByLabelText('스캔'), 'SYN-LOT-0002{Enter}');
    await user.click(screen.getByRole('button', { name: '바꾸기' }));

    expect(onScan).toHaveBeenCalledWith('SYN-LOT-0002');
    expect(screen.queryByText(/되물음/)).toBeNull();
  });

  it('되물은 값을 물리면 앞엣것이 남는다', async () => {
    const user = userEvent.setup();
    const onScan = vi.fn();
    render(<Probe onScan={onScan} applied="SYN-LOT-0001" />);

    await user.type(screen.getByLabelText('스캔'), 'SYN-LOT-0002{Enter}');
    await user.click(screen.getByRole('button', { name: '그대로' }));

    expect(onScan).not.toHaveBeenCalled();
    expect(screen.queryByText(/되물음/)).toBeNull();
  });

  /** 같은 것을 다시 댄 것은 바꾸는 것이 아니다. 물어볼 것이 없다. */
  it('같은 값을 다시 읽으면 묻지 않는다', async () => {
    const user = userEvent.setup();
    const onScan = vi.fn();
    render(<Probe onScan={onScan} applied="SYN-LOT-0001" />);

    await user.type(screen.getByLabelText('스캔'), 'SYN-LOT-0001{Enter}');

    expect(onScan).toHaveBeenCalledWith('SYN-LOT-0001');
    expect(screen.queryByText(/되물음/)).toBeNull();
  });

  /** 적용된 것이 없으면 종전대로 바로 간다. 여러 건을 쌓는 화면이 그 자리다. */
  it('적용된 값이 없으면 바로 넘긴다', async () => {
    const user = userEvent.setup();
    const onScan = vi.fn();
    render(<Probe onScan={onScan} />);

    await user.type(screen.getByLabelText('스캔'), 'SYN-LOT-0003{Enter}');

    expect(onScan).toHaveBeenCalledWith('SYN-LOT-0003');
  });

});
