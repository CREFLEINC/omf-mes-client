import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createStubFetch, jsonResponse, renderWithProviders } from '../../test/api-harness';
import { EquipmentFailureScreen } from './screen';

const store = vi.hoisted(() => new Map<string, string>());

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

const equipment = (id: number, code: string, name: string) => ({
  equipmentId: id,
  plantId: 1,
  equipmentCode: code,
  equipmentName: name,
  equipmentTypeCode: 'PRESS',
  statusCode: 'IN_SERVICE',
  calibrationRequired: false,
  isActive: true,
});

const EQUIPMENTS = [equipment(7, 'PRS-01', '프레스 1호기'), equipment(8, 'PRS-02', '프레스 2호기')];

const routes = (options: { openBreakdowns?: number; seen?: URL[] } = {}) => [
  {
    match: (request: Request) => new URL(request.url).pathname === '/mdm/equipments',
    respond: (request: Request) => {
      options.seen?.push(new URL(request.url));
      return jsonResponse({
        items: EQUIPMENTS,
        page: { page: 0, size: 200, total: EQUIPMENTS.length },
      });
    },
  },
  {
    // 메서드를 함께 본다. 보내기(POST)까지 삼키면 화면이 보낸 것을 잴 수 없다.
    match: (request: Request) =>
      new URL(request.url).pathname === '/maintenance/breakdowns' && request.method === 'GET',
    respond: (request: Request) => {
      options.seen?.push(new URL(request.url));
      return jsonResponse({
        items: [],
        page: { page: 0, size: 1, total: options.openBreakdowns ?? 0 },
      });
    },
  },
];

const mount = (extra: ReturnType<typeof routes> = []) =>
  renderWithProviders(<EquipmentFailureScreen />, {
    fetch: createStubFetch([...routes(), ...extra]),
  });

const scan = (code: string) => {
  const field = screen.getByLabelText('설비 스캔') as HTMLInputElement;
  field.focus();
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(field, code);
  field.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertFromPaste' }));
};

