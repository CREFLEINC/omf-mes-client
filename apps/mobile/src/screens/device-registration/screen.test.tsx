import { screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createStubFetch, jsonResponse, renderWithProviders } from '../../test/api-harness';
import { currentPlantId } from '../../patterns/plant';
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

/*
 * ⭐ **실제 토큰이 싣고 오는 것은 단말 번호 하나뿐이다**(`sub`). 코드·공장은 서버에 물어본다.
 * 종전 시험은 `terminalCode`·`plantId` 가 토큰에 들어 있는 지어낸 모양을 쓰고 있었고, 그래서
 * 실서버에서 등록이 통째로 막히는 동안에도 초록이었다(#1103).
 */
const TERMINAL_ID = 1001;
const REGISTRATION_TOKEN = tokenWith({ sub: TERMINAL_ID, iss: 'omf-mes', iat: 1757000000 });

interface StubCamera extends QrCamera {
  read: (value: string) => void;
  fail: (message: string) => void;
  closed: () => number;
}

const stubCamera = (
  overrides: Partial<Pick<QrCamera, 'isSupported' | 'requestPermission'>> = {},
): StubCamera => {
  let onRead: ((value: string) => void) | null = null;
  let onError: ((message: string) => void) | null = null;
  let closes = 0;

  return {
    isSupported: overrides.isSupported ?? (() => Promise.resolve(true)),
    requestPermission: overrides.requestPermission ?? (() => Promise.resolve('granted' as const)),
    open: (listener, failed) => {
      onRead = listener;
      onError = failed ?? null;
      return Promise.resolve(() => {
        closes += 1;
        return Promise.resolve();
      });
    },
    read: (value) => onRead?.(value),
    fail: (message) => onError?.(message),
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

/** 토큰이 가리키는 단말. 코드·공장은 여기서 온다 — 토큰에는 없다. */
const terminalRoute = (
  respond: (request: Request) => Response = () =>
    jsonResponse({
      terminalId: TERMINAL_ID,
      terminalCode: 'SYN-TERM-01',
      terminalTypeCode: 'PDA',
      plantId: 7,
      statusCode: 'ACTIVE',
      isActive: true,
    }),
) => ({
  match: (request: Request) =>
    new URL(request.url).pathname === `/mdm/terminals/${String(TERMINAL_ID)}`,
  respond,
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

  it('카메라가 열리면 무엇을 스캔하라고 안내한다', async () => {
    renderWithProviders(<DeviceRegistrationScreen camera={stubCamera()} />, {
      fetch: createStubFetch([]),
    });

    expect(await screen.findByText('관리자 화면의 등록 QR을 스캔하세요.')).toBeInTheDocument();
  });

  it('읽은 QR이 가리키는 단말을 보인다', async () => {
    const camera = stubCamera();
    renderWithProviders(<DeviceRegistrationScreen camera={camera} />, {
      fetch: createStubFetch([terminalRoute(), workersRoute([worker])]),
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
      fetch: createStubFetch([terminalRoute(), workersRoute([worker])]),
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
      fetch: createStubFetch([terminalRoute(), workersRoute([worker])]),
    });

    await waitFor(() => {
      expect(camera.closed()).toBe(0);
    });
    camera.read(REGISTRATION_TOKEN);

    const registered = await screen.findByText('등록되었습니다');
    const receiving = screen.getByText('작업자 정보를 받는 중입니다');

    expect(registered.compareDocumentPosition(receiving)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  });

  /*
   * 토큰도 발급 응답도 공장을 정수로만 갖고 이름이 없다. 정수를 그대로 보이면 작업자가
   * 대조할 것이 없고, 단말 코드가 전역 유일이라 코드가 맞으면 공장도 함께 맞는다.
   */
  it('공장을 따로 보이지 않는다', async () => {
    const camera = stubCamera();
    renderWithProviders(<DeviceRegistrationScreen camera={camera} />, {
      fetch: createStubFetch([terminalRoute(), workersRoute([worker])]),
    });

    await waitFor(() => {
      expect(camera.closed()).toBe(0);
    });
    camera.read(REGISTRATION_TOKEN);

    await screen.findByText(/SYN-TERM-01/);
    expect(screen.queryByText(/공장/)).toBeNull();
  });

  /*
   * ⭐ **이 결함 자체를 막는 자리다**(#1103). 실제 토큰에는 `terminalCode`·`plantId` 가 없다.
   * 그 둘을 요구하면 모든 등록 QR 이 「등록 QR 이 아님」으로 걸러지고, 화면은 읽은 것을 조용히
   * 버린 채 스캔 대기에 머문다 — 현장에서는 「카메라는 열렸는데 인식이 안 된다」로 보인다.
   */
  it('코드·공장이 없는 실서버 모양의 토큰으로도 등록된다', async () => {
    const camera = stubCamera();
    renderWithProviders(<DeviceRegistrationScreen camera={camera} />, {
      fetch: createStubFetch([terminalRoute(), workersRoute([worker])]),
    });

    await screen.findByText('관리자 화면의 등록 QR을 스캔하세요.');
    camera.read(tokenWith({ sub: TERMINAL_ID }));

    expect(await screen.findByText('등록되었습니다')).toBeInTheDocument();
    expect(screen.getByText('SYN-TERM-01')).toBeInTheDocument();
  });

  /*
   * ⭐ **공장은 토큰에 없다.** 등록할 때 남겨 두지 않으면 `currentPlantId()` 가 늘 null 이고,
   * 공장을 알아야 하는 쓰기 화면(입하 등록·자재LOT 스캔·제품 입고)이 전부 막힌다 — 등록은
   * 멀쩡히 끝나므로 한참 뒤 다른 화면에서 드러난다.
   */
  it('등록하면서 서버가 말한 공장을 단말에 남긴다', async () => {
    const camera = stubCamera();
    renderWithProviders(<DeviceRegistrationScreen camera={camera} />, {
      fetch: createStubFetch([terminalRoute(), workersRoute([worker])]),
    });

    await screen.findByText('관리자 화면의 등록 QR을 스캔하세요.');
    camera.read(REGISTRATION_TOKEN);

    await screen.findByText('등록되었습니다');
    await waitFor(() => {
      expect(currentPlantId()).toBe(7);
    });
  });

  /* 등록 QR 이 아닌 코드가 먼저 잡히는 일이 흔하다. 그때 화면이 멈추면 다시 비출 수 없다. */
  it('등록 QR이 아닌 코드는 무시하고 계속 기다린다', async () => {
    const camera = stubCamera();
    renderWithProviders(<DeviceRegistrationScreen camera={camera} />, {
      fetch: createStubFetch([]),
    });

    await screen.findByText('관리자 화면의 등록 QR을 스캔하세요.');
    camera.read('https://example.test/not-a-token');

    expect(screen.getByText('관리자 화면의 등록 QR을 스캔하세요.')).toBeInTheDocument();
    expect(camera.closed()).toBe(0);
  });

  it('읽은 뒤 기준정보를 받는 동안 그것을 말한다', async () => {
    const camera = stubCamera();
    renderWithProviders(<DeviceRegistrationScreen camera={camera} />, {
      fetch: createStubFetch([terminalRoute(), workersRoute([worker])]),
    });

    await screen.findByText('관리자 화면의 등록 QR을 스캔하세요.');
    camera.read(REGISTRATION_TOKEN);

    expect(await screen.findByText('작업자 정보를 받는 중입니다')).toBeInTheDocument();
  });

  /* 받는 중에 미등록이라고 말하면 방금 읽은 것이 헛일이 된 줄로 읽힌다. */
  it('기준정보를 받는 동안에는 등록되지 않았다고 말하지 않는다', async () => {
    const camera = stubCamera();
    renderWithProviders(<DeviceRegistrationScreen camera={camera} />, {
      fetch: createStubFetch([terminalRoute(), workersRoute([worker])]),
    });

    await screen.findByText('관리자 화면의 등록 QR을 스캔하세요.');
    camera.read(REGISTRATION_TOKEN);

    await screen.findByText('작업자 정보를 받는 중입니다');
    expect(
      screen.queryByRole('heading', { name: '이 기기는 아직 등록되지 않았습니다' }),
    ).not.toBeInTheDocument();
  });

  it('읽은 뒤에는 카메라를 닫는다', async () => {
    const camera = stubCamera();
    renderWithProviders(<DeviceRegistrationScreen camera={camera} />, {
      fetch: createStubFetch([terminalRoute(), workersRoute([worker])]),
    });

    await screen.findByText('관리자 화면의 등록 QR을 스캔하세요.');
    camera.read(REGISTRATION_TOKEN);

    await waitFor(() => {
      expect(camera.closed()).toBe(1);
    });
  });

  it('받은 작업자 목록을 단말에 남긴다', async () => {
    const camera = stubCamera();
    const seen: URL[] = [];
    renderWithProviders(<DeviceRegistrationScreen camera={camera} />, {
      fetch: createStubFetch([terminalRoute(), workersRoute([worker], seen)]),
    });

    await screen.findByText('관리자 화면의 등록 QR을 스캔하세요.');
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
        terminalRoute(() => jsonResponse({ code: 'UNAUTHENTICATED' }, { status: 401 })),
      ]),
    });

    await screen.findByText('관리자 화면의 등록 QR을 스캔하세요.');
    camera.read(REGISTRATION_TOKEN);

    expect(await screen.findByText('등록 정보가 만료됐습니다')).toBeInTheDocument();
    expect(keystore.token).toBeNull();
  });

  /* 잠깐 끊긴 것을 만료라 하면 다시 시도하면 될 일에 관리자를 찾아가게 된다. */
  it('받는 도중 닿지 못한 것은 만료라 하지 않는다', async () => {
    const camera = stubCamera();
    renderWithProviders(<DeviceRegistrationScreen camera={camera} />, {
      fetch: createStubFetch([
        terminalRoute(() => {
          throw new TypeError('Failed to fetch');
        }),
      ]),
    });

    await screen.findByText('관리자 화면의 등록 QR을 스캔하세요.');
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
    expect(screen.queryByText('관리자 화면의 등록 QR을 스캔하세요.')).not.toBeInTheDocument();
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

  /* 듣지 않으면 화면이 스캔 대기에 머물러 「비추고 있는데 아무 일도 안 일어난다」가 된다. */
  it('스캐너가 도중에 실패하면 조용히 기다리지 않는다', async () => {
    const camera = stubCamera();
    renderWithProviders(<DeviceRegistrationScreen camera={camera} />, {
      fetch: createStubFetch([]),
    });

    await screen.findByText('관리자 화면의 등록 QR을 스캔하세요.');
    camera.fail('카메라를 쓸 수 없습니다');

    expect(
      await screen.findByText('이 기기에서 카메라 인식을 쓸 수 없습니다'),
    ).toBeInTheDocument();
    /* 쓸 수 없다고 말해 놓고 카메라만 계속 돌면 배터리와 카메라 표시등이 그대로 남는다. */
    expect(camera.closed()).toBe(1);
  });

  it('카메라 인식을 쓸 수 없으면 그렇게 말한다', async () => {
    const camera = stubCamera({ isSupported: () => Promise.resolve(false) });

    renderWithProviders(<DeviceRegistrationScreen camera={camera} />, {
      fetch: createStubFetch([]),
    });

    expect(await screen.findByText('이 기기에서 카메라 인식을 쓸 수 없습니다')).toBeInTheDocument();
  });
});
