import { messages } from '@omf-mes/i18n';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const native = vi.hoisted(() => ({
  isNative: true,
  check: vi.fn(),
  request: vi.fn(),
}));

vi.mock('@capacitor/core', () => ({
  Capacitor: { isNativePlatform: () => native.isNative },
  registerPlugin: () => ({
    checkPermissions: () => native.check(),
    requestPermissions: () => native.request(),
  }),
}));

const {
  createCapacitorLocalNetworkAccess,
  LocalNetworkNotice,
  LocalNetworkProvider,
  useLocalNetwork,
} = await import('./local-network');

const t = messages.deviceRegistration;

beforeEach(() => {
  native.isNative = true;
  native.check.mockReset();
  native.request.mockReset();
});

describe('로컬 네트워크 권한 어댑터', () => {
  it('브라우저에서는 묻지 않고 허용으로 답한다', async () => {
    native.isNative = false;

    await expect(createCapacitorLocalNetworkAccess().request()).resolves.toBe('granted');
    expect(native.check).not.toHaveBeenCalled();
    expect(native.request).not.toHaveBeenCalled();
  });

  it('이미 허용됐으면 다시 묻지 않는다', async () => {
    native.check.mockResolvedValue({ localNetwork: 'granted' });

    await expect(createCapacitorLocalNetworkAccess().request()).resolves.toBe('granted');
    expect(native.request).not.toHaveBeenCalled();
  });

  it('허용되지 않았으면 묻고 그 답을 준다', async () => {
    native.check.mockResolvedValue({ localNetwork: 'prompt' });
    native.request.mockResolvedValue({ localNetwork: 'granted' });

    await expect(createCapacitorLocalNetworkAccess().request()).resolves.toBe('granted');
    expect(native.request).toHaveBeenCalledTimes(1);
  });

  it.each(['denied', 'prompt-with-rationale', 'prompt'])('%s 로 돌아오면 거절이다', async (answer) => {
    native.check.mockResolvedValue({ localNetwork: 'prompt' });
    native.request.mockResolvedValue({ localNetwork: answer });

    await expect(createCapacitorLocalNetworkAccess().request()).resolves.toBe('denied');
  });
});

const Probe = () => {
  const { status, settled, request } = useLocalNetwork();

  return (
    <>
      <p>{`상태 ${status} ${settled ? '답함' : '기다림'}`}</p>
      <button type="button" onClick={request}>
        묻기
      </button>
      <LocalNetworkNotice />
    </>
  );
};

describe('로컬 네트워크 권한 안내', () => {
  it('공급자 없이 세운 화면에는 경고가 뜨지 않는다', () => {
    render(<Probe />);

    expect(screen.getByText('상태 granted 답함')).toBeInTheDocument();
    expect(screen.queryByText(t.localNetwork.denied)).not.toBeInTheDocument();
  });

  it('거절되면 곧바로 알리고, 다시 시도하면 다시 묻는다', async () => {
    const request = vi
      .fn<() => Promise<'granted' | 'denied'>>()
      .mockResolvedValueOnce('denied')
      .mockResolvedValueOnce('granted');

    render(
      <LocalNetworkProvider access={{ request }}>
        <Probe />
      </LocalNetworkProvider>,
    );
    expect(screen.getByText('상태 unknown 기다림')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: '묻기' }));

    expect(await screen.findByText(t.localNetwork.denied)).toBeInTheDocument();
    expect(screen.getByText(t.localNetwork.grant)).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: t.retry }));

    expect(await screen.findByText('상태 granted 답함')).toBeInTheDocument();
    expect(screen.queryByText(t.localNetwork.denied)).not.toBeInTheDocument();
    expect(request).toHaveBeenCalledTimes(2);
  });

  it('묻는 중에 또 눌러도 한 번만 묻는다', async () => {
    let answer: (value: 'granted' | 'denied') => void = () => undefined;
    const request = vi.fn(
      () =>
        new Promise<'granted' | 'denied'>((resolve) => {
          answer = resolve;
        }),
    );

    render(
      <LocalNetworkProvider access={{ request }}>
        <Probe />
      </LocalNetworkProvider>,
    );

    await userEvent.click(screen.getByRole('button', { name: '묻기' }));
    await userEvent.click(screen.getByRole('button', { name: '묻기' }));
    expect(screen.getByText('상태 requesting 기다림')).toBeInTheDocument();
    expect(request).toHaveBeenCalledTimes(1);

    act(() => {
      answer('granted');
    });
    expect(await screen.findByText('상태 granted 답함')).toBeInTheDocument();
  });

  it('묻다가 실패하면 거절로 둔다', async () => {
    const request = vi.fn(() => Promise.reject(new Error('플러그인 없음')));

    render(
      <LocalNetworkProvider access={{ request }}>
        <Probe />
      </LocalNetworkProvider>,
    );
    await userEvent.click(screen.getByRole('button', { name: '묻기' }));

    expect(await screen.findByText(t.localNetwork.denied)).toBeInTheDocument();
  });
});
