import { screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createStubFetch, jsonResponse, renderWithProviders } from '../../test/api-harness';
import type { QrCamera } from '../../patterns/qr-camera';
import { DeviceRegistrationScreen } from './screen';

const keystore = vi.hoisted(() => ({ token: null as string | null }));
const store = vi.hoisted(() => new Map<string, string>());

vi.mock('../../patterns/device-token', () => ({
  readDeviceToken: () => Promise.resolve(keystore.token),
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

vi.mock('../../patterns/local-store', () => ({
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

const tokenWith = (payload: unknown): string => {
  const body = btoa(JSON.stringify(payload)).replaceAll('+', '-').replaceAll('/', '_');
  return `header.${body}.signature`;
};

const REGISTRATION_TOKEN = tokenWith({ terminalCode: 'SYN-TERM-01', plantId: 7 });

interface StubCamera extends QrCamera {
  read: (value: string) => void;
  closed: () => number;
}

const stubCamera = (
  overrides: Partial<Pick<QrCamera, 'isSupported' | 'requestPermission'>> = {},
): StubCamera => {
  let onRead: ((value: string) => void) | null = null;
  let closes = 0;

  return {
    isSupported: overrides.isSupported ?? (() => Promise.resolve(true)),
    requestPermission: overrides.requestPermission ?? (() => Promise.resolve('granted' as const)),
    open: (listener) => {
      onRead = listener;
      return Promise.resolve(() => {
        closes += 1;
        return Promise.resolve();
      });
    },
    read: (value) => onRead?.(value),
    closed: () => closes,
  };
};

const workersRoute = (items: { workerNo: string; workerName: string }[], seen: URL[] = []) => ({
  match: (request: Request) => new URL(request.url).pathname === '/mdm/workers',
  respond: (request: Request) => {
    seen.push(new URL(request.url));
    return jsonResponse({ items, page: { page: 0, size: 100, total: items.length } });
  },
});

const worker = { workerNo: 'SYN-W-0001', workerName: '작업자 1' };

beforeEach(() => {
  keystore.token = null;
  store.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('기기 등록 화면', () => {
  it('등록되지 않았음을 먼저 말한다', () => {
    renderWithProviders(<DeviceRegistrationScreen camera={stubCamera()} />, {
      fetch: createStubFetch([]),
    });

    expect(screen.getByRole('heading', { name: '이 기기는 아직 등록되지 않았습니다' }));
    expect(screen.getByText(/관리웹/)).toBeInTheDocument();
  });

  it('카메라가 열리면 어디를 비추라고 안내한다', async () => {
    renderWithProviders(<DeviceRegistrationScreen camera={stubCamera()} />, {
      fetch: createStubFetch([]),
    });

    expect(await screen.findByText('관리자 화면의 등록 QR을 비추세요.')).toBeInTheDocument();
  });

  it('읽은 QR이 가리키는 단말을 보인다', async () => {
    const camera = stubCamera();
    renderWithProviders(<DeviceRegistrationScreen camera={camera} />, {
      fetch: createStubFetch([workersRoute([worker])]),
    });

    await waitFor(() => {
      expect(camera.closed()).toBe(0);
    });
    camera.read(REGISTRATION_TOKEN);

    /* 받는 중에는 등록 표시가 그 자리를 대신한다. 같은 코드를 두 번 보이지 않는다. */
    await screen.findByText('등록되었습니다');
    expect(screen.getAllByText(/SYN-TERM-01/)).toHaveLength(1);
  });

  /*
   * 미등록 단말에는 대조할 기대값이 없어 틀린 QR 을 기계가 잡을 수 없다. 잡을 수 있는 것은
   * 사람뿐이고, 사람이 잡으려면 무엇으로 등록됐는지와 무엇과 맞춰 보라는 말이 함께 있어야 한다.
   */
  it('무엇으로 등록됐는지와 확인하라는 말을 함께 보인다', async () => {
    const camera = stubCamera();
    renderWithProviders(<DeviceRegistrationScreen camera={camera} />, {
      fetch: createStubFetch([workersRoute([worker])]),
    });

    await waitFor(() => {
      expect(camera.closed()).toBe(0);
    });
    camera.read(REGISTRATION_TOKEN);

    expect(await screen.findByText('등록되었습니다')).toBeInTheDocument();
    expect(screen.getByText('SYN-TERM-01')).toBeInTheDocument();
    expect(screen.getByText('관리자가 안내한 단말 코드와 같은지 확인하세요')).toBeInTheDocument();
  });

  /* 등록 자체가 맞았는지를 먼저 본다. 기준정보를 받는 표시보다 앞에 온다. */
  it('등록 표시가 기준정보 수신 표시보다 앞에 온다', async () => {
    const camera = stubCamera();
    renderWithProviders(<DeviceRegistrationScreen camera={camera} />, {
      fetch: createStubFetch([workersRoute([worker])]),
    });

    await waitFor(() => {
      expect(camera.closed()).toBe(0);
    });
    camera.read(REGISTRATION_TOKEN);

    const registered = await screen.findByText('등록되었습니다');
    const receiving = screen.getByText('기준정보를 받는 중입니다');

    expect(registered.compareDocumentPosition(receiving)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  });

  /*
   * 토큰도 발급 응답도 공장을 정수로만 갖고 이름이 없다. 정수를 그대로 보이면 작업자가
   * 대조할 것이 없고, 단말 코드가 전역 유일이라 코드가 맞으면 공장도 함께 맞는다.
   */
  it('공장을 따로 보이지 않는다', async () => {
    const camera = stubCamera();
    renderWithProviders(<DeviceRegistrationScreen camera={camera} />, {
      fetch: createStubFetch([workersRoute([worker])]),
    });

    await waitFor(() => {
      expect(camera.closed()).toBe(0);
    });
    camera.read(REGISTRATION_TOKEN);

    await screen.findByText(/SYN-TERM-01/);
    expect(screen.queryByText(/공장/)).toBeNull();
  });

  /* 등록 QR 이 아닌 코드가 먼저 잡히는 일이 흔하다. 그때 화면이 멈추면 다시 비출 수 없다. */
  it('등록 QR이 아닌 코드는 무시하고 계속 기다린다', async () => {
    const camera = stubCamera();
    renderWithProviders(<DeviceRegistrationScreen camera={camera} />, {
      fetch: createStubFetch([]),
    });

    await screen.findByText('관리자 화면의 등록 QR을 비추세요.');
    camera.read('https://example.test/not-a-token');

    expect(screen.getByText('관리자 화면의 등록 QR을 비추세요.')).toBeInTheDocument();
    expect(camera.closed()).toBe(0);
  });

  it('읽은 뒤 기준정보를 받는 동안 그것을 말한다', async () => {
    const camera = stubCamera();
    renderWithProviders(<DeviceRegistrationScreen camera={camera} />, {
      fetch: createStubFetch([workersRoute([worker])]),
    });

    await screen.findByText('관리자 화면의 등록 QR을 비추세요.');
    camera.read(REGISTRATION_TOKEN);

    expect(await screen.findByText('기준정보를 받는 중입니다')).toBeInTheDocument();
  });

  /* 받는 중에 미등록이라고 말하면 방금 읽은 것이 헛일이 된 줄로 읽힌다. */
  it('기준정보를 받는 동안에는 등록되지 않았다고 말하지 않는다', async () => {
    const camera = stubCamera();
    renderWithProviders(<DeviceRegistrationScreen camera={camera} />, {
      fetch: createStubFetch([workersRoute([worker])]),
    });

    await screen.findByText('관리자 화면의 등록 QR을 비추세요.');
    camera.read(REGISTRATION_TOKEN);

    await screen.findByText('기준정보를 받는 중입니다');
    expect(
      screen.queryByRole('heading', { name: '이 기기는 아직 등록되지 않았습니다' }),
    ).not.toBeInTheDocument();
  });

  it('읽은 뒤에는 카메라를 닫는다', async () => {
    const camera = stubCamera();
    renderWithProviders(<DeviceRegistrationScreen camera={camera} />, {
      fetch: createStubFetch([workersRoute([worker])]),
    });

    await screen.findByText('관리자 화면의 등록 QR을 비추세요.');
    camera.read(REGISTRATION_TOKEN);

    await waitFor(() => {
      expect(camera.closed()).toBe(1);
    });
  });

  it('받은 작업자 목록을 단말에 남긴다', async () => {
    const camera = stubCamera();
    const seen: URL[] = [];
    renderWithProviders(<DeviceRegistrationScreen camera={camera} />, {
      fetch: createStubFetch([workersRoute([worker], seen)]),
    });

    await screen.findByText('관리자 화면의 등록 QR을 비추세요.');
    camera.read(REGISTRATION_TOKEN);

    await waitFor(() => {
      expect(store.get('worker-directory')).toBe(JSON.stringify([worker]));
    });
    expect(seen[0]?.searchParams.get('plantId')).toBe('7');
  });

  /* 서버가 받지 않은 토큰을 남기면 다음 실행에서 등록된 것처럼 보인다. */
  it('서버가 토큰을 거절하면 등록을 세우지 않는다', async () => {
    const camera = stubCamera();
    renderWithProviders(<DeviceRegistrationScreen camera={camera} />, {
      fetch: createStubFetch([
        {
          match: (request) => new URL(request.url).pathname === '/mdm/workers',
          respond: () => jsonResponse({ code: 'UNAUTHENTICATED' }, { status: 401 }),
        },
      ]),
    });

    await screen.findByText('관리자 화면의 등록 QR을 비추세요.');
    camera.read(REGISTRATION_TOKEN);

    expect(await screen.findByText('등록 정보가 만료됐습니다')).toBeInTheDocument();
    expect(keystore.token).toBeNull();
  });

  /* 잠깐 끊긴 것을 만료라 하면 다시 시도하면 될 일에 관리자를 찾아가게 된다. */
  it('받는 도중 닿지 못한 것은 만료라 하지 않는다', async () => {
    const camera = stubCamera();
    renderWithProviders(<DeviceRegistrationScreen camera={camera} />, {
      fetch: createStubFetch([
        {
          match: (request) => new URL(request.url).pathname === '/mdm/workers',
          respond: () => {
            throw new TypeError('Failed to fetch');
          },
        },
      ]),
    });

    await screen.findByText('관리자 화면의 등록 QR을 비추세요.');
    camera.read(REGISTRATION_TOKEN);

    expect(await screen.findByText('연결된 상태에서 등록해야 합니다')).toBeInTheDocument();
    expect(screen.queryByText('등록 정보가 만료됐습니다')).not.toBeInTheDocument();
    expect(keystore.token).toBeNull();
  });

  it('끊긴 상태에서는 카메라를 열지 않고 이유를 말한다', async () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    const camera = stubCamera();

    renderWithProviders(<DeviceRegistrationScreen camera={camera} />, {
      fetch: createStubFetch([]),
    });

    expect(await screen.findByText('연결된 상태에서 등록해야 합니다')).toBeInTheDocument();
    expect(screen.queryByText('관리자 화면의 등록 QR을 비추세요.')).not.toBeInTheDocument();
  });

  it('권한이 없으면 무엇을 해야 하는지 말한다', async () => {
    const camera = stubCamera({ requestPermission: () => Promise.resolve('denied' as const) });

    renderWithProviders(<DeviceRegistrationScreen camera={camera} />, {
      fetch: createStubFetch([]),
    });

    expect(
      await screen.findByText('카메라 권한이 없어 등록 QR을 읽을 수 없습니다'),
    ).toBeInTheDocument();
  });

  it('카메라 인식을 쓸 수 없으면 그렇게 말한다', async () => {
    const camera = stubCamera({ isSupported: () => Promise.resolve(false) });

    renderWithProviders(<DeviceRegistrationScreen camera={camera} />, {
      fetch: createStubFetch([]),
    });

    expect(await screen.findByText('이 기기에서 카메라 인식을 쓸 수 없습니다')).toBeInTheDocument();
  });
});
