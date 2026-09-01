import { screen, waitFor } from '@testing-library/react';
import { useEffect } from 'react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createStubFetch, jsonResponse, renderWithProviders } from '../../test/api-harness';
import { useWorkerSession } from '../../patterns/worker-session';
import { EquipmentFailureScreen } from './screen';

const store = vi.hoisted(() => new Map<string, string>());

vi.mock('../../patterns/photo-capture', () => ({
  capturePhoto: () => Promise.resolve({ type: 'photo', uri: 'file:///syn.jpg' }),
  readCapturedPhoto: vi.fn(() =>
    Promise.resolve({
      fileName: 'syn.jpg',
      mimeType: 'image/jpeg',
      data: 'AAAA',
      previewUrl: 'blob:syn',
      byteLength: 10,
    }),
  ),
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

/* 사번 없이는 보고할 수 없다 - 화면을 세우려면 먼저 세워 둔다. */
const SignedIn = ({ children }: { children: React.ReactNode }) => {
  const { worker, signIn } = useWorkerSession();

  useEffect(() => {
    if (worker === null) {
      signIn({ workerNo: '900028', workerName: '김철수' });
    }
  }, [signIn, worker]);

  return worker === null ? null : children;
};

const mount = (extra: ReturnType<typeof routes> = []) =>
  renderWithProviders(
    <SignedIn>
      <EquipmentFailureScreen />
    </SignedIn>,
    { fetch: createStubFetch([...routes(), ...extra]) },
  );

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
  /* 누가 한 일인지 없이 기록을 남길 수 없다 - 서버가 사번 없는 쓰기를 받지 않는다. */
  it('사번을 확인하기 전에는 다 채워도 보고할 수 없고 이유를 말한다', async () => {
    const user = userEvent.setup();
    renderWithProviders(<EquipmentFailureScreen />, {
      fetch: createStubFetch(routes()),
    });

    await screen.findByLabelText('설비 스캔');
    scan('PRS-01');
    await screen.findByText('PRS-01 프레스 1호기');
    await user.type(screen.getByLabelText('증상'), '유압 누유');
    await user.click(screen.getByRole('radio', { name: '설비가 멈췄다' }));

    expect(screen.getByText('사번을 확인해야 보고할 수 있습니다')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '고장 보고' })).toBeDisabled();
  });

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
    renderWithProviders(
      <SignedIn>
        <EquipmentFailureScreen />
      </SignedIn>,
      {
        fetch: createStubFetch(routes({ seen })),
      },
    );

    await waitFor(() => {
      expect(seen.some((url) => url.pathname === '/mdm/equipments')).toBe(true);
    });
    const url = seen.find((item) => item.pathname === '/mdm/equipments');
    expect(url?.searchParams.get('statusCode')).toBe('IN_SERVICE');
  });

  /* 막지 않는다 — 다른 증상일 수 있어 사람이 보고 정한다. */
  it('처리 중인 고장이 있으면 알리되 막지 않는다', async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <SignedIn>
        <EquipmentFailureScreen />
      </SignedIn>,
      {
        fetch: createStubFetch(routes({ openBreakdowns: 1 })),
      },
    );
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

  /* 감춘 값이 남아 나가면 멈추지 않은 고장에 정지 시각이 붙는다. */
  it('멈췄다로 적은 정지 시각은 상태를 바꾸면 함께 지운다', async () => {
    const user = userEvent.setup();
    const sent: Record<string, unknown>[] = [];

    renderWithProviders(
      <SignedIn>
        <EquipmentFailureScreen />
      </SignedIn>,
      {
        fetch: createStubFetch([
          ...routes(),
          {
            match: (request: Request) =>
              new URL(request.url).pathname === '/maintenance/breakdowns' &&
              request.method === 'POST',
            respond: (request: Request) => {
              void request
                .clone()
                .json()
                .then((body: Record<string, unknown>) => {
                  sent.push(body);
                });
              return jsonResponse({ breakdownId: 1 }, { status: 201 });
            },
          },
        ]),
      },
    );
    await screen.findByLabelText('설비 스캔');

    scan('PRS-01');
    await screen.findByText('PRS-01 프레스 1호기');
    await user.type(screen.getByLabelText('증상'), '유압 누유');
    await user.click(screen.getByRole('radio', { name: '설비가 멈췄다' }));
    await user.type(screen.getByLabelText('정지 시각'), '14:20');
    await user.click(screen.getByRole('radio', { name: '돌지만 이상하다' }));
    await user.click(screen.getByRole('button', { name: '고장 보고' }));

    await screen.findByText('고장을 보고했습니다');
    await waitFor(() => {
      expect(sent).toHaveLength(1);
    });
    expect(sent[0]?.stoppedAt).toBeNull();
  });

  it('보고하면 큐를 거쳐 계약 경로로 나간다', async () => {
    const user = userEvent.setup();
    const seen: URL[] = [];
    renderWithProviders(
      <SignedIn>
        <EquipmentFailureScreen />
      </SignedIn>,
      {
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
      },
    );
    await screen.findByLabelText('설비 스캔');

    scan('PRS-01');
    await screen.findByText('PRS-01 프레스 1호기');
    await user.type(screen.getByLabelText('증상'), '유압 누유');
    await user.click(screen.getByRole('radio', { name: '설비가 멈췄다' }));
    await user.click(screen.getByRole('button', { name: '고장 보고' }));

    expect(await screen.findByText('고장을 보고했습니다')).toBeInTheDocument();
    expect(seen.some((url) => url.pathname === '/maintenance/breakdowns')).toBe(true);
  });

  /* 앞서 담긴 남의 건이 거부됐다고 이 보고까지 못 간 것으로 말하면 안 된다. */
  it('큐에 있던 다른 건이 거부돼도 이 보고의 결과로 말한다', async () => {
    const user = userEvent.setup();
    store.set(
      'outbox',
      JSON.stringify([
        {
          id: 'old',
          idempotencyKey: 'old-key',
          method: 'POST',
          path: '/production/results',
          body: {},
          occurredAt: '2026-09-01T00:00:00.000Z',
          confirmation: 'immediate',
        },
      ]),
    );

    renderWithProviders(
      <SignedIn>
        <EquipmentFailureScreen />
      </SignedIn>,
      {
        fetch: createStubFetch([
          ...routes(),
          {
            match: (request: Request) => new URL(request.url).pathname === '/production/results',
            respond: () => jsonResponse({ code: 'CONFLICT' }, { status: 409 }),
          },
          {
            match: (request: Request) =>
              new URL(request.url).pathname === '/maintenance/breakdowns' &&
              request.method === 'POST',
            respond: () => jsonResponse({ breakdownId: 1 }, { status: 201 }),
          },
        ]),
      },
    );
    await screen.findByLabelText('설비 스캔');

    scan('PRS-01');
    await screen.findByText('PRS-01 프레스 1호기');
    await user.type(screen.getByLabelText('증상'), '유압 누유');
    await user.click(screen.getByRole('radio', { name: '설비가 멈췄다' }));
    await user.click(screen.getByRole('button', { name: '고장 보고' }));

    expect(await screen.findByText('고장을 보고했습니다')).toBeInTheDocument();
  });

  /* 설비담당이 사진을 기다리느라 늦게 알면 안 된다. */
  it('사진보다 본문을 먼저 담는다', async () => {
    const user = userEvent.setup();
    mount();
    await screen.findByLabelText('설비 스캔');

    scan('PRS-01');
    await screen.findByText('PRS-01 프레스 1호기');
    await user.click(screen.getByRole('button', { name: /촬영/ }));
    await screen.findByAltText('찍은 사진');

    await user.type(screen.getByLabelText('증상'), '유압 누유');
    await user.click(screen.getByRole('radio', { name: '설비가 멈췄다' }));
    await user.click(screen.getByRole('button', { name: '고장 보고' }));

    await waitFor(() => {
      expect(store.get('outbox')).toBeDefined();
    });
    const queued = JSON.parse(store.get('outbox') ?? '[]') as { path: string }[];
    const paths = queued.map((item) => item.path);

    expect(paths[0]).toBe('/maintenance/breakdowns');
    expect(paths[1]).toBe('/maintenance/breakdowns/:breakdownId/attachments');
  });

  it('세 장을 채우면 더 찍을 수 없고 이유를 말한다', async () => {
    const user = userEvent.setup();
    mount();
    await screen.findByLabelText('설비 스캔');

    scan('PRS-01');
    await screen.findByText('PRS-01 프레스 1호기');

    for (let index = 0; index < 3; index += 1) {
      await user.click(screen.getByRole('button', { name: /촬영/ }));
      await waitFor(() => {
        expect(screen.getAllByAltText('찍은 사진')).toHaveLength(index + 1);
      });
    }

    expect(screen.getByRole('button', { name: /촬영/ })).toBeDisabled();
    expect(screen.getByText('사진은 세 장까지 붙일 수 있습니다.')).toBeInTheDocument();
  });

  /* 보고를 마치면 화면은 비지만 큐는 그대로다 - 이 화면 것만 세면 큐가 끝없이 커진다. */
  it('이미 큐에 쌓인 사진도 한도에 센다', async () => {
    const heavy = 'A'.repeat(5 * 1024 * 1024);
    store.set(
      'outbox',
      JSON.stringify([
        {
          id: 'old',
          idempotencyKey: 'old-key',
          method: 'POST',
          path: '/maintenance/breakdowns/9/attachments',
          body: null,
          file: { fileName: 'old.jpg', mimeType: 'image/jpeg', data: heavy },
          occurredAt: '2026-09-01T00:00:00.000Z',
          confirmation: 'pending',
        },
      ]),
    );

    mount();
    await screen.findByLabelText('설비 스캔');

    scan('PRS-01');
    await screen.findByText('PRS-01 프레스 1호기');

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /촬영/ })).toBeDisabled();
    });
    expect(
      screen.getByText('보내지 못한 사진이 많아 지금은 더 찍을 수 없습니다.'),
    ).toBeInTheDocument();
  });

  it('설비를 고르기 전에는 찍을 수 없다', async () => {
    mount();

    expect(await screen.findByRole('button', { name: /촬영/ })).toBeDisabled();
  });

  /* 담긴 것만으로 보고됨이라 하면 설비담당이 오지 않는데 온 줄 안다. */
  /* 교대한 뒤에 나가도 그때 그 사람의 일로 남아야 한다. */
  it('담긴 건이 그때의 사번을 들고 있다', async () => {
    const user = userEvent.setup();
    mount();
    await screen.findByLabelText('설비 스캔');

    scan('PRS-01');
    await screen.findByText('PRS-01 프레스 1호기');
    await user.type(screen.getByLabelText('증상'), '유압 누유');
    await user.click(screen.getByRole('radio', { name: '설비가 멈췄다' }));
    await user.click(screen.getByRole('button', { name: '고장 보고' }));

    await waitFor(() => {
      expect(store.get('outbox')).toBeDefined();
    });
    const queued = JSON.parse(store.get('outbox') ?? '[]') as { workerNo?: string }[];

    expect(queued[0]?.workerNo).toBe('900028');
  });

  it('보내지 못하면 담아 두었다고만 말한다', async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <SignedIn>
        <EquipmentFailureScreen />
      </SignedIn>,
      {
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
      },
    );
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
