import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { messages } from '@omf-mes/i18n';

import { TokenDialog } from './token-dialog';

const t = messages.terminalProcessMap;
const clipboardDescriptor = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
const secureContextDescriptor = Object.getOwnPropertyDescriptor(window, 'isSecureContext');

afterEach(() => {
  if (clipboardDescriptor === undefined) {
    Reflect.deleteProperty(navigator, 'clipboard');
  } else {
    Object.defineProperty(navigator, 'clipboard', clipboardDescriptor);
  }
  if (secureContextDescriptor === undefined) {
    Reflect.deleteProperty(window, 'isSecureContext');
  } else {
    Object.defineProperty(window, 'isSecureContext', secureContextDescriptor);
  }
});

const renderDialog = () =>
  render(
    <TokenDialog
      token={{
        token: 'header.payload.signature',
        issuedAt: '2026-09-14T09:00:00Z',
        expiresAt: null,
      }}
      terminalCode="FR007-MOBILE"
      onClose={vi.fn()}
    />,
  );

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

  it('클립보드가 권한을 거부하면 성공 안내 대신 권한 확인을 알린다', async () => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: vi.fn().mockRejectedValue(new DOMException('denied', 'NotAllowedError')),
      },
    });
    renderDialog();

    fireEvent.click(screen.getByRole('button', { name: '등록 코드 복사' }));
    expect(
      await screen.findByText('복사하지 못했습니다. 브라우저의 클립보드 권한을 확인하세요.'),
    ).toBeInTheDocument();
    expect(screen.queryByText('등록 코드를 복사했습니다.')).toBeNull();
    expect(screen.queryByText(t.token.copyUnavailable)).toBeNull();
  });

  /* 평문 HTTP 주소 — 브라우저가 클립보드를 아예 내주지 않는다. 권한 문제가 아니므로 QR 로 안내한다. */
  it('보안 연결이 아닌 주소에서는 권한 안내 대신 QR 로 전달하라고 알린다', async () => {
    Object.defineProperty(window, 'isSecureContext', { configurable: true, value: false });
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: undefined });
    const { container } = renderDialog();

    fireEvent.click(screen.getByRole('button', { name: '등록 코드 복사' }));
    expect(await screen.findByText(t.token.copyUnavailable)).toBeInTheDocument();
    expect(screen.queryByText(t.token.copyFailed)).toBeNull();
    expect(screen.queryByText(t.token.copied)).toBeNull();
    /* 우회 복사로 원문을 그리지 않는다. */
    expect(container.textContent).not.toContain('header.payload.signature');
    expect(document.body.querySelector('textarea')).toBeNull();
  });

  it('권한 거부가 아닌 실패는 다시 시도하거나 QR 로 전달하라고 알린다', async () => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: vi.fn().mockRejectedValue(new Error('synthetic failure')) },
    });
    renderDialog();

    fireEvent.click(screen.getByRole('button', { name: '등록 코드 복사' }));
    expect(await screen.findByText(t.token.copyError)).toBeInTheDocument();
    expect(screen.queryByText(t.token.copyFailed)).toBeNull();
  });
});
