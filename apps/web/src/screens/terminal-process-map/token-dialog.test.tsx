import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { TokenDialog } from './token-dialog';

const clipboardDescriptor = Object.getOwnPropertyDescriptor(navigator, 'clipboard');

afterEach(() => {
  if (clipboardDescriptor === undefined) {
    Reflect.deleteProperty(navigator, 'clipboard');
  } else {
    Object.defineProperty(navigator, 'clipboard', clipboardDescriptor);
  }
});

describe('단말 등록 코드 전달', () => {
  it('표준 클립보드에 발급된 실제 토큰만 복사하고 화면에는 원문을 쓰지 않는다', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });
    const token = 'header.payload.signature';
    const { container } = render(
      <TokenDialog
        token={{ token, issuedAt: '2026-09-14T09:00:00Z', expiresAt: null }}
        terminalCode="FR007-MOBILE"
        onClose={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: '등록 코드 복사' }));
    expect(await screen.findByText('등록 코드를 복사했습니다.')).toBeInTheDocument();
    expect(writeText).toHaveBeenCalledExactlyOnceWith(token);
    expect(container.textContent).not.toContain(token);
  });

  it('클립보드가 거부하면 성공 안내 대신 실패를 알린다', async () => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: vi.fn().mockRejectedValue(new Error('denied')) },
    });
    render(
      <TokenDialog
        token={{ token: 'header.payload.signature', issuedAt: '2026-09-14T09:00:00Z', expiresAt: null }}
        terminalCode="FR007-MOBILE"
        onClose={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: '등록 코드 복사' }));
    expect(await screen.findByText('복사하지 못했습니다. 브라우저의 클립보드 권한을 확인하세요.')).toBeInTheDocument();
    expect(screen.queryByText('등록 코드를 복사했습니다.')).toBeNull();
  });
});