beforeEach(() => {
  store.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('설비 고장 보고 화면', () => {
  it('설비를 고르기 전에는 보고할 수 없다', async () => {
    mount();

    await screen.findByLabelText('설비 스캔');

    expect(screen.getByRole('button', { name: '고장 보고' })).toBeDisabled();
  });

  it('스캔한 코드로 설비를 고른다', async () => {
    mount();
    await screen.findByLabelText('설비 스캔');

    scan('PRS-01');

    await waitFor(() => {
      expect(screen.getByText('PRS-01 프레스 1호기')).toBeInTheDocument();
    });
  });

  /* 목록이 도착하기 전에 쏘면 있는 설비를 없다고 하게 된다. */
  it('목록이 도착하기 전에 쏜 코드도 도착한 뒤에 맞춘다', async () => {
    mount();

    scan('PRS-01');

    expect(await screen.findByText('PRS-01 프레스 1호기')).toBeInTheDocument();
    expect(screen.queryByText('PRS-01 설비를 찾지 못했습니다')).not.toBeInTheDocument();
  });

  /* 스캔이 실패해도 고를 수 있어야 한다 — 직접 입력 대체 경로. */
  it('없는 코드를 스캔하면 그렇게 말하고 목록은 그대로 둔다', async () => {
    mount();
    await screen.findByLabelText('설비 스캔');

    scan('SYN-NONE');

    expect(await screen.findByText('SYN-NONE 설비를 찾지 못했습니다')).toBeInTheDocument();
    expect(screen.getByLabelText('목록에서 고르기')).toBeInTheDocument();
  });

  /* 폐기된 설비가 나오면 안 되는 것이 정상이다. */
  it('운용 중인 설비만 청한다', async () => {
    const seen: URL[] = [];
    renderWithProviders(<EquipmentFailureScreen />, {
      fetch: createStubFetch(routes({ seen })),
    });

    await waitFor(() => {
      expect(seen.some((url) => url.pathname === '/mdm/equipments')).toBe(true);
    });
    const url = seen.find((item) => item.pathname === '/mdm/equipments');
    expect(url?.searchParams.get('statusCode')).toBe('IN_SERVICE');
  });

  /* 막지 않는다 — 다른 증상일 수 있어 사람이 보고 정한다. */
  it('처리 중인 고장이 있으면 알리되 막지 않는다', async () => {
    const user = userEvent.setup();
    renderWithProviders(<EquipmentFailureScreen />, {
      fetch: createStubFetch(routes({ openBreakdowns: 1 })),
    });
    await screen.findByLabelText('설비 스캔');

    scan('PRS-01');

    expect(await screen.findByText('이 설비에 처리 중인 고장 1건')).toBeInTheDocument();

    await user.type(screen.getByLabelText('증상'), '유압 누유');
    await user.click(screen.getByRole('radio', { name: '설비가 멈췄다' }));

    expect(screen.getByRole('button', { name: '고장 보고' })).toBeEnabled();
  });

  it('증상을 적지 않으면 보고할 수 없다', async () => {
    const user = userEvent.setup();
    mount();
    await screen.findByLabelText('설비 스캔');

    scan('PRS-01');
    await user.click(await screen.findByRole('radio', { name: '설비가 멈췄다' }));

    expect(screen.getByRole('button', { name: '고장 보고' })).toBeDisabled();
  });

  /* 끄면 보고자가 알린 줄 안다. */
  it('알림은 기본으로 켜져 있다', async () => {
    mount();

    expect(await screen.findByRole('checkbox', { name: '설비담당에게 알린다' })).toBeChecked();
  });

  it('끊겨 있어도 알림을 끄지 않고 아직 못 갔음을 말한다', async () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    mount();

    expect(await screen.findByRole('checkbox', { name: '설비담당에게 알린다' })).toBeChecked();
    expect(screen.getByText('연결되면 알립니다. 급하면 직접 연락하세요.')).toBeInTheDocument();
  });

  /* 이 화면은 비가동을 만들지 않는다. 안내만 한다. */
  it('멈췄다를 고르면 정지 시각과 비가동 안내를 보인다', async () => {
    const user = userEvent.setup();
    mount();
    await screen.findByLabelText('설비 스캔');

    scan('PRS-01');
    await user.click(await screen.findByRole('radio', { name: '설비가 멈췄다' }));

    expect(screen.getByLabelText('정지 시각')).toBeInTheDocument();
    expect(screen.getByText('비가동 실적은 POP에서 따로 입력합니다.')).toBeInTheDocument();
  });

  it('돌지만 이상하다를 고르면 정지 시각을 묻지 않는다', async () => {
    const user = userEvent.setup();
    mount();
    await screen.findByLabelText('설비 스캔');

    scan('PRS-01');
    await user.click(await screen.findByRole('radio', { name: '돌지만 이상하다' }));

    expect(screen.queryByLabelText('정지 시각')).not.toBeInTheDocument();
  });

  it('보고하면 큐를 거쳐 계약 경로로 나간다', async () => {
    const user = userEvent.setup();
    const seen: URL[] = [];
    renderWithProviders(<EquipmentFailureScreen />, {
      fetch: createStubFetch([
        ...routes(),
        {
          match: (request: Request) =>
            new URL(request.url).pathname === '/maintenance/breakdowns' &&
            request.method === 'POST',
          respond: (request: Request) => {
            seen.push(new URL(request.url));
            return jsonResponse({ breakdownId: 1 }, { status: 201 });
          },
        },
      ]),
    });
    await screen.findByLabelText('설비 스캔');

    scan('PRS-01');
    await screen.findByText('PRS-01 프레스 1호기');
    await user.type(screen.getByLabelText('증상'), '유압 누유');
    await user.click(screen.getByRole('radio', { name: '설비가 멈췄다' }));
    await user.click(screen.getByRole('button', { name: '고장 보고' }));

    expect(await screen.findByText('고장을 보고했습니다')).toBeInTheDocument();
    expect(seen.some((url) => url.pathname === '/maintenance/breakdowns')).toBe(true);
  });

  /* 담긴 것만으로 보고됨이라 하면 설비담당이 오지 않는데 온 줄 안다. */
  it('보내지 못하면 담아 두었다고만 말한다', async () => {
    const user = userEvent.setup();
    renderWithProviders(<EquipmentFailureScreen />, {
      fetch: createStubFetch([
        ...routes(),
        {
          match: (request: Request) =>
            new URL(request.url).pathname === '/maintenance/breakdowns' &&
            request.method === 'POST',
          respond: () => {
            throw new TypeError('Failed to fetch');
          },
        },
      ]),
    });
    await screen.findByLabelText('설비 스캔');

    scan('PRS-01');
    await screen.findByText('PRS-01 프레스 1호기');
    await user.type(screen.getByLabelText('증상'), '유압 누유');
    await user.click(screen.getByRole('radio', { name: '설비가 멈췄다' }));
    await user.click(screen.getByRole('button', { name: '고장 보고' }));

    expect(await screen.findByText('보고를 담아 두었습니다')).toBeInTheDocument();
    expect(
      screen.getByText('연결되면 보냅니다. 아직 설비담당에게 가지 않았습니다.'),
    ).toBeInTheDocument();
    expect(screen.queryByText('고장을 보고했습니다')).not.toBeInTheDocument();
  });
});
