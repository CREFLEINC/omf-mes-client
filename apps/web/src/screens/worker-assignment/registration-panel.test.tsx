import { messages } from '@omf-mes/i18n';
import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { RegistrationPanel } from './registration-panel';
import {
  PopRegistrationProvider,
  usePopRegistration,
  type PopRegistration,
} from '../../patterns/pop-registration';
import { forgetTerminalToken } from '../../patterns/pop-terminal-token';
import { createStubFetch, jsonResponse, renderWithProviders } from '../../test/api-harness';

const t = messages.workerAssignment.registration;

/**
 * ⛔⛔ **입력란이 빈 화면에서 「이 토큰은」이라고 말하지 않는다**(#1137).
 *
 * 켤 때 보관된 토큰을 스스로 확인하는 갈래가 있어(`app/pop-main` 의 `PopRegistrationGate`),
 * 그 실패가 등록 화면에 그대로 떴다 — 설치 담당자는 한 글자도 넣지 않았는데 자기가 넣은 값이
 * 거절당한 줄 알았다(실측 2026-09-12 · 사용자 지적 · 실서버 설치본).
 *
 * ⚠ **문구 «내용»이 아니라 어느 표에서 고르는가를 잰다.** 문구는 바뀔 수 있고, 바뀌어도
 *   「보관된 것과 넣은 것을 가른다」는 성질은 남아야 한다.
 */

/** `sub` 만 담은 토큰. 서명은 검증되지 않으므로 자리만 채운다. */
const tokenFor = (sub: number): string =>
  `header.${btoa(JSON.stringify({ sub, kind: 'terminal' })).replace(/=+$/, '')}.signature`;

/** 어떤 단말을 물어도 401 — 이 시험이 재는 것은 «거절 뒤의 말»이다. */
const rejectingFetch = createStubFetch([
  {
    match: (request) => /\/mdm\/terminals\//.test(request.url),
    respond: () => jsonResponse({ message: '없다' }, { status: 401 }),
  },
]);

const openPanel = (): { current: PopRegistration } => {
  const box = { current: null as PopRegistration | null };

  const Probe = () => {
    box.current = usePopRegistration();

    return null;
  };

  renderWithProviders(
    <PopRegistrationProvider>
      <Probe />
      <RegistrationPanel />
    </PopRegistrationProvider>,
    { fetch: rejectingFetch, session: null },
  );

  return box as { current: PopRegistration };
};

afterEach(() => {
  vi.restoreAllMocks();
  delete (globalThis as { pop?: unknown }).pop;
  forgetTerminalToken();
});

describe('RegistrationPanel — 판정이 누구 이야기인가', () => {
  it('보관돼 있던 토큰이 걸러지면 그 사실을 밝히고, 넣은 값을 탓하지 않는다', async () => {
    const registration = openPanel();

    await act(async () => {
      await registration.current.verify(tokenFor(2002), 'stored');
    });

    await waitFor(() => {
      expect(screen.getByText(t.storedFailure.rejected)).toBeInTheDocument();
    });
    expect(screen.queryByText(t.failure.rejected)).toBeNull();
  });

  it('사람이 붙여넣은 값이 거절당하면 그 값의 말을 한다', async () => {
    const registration = openPanel();

    await act(async () => {
      await registration.current.verify(tokenFor(2002));
    });

    await waitFor(() => {
      expect(screen.getByText(t.failure.rejected)).toBeInTheDocument();
    });
    expect(screen.queryByText(t.storedFailure.rejected)).toBeNull();
  });

  /**
   * ⚠ **닿지 못한 갈래는 가르지 않는다.** 판정이 아니라 못 물어본 것이라 두 경우에 할 일이
   *   같다 — 연결을 확인하고 다시 시도하는 것 하나뿐이다.
   */
  it('서버에 닿지 못한 것은 보관이든 입력이든 같은 말로 남는다', async () => {
    const box = { current: null as PopRegistration | null };
    const Probe = () => {
      box.current = usePopRegistration();

      return null;
    };

    renderWithProviders(
      <PopRegistrationProvider>
        <Probe />
        <RegistrationPanel />
      </PopRegistrationProvider>,
      { fetch: () => Promise.reject(new TypeError('Failed to fetch')), session: null },
    );

    const registration = box as { current: PopRegistration };

    await act(async () => {
      await registration.current.verify(tokenFor(2002), 'stored');
    });

    await waitFor(() => {
      expect(screen.getByText(t.failure.unreachable)).toBeInTheDocument();
    });
  });
});

/**
 * 연결 끊김 안내에는 다시 시도할 입구가 있어야 한다(#1330). 버튼이 없으면 작업자는 연결이
 * 돌아왔는지 알 수 없고, 입력란이 빈 보관 토큰 갈래에서는 다시 시도할 방법 자체가 없다.
 */
describe('RegistrationPanel — 네트워크 재연결', () => {
  const setOnline = (value: boolean) => vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(value);

  it('연결 끊김 안내가 뜨면 버튼이 보이고, 다른 실패에는 보이지 않는다', async () => {
    const online = setOnline(false);
    const registration = openPanel();

    expect(screen.queryByRole('button', { name: t.reconnect })).toBeNull();

    await act(async () => {
      await registration.current.verify(tokenFor(2002));
    });

    expect(screen.getByText(t.failure.offline)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: t.reconnect })).toBeEnabled();

    online.mockReturnValue(true);

    await act(async () => {
      await registration.current.verify(tokenFor(2002));
    });

    await waitFor(() => {
      expect(screen.getByText(t.failure.rejected)).toBeInTheDocument();
    });
    expect(screen.queryByRole('button', { name: t.reconnect })).toBeNull();
  });

  it('연결이 돌아온 뒤 누르면 같은 보관 토큰으로 다시 확인한다', async () => {
    const online = setOnline(false);
    const registration = openPanel();

    await act(async () => {
      await registration.current.verify(tokenFor(2002), 'stored');
    });
    expect(screen.getByText(t.failure.offline)).toBeInTheDocument();

    online.mockReturnValue(true);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: t.reconnect }));
    });

    /* 보관 토큰을 다시 물었다는 증거 — 거절 문구가 «보관» 표에서 나온다. */
    await waitFor(() => {
      expect(screen.getByText(t.storedFailure.rejected)).toBeInTheDocument();
    });
  });

  it('여전히 끊겨 있으면 같은 안내가 남는다', async () => {
    setOnline(false);
    const registration = openPanel();

    await act(async () => {
      await registration.current.verify(tokenFor(2002));
    });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: t.reconnect }));
    });

    expect(screen.getByText(t.failure.offline)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: t.reconnect })).toBeEnabled();
  });
});
