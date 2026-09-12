import { act, render, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { DeviceRegistrationProvider, useDeviceRegistration } from './device-registration';
import { currentPlantId, forgetPlant, rememberPlant } from './plant';

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

/*
 * ⭐ **공장은 토큰에 없다**(#1103). 등록할 때 남기고, 기동할 때 되살리고, 등록이 풀리면 함께
 * 잊어야 한다 — 셋 중 하나라도 빠지면 공장을 알아야 하는 쓰기 화면이 조용히 막히거나,
 * 더 나쁘게는 «옛 공장»으로 쓴다. 여기가 그 수명주기를 지키는 자리다.
 */
const store = vi.hoisted(() => new Map<string, string>());

vi.mock('./local-store', () => ({
  readLocal: (key: string) => Promise.resolve(store.get(key) ?? null),
  writeLocal: (key: string, value: string) => {
    store.set(key, value);
    return Promise.resolve();
  },
  removeLocal: (key: string) => {
    store.delete(key);
    return Promise.resolve();
  },
}));

afterEach(async () => {
  keystore.token = null;
  keystore.readFails = false;
  store.clear();
  await forgetPlant();
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

  it('토큰을 보관하고 확인까지 끝나야 등록됨이 된다', async () => {
    const { result } = mount();
    await waitFor(() => {
      expect(result.current.status).toBe('unregistered');
    });

    let seen: string | null = null;

    await act(async () => {
      await result.current.register('tok-2', () => {
        // 확인은 그 토큰으로 서버를 부른다. 부를 때 이미 보관돼 있어야 요청에 실린다.
        seen = keystore.token;
        return Promise.resolve();
      });
    });

    expect(seen).toBe('tok-2');
    expect(result.current.status).toBe('registered');
    expect(keystore.token).toBe('tok-2');
  });

  it('서버가 받지 않은 토큰은 남기지 않는다', async () => {
    const { result } = mount();
    await waitFor(() => {
      expect(result.current.status).toBe('unregistered');
    });

    await act(async () => {
      await expect(
        result.current.register('tok-3', () => Promise.reject(new Error('거절'))),
      ).rejects.toThrow('거절');
    });

    expect(result.current.status).toBe('unregistered');
    expect(keystore.token).toBeNull();
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

  /* 기동 때 되살리지 않으면 앱을 다시 켤 때마다 공장이 빈다 — 쓰기 화면이 그때부터 막힌다. */
  it('기동할 때 남겨 둔 공장을 되살린다', async () => {
    keystore.token = 'tok-1';
    store.set('plant-id', '7');

    const { result } = mount();

    await waitFor(() => {
      expect(result.current.status).toBe('registered');
    });
    expect(currentPlantId()).toBe(7);
  });

  /* 등록됨이 되기 전에 서 있어야 한다. 늦으면 첫 쓰기가 「공장을 모른다」로 막힌다. */
  it('공장을 되살리기 전에는 등록됨이라 하지 않는다', async () => {
    keystore.token = 'tok-1';
    store.set('plant-id', '7');

    const { result } = mount();

    await waitFor(() => {
      expect(result.current.status).toBe('registered');
    });
    /* 등록됨이 된 시점에 이미 서 있다 — 이 순서가 뒤집히면 위 단언이 먼저 깨진다. */
    expect(currentPlantId()).not.toBeNull();
  });

  it('등록을 풀면 공장도 잊는다 — 남기면 다음 등록까지 옛 공장으로 쓴다', async () => {
    keystore.token = 'tok-1';
    await rememberPlant(7);
    const { result } = mount();
    await waitFor(() => {
      expect(result.current.status).toBe('registered');
    });

    await act(async () => {
      await result.current.unregister();
    });

    expect(currentPlantId()).toBeNull();
  });

  it('서버가 받지 않으면 공장도 남기지 않는다', async () => {
    const { result } = mount();
    await waitFor(() => {
      expect(result.current.status).toBe('unregistered');
    });

    await act(async () => {
      await expect(
        result.current.register('tok-3', async () => {
          // 확인 도중 공장을 남겼더라도 거절되면 되돌아가야 한다.
          await rememberPlant(9);
          throw new Error('거절');
        }),
      ).rejects.toThrow('거절');
    });

    expect(currentPlantId()).toBeNull();
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
