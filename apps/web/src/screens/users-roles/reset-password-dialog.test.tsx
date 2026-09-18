import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ResetPasswordDialog, TemporaryPasswordDialog } from './reset-password-dialog';

const clipboardDescriptor = Object.getOwnPropertyDescriptor(navigator, 'clipboard');

afterEach(() => {
  if (clipboardDescriptor === undefined) {
    Reflect.deleteProperty(navigator, 'clipboard');
  } else {
    Object.defineProperty(navigator, 'clipboard', clipboardDescriptor);
  }
});

// 합성 값이다 — 실제 계정에 쓰이는 값이 아니다.
const issued = { loginId: 'SYN-LOGIN-01', temporaryPassword: 'SynTmp9x2k' };

describe('ResetPasswordDialog', () => {
  it('초기화를 누르면 상위에 알리고, 취소는 닫기만 한다', () => {
    const onConfirm = vi.fn();
    const onClose = vi.fn();
    render(
      <ResetPasswordDialog
        open
        onClose={onClose}
        onConfirm={onConfirm}
        isSaving={false}
        banner={null}
      />,
    );

    expect(screen.getByText('비밀번호를 초기화할까요?')).toBeInTheDocument();
    expect(screen.getByText('초기화 시 새 임시 비밀번호가 1번만 표시됩니다.')).toBeInTheDocument();
    // 사용자 지시(2026-09-18) — 오른쪽 위 X 없이 「취소」로 닫는다.
    expect(screen.queryByRole('button', { name: '닫기' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '초기화' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: '취소' }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('보내는 중에는 초기화를 다시 누를 수 없다', () => {
    render(
      <ResetPasswordDialog open onClose={vi.fn()} onConfirm={vi.fn()} isSaving banner={null} />,
    );

    expect(screen.getByRole('button', { name: '초기화' })).toBeDisabled();
  });
});

describe('TemporaryPasswordDialog', () => {
  it('값이 없으면 아무것도 보이지 않는다', () => {
    render(<TemporaryPasswordDialog issued={null} onClose={vi.fn()} />);

    expect(screen.queryByText('임시 비밀번호')).toBeNull();
  });

  /** 관리자가 읽어 전달해야 하는 값이라 화면에 적는다 — 누구의 값인지도 함께. */
  it('받은 임시 비밀번호와 그 로그인 ID를 보여 준다', () => {
    render(<TemporaryPasswordDialog issued={issued} onClose={vi.fn()} />);

    expect(screen.getByText('SynTmp9x2k')).toBeInTheDocument();
    expect(screen.getByText('SYN-LOGIN-01')).toBeInTheDocument();
    expect(
      screen.getByText(
        '비밀번호는 이번에만 확인할 수 있습니다. 창을 닫기 전에 사용자에게 전달해 주세요.',
      ),
    ).toBeInTheDocument();
  });

  /** 사용자 지시(2026-09-18) — 라벨과 값을 한 줄씩 짝지어 보인다. */
  it('라벨과 값이 한 줄씩 짝을 이룬다', () => {
    render(<TemporaryPasswordDialog issued={issued} onClose={vi.fn()} />);

    const terms = screen.getAllByRole('term').map((term) => term.textContent);
    const values = screen.getAllByRole('definition').map((value) => value.textContent);

    expect(terms).toEqual(['로그인 ID', '임시 비밀번호']);
    expect(values).toEqual(['SYN-LOGIN-01', 'SynTmp9x2k']);
  });

  it('복사를 누르면 임시 비밀번호만 클립보드에 넣는다', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
    render(<TemporaryPasswordDialog issued={issued} onClose={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: '임시 비밀번호 복사' }));

    expect(await screen.findByText('임시 비밀번호를 복사했습니다.')).toBeInTheDocument();
    expect(writeText).toHaveBeenCalledExactlyOnceWith('SynTmp9x2k');
  });

  it('클립보드가 거부하면 실패를 알린다', async () => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: vi.fn().mockRejectedValue(new Error('denied')) },
    });
    render(<TemporaryPasswordDialog issued={issued} onClose={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: '임시 비밀번호 복사' }));

    expect(
      await screen.findByText('복사하지 못했습니다. 브라우저의 클립보드 권한을 확인하세요.'),
    ).toBeInTheDocument();
  });

  it('닫기를 누르면 상위에 알린다', () => {
    const onClose = vi.fn();
    render(<TemporaryPasswordDialog issued={issued} onClose={onClose} />);

    // 사용자 지시(2026-09-18) — 오른쪽 위 X 가 없어 「닫기」는 바닥 버튼 하나뿐이다.
    expect(screen.getAllByRole('button', { name: '닫기' })).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: '닫기' }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
