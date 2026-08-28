import { act, render, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { DeviceRegistrationProvider, useDeviceRegistration } from './device-registration';

const keystore = vi.hoisted(() => ({
  token: null as string | null,
  readFails: false,
}));

vi.mock('./device-token', () => ({
  readDeviceToken: () =>
    keystore.readFails
      ? Promise.reject(new Error('잠금 저장소 오류'))
      : Promise.resolve(keystore.token),
  writeDeviceToken: (value: string) => {
    keystore.token = value;
    return Promise.resolve();
  },
  clearDeviceToken: () => {
    keystore.token = null;
    return Promise.resolve();
  },
  currentDeviceToken: () => keystore.token,
}));

afterEach(() => {
  keystore.token = null;
  keystore.readFails = false;
});

const wrapper = ({ children }: { children: ReactNode }) => (
  <DeviceRegistrationProvider>{children}</DeviceRegistrationProvider>
);

const mount = () => renderHook(() => useDeviceRegistration(), { wrapper });

describe('단말 등록 상태', () => {
  it('토큰이 없으면 미등록이다', async () => {
    const { result } = mount();

    await waitFor(() => {
      expect(result.current.status).toBe('unregistered');
    });
  });

  it('토큰이 있으면 등록됨이다', async () => {
    keystore.token = 'tok-1';

    const { result } = mount();

    await waitFor(() => {
      expect(result.current.status).toBe('registered');
    });
  });

  it('읽기 전에는 판정하지 않는다', () => {
    const { result } = mount();

    expect(result.current.status).toBe('loading');
  });

  it('보관소를 읽지 못하면 미등록으로 둔다', async () => {
    keystore.readFails = true;

    const { result } = mount();

    await waitFor(() => {
      expect(result.current.status).toBe('unregistered');
    });
  });

  it('등록하면 토큰을 보관하고 등록됨이 된다', async () => {
    const { result } = mount();
    await waitFor(() => {
      expect(result.current.status).toBe('unregistered');
    });

    await act(async () => {
      await result.current.register('tok-2');
    });

    expect(result.current.status).toBe('registered');
    expect(keystore.token).toBe('tok-2');
  });

  it('등록을 풀면 토큰이 사라진다', async () => {
    keystore.token = 'tok-1';
    const { result } = mount();
    await waitFor(() => {
      expect(result.current.status).toBe('registered');
    });

    await act(async () => {
      await result.current.unregister();
    });

    expect(result.current.status).toBe('unregistered');
    expect(keystore.token).toBeNull();
  });

  it('프로바이더 밖에서는 쓸 수 없다', () => {
    const Probe = () => {
      useDeviceRegistration();
      return null;
    };

    expect(() => {
      render(<Probe />);
    }).toThrow(/DeviceRegistrationProvider/);
  });
});
