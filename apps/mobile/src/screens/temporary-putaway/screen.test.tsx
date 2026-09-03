import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useEffect, type ReactNode } from 'react';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  createStubFetch,
  createTestQueryClient,
  jsonResponse,
  renderWithProviders,
  type StubRoute,
} from '../../test/api-harness';
import { useWorkerSession } from '../../patterns/worker-session';
import { TemporaryPutawayScreen } from './screen';

const store = vi.hoisted(() => new Map<string, string>());
/** 단말 보관소가 거절하는 상황을 만든다. 담기지 못한 것을 화면이 말하는지 보기 위해서다. */
const held = vi.hoisted(() => ({ failWrite: null as string | null }));

vi.mock('../../patterns/local-store', () => ({
  readLocal: (key: string) => Promise.resolve(store.get(key) ?? null),
  writeLocal: (key: string, value: string) => {
    if (held.failWrite === key) {
      return Promise.reject(new Error('보관소가 가득 찼습니다'));
    }

    store.set(key, value);
    return Promise.resolve();
  },
  removeLocal: (key: string) => {
    store.delete(key);
    return Promise.resolve();
  },
}));

const page = { page: 0, size: 20, totalElements: 0, totalPages: 1 };

const task = (overrides: Record<string, unknown> = {}) => ({
  putawayTaskId: 90,
  putawayTaskNo: 'PT-2026-0007',
  goodsReceiptLineId: 12,
  itemId: 31,
  lotId: 4,
  taskQty: 120,
  uomId: 9,
  fromLocationId: 1,
  recommendedLocationId: 5,
  warehouseId: 2,
  priorityNo: 1,
  statusCode: 'ASSIGNED',
  ...overrides,
});

const location = (overrides: Record<string, unknown> = {}) => ({
  locationId: 5,
  warehouseId: 2,
  locationCode: 'A-01-03',
  locationName: '자재 A열',
  locationTypeCode: 'RACK',
  allowMixedItem: true,
  allowMixedLot: true,
  isActive: true,
  ...overrides,
});

const TEMP = location({ locationId: 9, locationCode: 'TMP-01', locationName: '임시 자리' });

const codeValue = (code: string, name: string) => ({
  codeValueId: 1,
  codeGroupId: 5,
  code,
  codeName: name,
  displayOrder: 1,
  isActive: true,
});

interface Options {
  reasons?: unknown[];
  locations?: unknown[];
  /** 서버가 아는 지시. 앞 화면이 넘긴 스냅숏과 다를 수 있다. */
  fresh?: unknown;
}

const routes = (options: Options = {}): StubRoute[] => [
  {
    match: (req) => new URL(req.url).pathname === '/mdm/locations',
    respond: (req) => {
      const code = new URL(req.url).searchParams.get('locationCode');
      const all = options.locations ?? [location(), TEMP];

      return jsonResponse({
        items:
          code === null
            ? all
            : all.filter((each) => (each as { locationCode: string }).locationCode === code),
        page,
      });
    },
  },
  {
    match: (req) => new URL(req.url).pathname === '/mdm/code-values',
    respond: () =>
      jsonResponse({ items: options.reasons ?? [codeValue('FULL', '정위치 포화')], page }),
  },
  {
    match: (req) => new URL(req.url).pathname === '/mdm/uoms',
    respond: () => jsonResponse({ items: [{ uomId: 9, uomCode: 'EA' }], page }),
  },
  {
    match: (req) => new URL(req.url).pathname === '/logistics/putaway-tasks/90',
    respond: () => jsonResponse(options.fresh ?? task()),
  },
];

const SignedIn = ({ children }: { children: ReactNode }) => {
  const { worker, signIn } = useWorkerSession();

  useEffect(() => {
    if (worker === null) {
      signIn({ workerNo: '900028', workerName: '김철수' });
    }
  }, [signIn, worker]);

  return worker === null ? null : children;
};

const mount = (
  state: unknown,
  extra: StubRoute[] = [],
  options: Options = {},
  queryClient?: ReturnType<typeof createTestQueryClient>,
) =>
  renderWithProviders(
    <MemoryRouter initialEntries={[{ pathname: '/temporary-putaway', state }]}>
      <SignedIn>
        <TemporaryPutawayScreen />
      </SignedIn>
    </MemoryRouter>,
    { fetch: createStubFetch([...extra, ...routes(options)]), queryClient },
  );

const scan = (code: string) => {
  const field = screen.getByLabelText('임시 위치 코드 스캔') as HTMLInputElement;
  field.focus();
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(field, code);
  field.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertFromPaste' }));
};

beforeEach(() => {
  held.failWrite = null;
  store.clear();
  localStorage.clear();
});

describe('임시 위치 적재 화면', () => {
  /* 지시는 앞 화면이 들고 온다. 없으면 지어내지 않고 어디서 오는지 알린다. */
  it('지시 없이 열면 어디서 오는지 알리고 아무것도 열지 않는다', async () => {
    mount(null);

    expect(await screen.findByText('적치 지시를 가지고 오세요')).toBeTruthy();
    expect(screen.queryByLabelText('임시 위치 코드 스캔')).toBeNull();
  });

  it('넘어온 지시를 보인다', async () => {
    mount({ task: task() });

    expect(await screen.findByText('PT-2026-0007')).toBeTruthy();
    expect(screen.getByLabelText('임시 위치 코드 스캔')).toBeTruthy();
  });

  /* 임시 위치를 가려낼 값이 아직 없다. 걸러 낸 척하지 않는다. */
  it('위치를 걸러 내지 않는다는 것을 말한다', async () => {
    mount({ task: task() });

    expect(
      await screen.findByText('임시 위치를 가려낼 값이 아직 없어 전체 위치를 보입니다'),
    ).toBeTruthy();
  });

  /* 실제 적치 위치는 완료된 건에만 채워진다. 또 적으면 두 기록이 남는다. */
  it('이미 적치된 지시는 막고 현재 위치를 보인다', async () => {
    mount({ task: task({ actualLocationId: 5 }) });

    expect(await screen.findByText('이미 임시 적치되었습니다')).toBeTruthy();
    await waitFor(() => {
      expect(screen.getByText('현재 위치 A-01-03')).toBeTruthy();
    });
  });

  /* 서버가 둘 다 비면 막는다. 무엇이 있어야 하는지를 먼저 말한다. */
  it('사유와 비고가 둘 다 비면 등록을 막고 무엇이 필요한지 말한다', async () => {
    mount({ task: task(), location: TEMP });

    expect(await screen.findByText('사유를 고르거나 비고를 적으세요')).toBeTruthy();
    expect(screen.getByRole('button', { name: '임시 적치 등록' }).hasAttribute('disabled')).toBe(
      true,
    );
  });

  it('비고만 적어도 등록할 수 있다', async () => {
    const user = userEvent.setup();
    mount({ task: task(), location: TEMP });

    await screen.findByLabelText('비고');
    await user.type(screen.getByLabelText('비고'), '통로에 둠');

    expect(screen.getByRole('button', { name: '임시 적치 등록' }).hasAttribute('disabled')).toBe(
      false,
    );
  });

  /* 값이 없으면 고를 것이 없다. 비고로 적게 두고 그 사실을 말한다. */
  it('고를 사유가 없으면 그 사실을 말하고 선택을 잠근다', async () => {
    mount({ task: task() }, [], { reasons: [] });

    expect(await screen.findByText('고를 사유가 아직 없습니다. 비고에 적으세요.')).toBeTruthy();
    expect(screen.getByRole('combobox', { name: '사유' }).hasAttribute('disabled')).toBe(true);
  });

  it('스캔한 위치를 임시 위치로 잡는다', async () => {
    mount({ task: task() });

    await screen.findByLabelText('임시 위치 코드 스캔');
    scan('TMP-01');

    /* 확인 줄과 선택칸이 같은 자리를 가리킨다 - 둘이 갈리면 어느 쪽을 믿을지 알 수 없다. */
    expect(await screen.findAllByText('TMP-01 임시 자리')).toHaveLength(2);
  });

  /*
   * 선택칸이 등록되는 자리와 다른 자리를 가리키면, 화면이 두 자리를 동시에 말하게 된다.
   * 되돌릴 수 없는 재고 위치 기록이라 작업자가 어느 쪽을 믿을지 정할 근거가 있어야 한다.
   */
  it('앞 화면의 위치가 있어도 스캔하면 선택칸이 스캔한 자리를 가리킨다', async () => {
    mount({ task: task(), location: TEMP });

    await screen.findByLabelText('임시 위치 코드 스캔');
    expect(await screen.findAllByText('TMP-01 임시 자리')).toHaveLength(2);

    scan('A-01-03');

    expect((await screen.findAllByText('A-01-03 자재 A열')).length).toBeGreaterThan(1);
    expect(screen.queryByText('TMP-01 임시 자리')).toBeNull();
  });

  /* 빗나간 스캔에서는 가리킬 자리가 없다. 앞 화면의 위치를 고른 것처럼 보이면 안 된다. */
  it('스캔이 빗나가면 선택칸도 앞 화면의 위치를 가리키지 않는다', async () => {
    mount({ task: task(), location: TEMP });

    await screen.findByLabelText('임시 위치 코드 스캔');
    scan('Z-99');

    await screen.findByText('Z-99 위치를 이 창고에서 찾지 못했습니다');
    expect(screen.queryByText('TMP-01 임시 자리')).toBeNull();
  });

  it('이 창고에 없는 코드를 스캔하면 찾지 못했다고 말한다', async () => {
    mount({ task: task() });

    await screen.findByLabelText('임시 위치 코드 스캔');
    scan('Z-99');

    expect(await screen.findByText('Z-99 위치를 이 창고에서 찾지 못했습니다')).toBeTruthy();
  });

  /*
   * 스캔을 시작했으면 스캔이 정본이다. 찾지 못한 것을 앞 화면의 위치로 되돌리면, 작업자는
   * 자기가 비춘 자리에 넣었다고 믿는데 장부는 다른 자리를 가리킨다 - 실물을 사람이 찾아야 한다.
   */
  it('스캔이 빗나가면 앞 화면의 위치로 등록하지 않는다', async () => {
    const user = userEvent.setup();
    const seen: Request[] = [];
    mount({ task: task(), location: TEMP }, [
      {
        match: (req) =>
          new URL(req.url).pathname === '/logistics/putaway-tasks/90:complete-temporary',
        respond: (req) => {
          seen.push(req.clone());
          return jsonResponse(task({ actualLocationId: 9 }));
        },
      },
    ]);

    await screen.findByLabelText('비고');
    await user.type(screen.getByLabelText('비고'), '통로에 둠');
    scan('Z-99');

    expect(await screen.findByText('Z-99 위치를 이 창고에서 찾지 못했습니다')).toBeTruthy();
    expect(screen.getByRole('button', { name: '임시 적치 등록' }).hasAttribute('disabled')).toBe(
      true,
    );

    await user.click(screen.getByRole('button', { name: '임시 적치 등록' }));

    /* 아무 일도 없었음을 재려면 일이 일어날 시간을 준 뒤에 봐야 한다. */
    await waitFor(() => {
      expect(screen.getByRole('button', { name: '임시 적치 등록' }).hasAttribute('disabled')).toBe(
        true,
      );
    });
    expect(seen).toHaveLength(0);
    expect(screen.queryByText('임시 적치를 기록했습니다')).toBeNull();
  });

  /* 막기만 하고 나갈 길이 없으면 현장이 멈춘다. 빗나간 스캔을 되돌릴 수 있어야 한다. */
  it('빗나간 스캔 뒤 목록에서 고르면 다시 등록할 수 있다', async () => {
    const user = userEvent.setup();
    const seen: Request[] = [];
    mount({ task: task(), location: TEMP }, [
      {
        match: (req) =>
          new URL(req.url).pathname === '/logistics/putaway-tasks/90:complete-temporary' &&
          req.method === 'POST',
        respond: (req) => {
          seen.push(req.clone());
          return jsonResponse(task({ actualLocationId: 9 }));
        },
      },
    ]);

    await screen.findByLabelText('비고');
    await user.type(screen.getByLabelText('비고'), '통로에 둠');
    scan('Z-99');
    await screen.findByText('Z-99 위치를 이 창고에서 찾지 못했습니다');

    await user.click(await screen.findByRole('combobox', { name: '목록에서 고르기' }));
    await user.click(await screen.findByRole('option', { name: /TMP-01/ }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: '임시 적치 등록' }).hasAttribute('disabled')).toBe(
        false,
      );
    });

    await user.click(screen.getByRole('button', { name: '임시 적치 등록' }));

    await waitFor(() => {
      expect(seen).toHaveLength(1);
    });
    expect((await seen[0]!.json()) as { actualLocationId: number }).toMatchObject({
      actualLocationId: 9,
    });
  });

  /* 확인하지 못한 것을 없는 것으로 말하면 작업자가 라벨을 의심한다. */
  it('위치 조회가 실패하면 찾지 못했다고 말하지 않는다', async () => {
    mount({ task: task(), location: TEMP }, [
      {
        match: (req) =>
          new URL(req.url).pathname === '/mdm/locations' &&
          new URL(req.url).searchParams.get('locationCode') !== null,
        respond: () => jsonResponse({ message: '실패' }, { status: 500 }),
      },
    ]);

    await screen.findByLabelText('임시 위치 코드 스캔');
    scan('TMP-01');

    expect(await screen.findByText('위치를 확인할 수 없습니다. 연결을 확인하세요.')).toBeTruthy();
    expect(screen.queryByText('TMP-01 위치를 이 창고에서 찾지 못했습니다')).toBeNull();
    expect(screen.getByRole('button', { name: '임시 적치 등록' }).hasAttribute('disabled')).toBe(
      true,
    );
  });

  /* 임시 위치는 수용량으로 막지 않는다. 값이 있으면 알리기만 한다. */
  it('수용량이 있어도 막지 않고 알리기만 한다', async () => {
    const user = userEvent.setup();
    mount({ task: task(), location: { ...TEMP, capacityQty: 100 } });

    await screen.findByLabelText('비고');
    await user.type(screen.getByLabelText('비고'), '통로에 둠');

    expect(screen.getByText('수용량 100 — 임시 위치라 막지 않습니다')).toBeTruthy();
    expect(screen.getByRole('button', { name: '임시 적치 등록' }).hasAttribute('disabled')).toBe(
      false,
    );
  });

  /* 사번은 인증이 아니라 귀속이다. 정상 적치와 다른 경로로 보낸다. */
  it('등록은 임시 경로로 사번과 멱등키를 실어 보낸다', async () => {
    const user = userEvent.setup();
    const seen: Request[] = [];
    mount({ task: task(), location: TEMP }, [
      {
        match: (req) =>
          new URL(req.url).pathname === '/logistics/putaway-tasks/90:complete-temporary' &&
          req.method === 'POST',
        respond: (req) => {
          seen.push(req.clone());
          return jsonResponse(task({ actualLocationId: 9 }));
        },
      },
    ]);

    await screen.findByLabelText('비고');
    await user.type(screen.getByLabelText('비고'), '통로에 둠');
    await user.click(screen.getByRole('button', { name: '임시 적치 등록' }));

    await waitFor(() => {
      expect(seen).toHaveLength(1);
    });
    expect(seen[0]?.headers.get('X-Worker-No')).toBe('900028');
    expect(seen[0]?.headers.get('Idempotency-Key')).toBeTruthy();

    const body = (await seen[0]!.json()) as {
      actualLocationId: number;
      remarks: string;
      reasonCode: unknown;
    };

    expect(body.actualLocationId).toBe(9);
    expect(body.remarks).toBe('통로에 둠');
    expect(body.reasonCode).toBeNull();
    expect(await screen.findByText('임시 적치를 기록했습니다')).toBeTruthy();
  });

  /* 이 화면은 닫히지 않는다. 정위치로 옮기는 것은 다른 화면이 한다. */
  it('정위치 이동을 여기서 하지 않는다고 말한다', async () => {
    const user = userEvent.setup();
    mount({ task: task(), location: TEMP }, [
      {
        match: (req) =>
          new URL(req.url).pathname === '/logistics/putaway-tasks/90:complete-temporary',
        respond: () => jsonResponse(task({ actualLocationId: 9 })),
      },
    ]);

    await screen.findByLabelText('비고');
    await user.type(screen.getByLabelText('비고'), '통로에 둠');
    await user.click(screen.getByRole('button', { name: '임시 적치 등록' }));

    expect(
      await screen.findByText(
        '정위치 이동은 재고 이동 화면에서 합니다. 그 화면은 아직 이 앱에 없습니다.',
      ),
    ).toBeTruthy();
  });
  const tempRoute = (seen: Request[]): StubRoute => ({
    match: (req) =>
      new URL(req.url).pathname === '/logistics/putaway-tasks/90:complete-temporary' &&
      req.method === 'POST',
    respond: (req) => {
      seen.push(req.clone());
      return jsonResponse(task({ actualLocationId: 9 }));
    },
  });

  /*
   * 장갑 낀 손은 한 번 더 누른다. 상태로 잠그면 다시 그리기 전의 연타를 놓쳐, 멱등키가 다른
   * 두 건이 담기고 서버가 흡수하지 못해 같은 임시 적치가 두 번 기록된다.
   */
  it('같은 틱에 등록을 세 번 눌러도 한 건만 나간다', async () => {
    const user = userEvent.setup();
    const seen: Request[] = [];
    mount({ task: task(), location: TEMP }, [tempRoute(seen)]);

    await screen.findByLabelText('비고');
    await user.type(screen.getByLabelText('비고'), '통로에 둠');

    const button = screen.getByRole('button', { name: '임시 적치 등록' });

    button.click();
    button.click();
    button.click();

    await screen.findByText('임시 적치를 기록했습니다');
    expect(seen).toHaveLength(1);
  });

  /* 담기지 못하면 적은 것이 어디에도 없다. 말하지 않으면 사람은 기록된 줄 안다. */
  it('담아 두지 못하면 기록되지 않았다고 말한다', async () => {
    const user = userEvent.setup();
    const seen: Request[] = [];
    mount({ task: task(), location: TEMP }, [tempRoute(seen)]);

    await screen.findByLabelText('비고');
    await user.type(screen.getByLabelText('비고'), '통로에 둠');

    held.failWrite = 'outbox';
    await user.click(screen.getByRole('button', { name: '임시 적치 등록' }));

    expect(await screen.findByText('임시 적치를 담아 두지 못했습니다')).toBeTruthy();
    expect(screen.queryByText('임시 적치를 기록했습니다')).toBeNull();
    expect(seen).toHaveLength(0);
  });
});

describe('임시 위치 적재 화면 — 같은 지시를 두 번 적지 않는다', () => {
  const temporaryRoute = (seen: Request[], fail = false): StubRoute => ({
    match: (req) =>
      new URL(req.url).pathname === '/logistics/putaway-tasks/90:complete-temporary' &&
      req.method === 'POST',
    respond: (req) => {
      seen.push(req.clone());

      if (fail) {
        throw new TypeError('Failed to fetch');
      }

      return jsonResponse(task({ actualLocationId: 9 }));
    },
  });

  /*
   * 앞 화면이 넘긴 지시는 굳은 스냅숏이다. 등록을 마친 뒤 같은 상태로 다시 들어오면 실제
   * 적치 위치가 여전히 비어 있어, 그것만 보고는 이미 끝난 지시를 또 적는다.
   */
  it('서버가 이미 적치됐다고 하면 넘겨받은 스냅숏이 비어 있어도 막는다', async () => {
    mount({ task: task(), location: TEMP }, [], { fresh: task({ actualLocationId: 9 }) });

    await screen.findByLabelText('임시 위치 코드 스캔');

    expect(await screen.findByText('이미 임시 적치되었습니다')).toBeTruthy();
    await waitFor(() => {
      expect(screen.getByRole('button', { name: '임시 적치 등록' })).toBeDisabled();
    });
  });

  /*
   * 온라인으로 등록하면 담긴 것이 큐에서 빠진다. 그때 서버 상세가 조회에 머물러 있으면
   * 다시 들어온 화면이 등록 전 값을 그대로 보고, 큐도 비어 있어 한 건이 더 나간다.
   */
  it('온라인으로 등록한 뒤 곧바로 다시 들어와도 막는다', async () => {
    const user = userEvent.setup();
    const seen: Request[] = [];
    let done = false;
    /* 앱에서 화면을 오가는 것은 캐시를 버리지 않는다. 같은 캐시로 재진입을 잰다. */
    const cache = createTestQueryClient();
    const first = mount(
      { task: task(), location: TEMP },
      [
        {
          match: (req) =>
            new URL(req.url).pathname === '/logistics/putaway-tasks/90:complete-temporary' &&
            req.method === 'POST',
          respond: (req) => {
            seen.push(req.clone());
            done = true;
            return jsonResponse(task({ actualLocationId: 9 }));
          },
        },
        {
          /* 서버는 등록을 기억한다. 기억하지 않으면 낡은 조회를 잡을 수 없다. */
          match: (req) => new URL(req.url).pathname === '/logistics/putaway-tasks/90',
          respond: () => jsonResponse(done ? task({ actualLocationId: 9 }) : task()),
        },
      ],
      {},
      cache,
    );

    await screen.findByLabelText('임시 위치 코드 스캔');
    await user.type(screen.getByLabelText('비고'), '통로에 둠');
    await user.click(screen.getByRole('button', { name: '임시 적치 등록' }));

    await screen.findByText('임시 적치를 기록했습니다');
    expect(seen).toHaveLength(1);

    first.unmount();

    mount(
      { task: task(), location: TEMP },
      [
        {
          match: (req) =>
            new URL(req.url).pathname === '/logistics/putaway-tasks/90:complete-temporary' &&
            req.method === 'POST',
          respond: (req) => {
            seen.push(req.clone());
            return jsonResponse(task({ actualLocationId: 9 }));
          },
        },
        {
          match: (req) => new URL(req.url).pathname === '/logistics/putaway-tasks/90',
          respond: () => jsonResponse(task({ actualLocationId: 9 })),
        },
      ],
      {},
      cache,
    );

    await screen.findByLabelText('임시 위치 코드 스캔');
    await user.type(screen.getByLabelText('비고'), '통로에 둠');

    expect(await screen.findByText('이미 임시 적치되었습니다')).toBeTruthy();
    await waitFor(() => {
      expect(screen.getByRole('button', { name: '임시 적치 등록' })).toBeDisabled();
    });
    expect(seen).toHaveLength(1);
  });

  /* 끊겨 있어 서버가 아직 모르는 등록이다. 큐를 보지 않으면 재진입에 한 건이 더 나간다. */
  it('담아 둔 등록이 있으면 다시 들어와도 막고 그 사실을 말한다', async () => {
    const user = userEvent.setup();
    const seen: Request[] = [];
    const first = mount({ task: task(), location: TEMP }, [temporaryRoute(seen, true)]);

    await screen.findByLabelText('임시 위치 코드 스캔');
    await user.type(screen.getByLabelText('비고'), '통로에 둠');
    await user.click(screen.getByRole('button', { name: '임시 적치 등록' }));

    await screen.findByText('임시 적치를 담아 두었습니다');
    expect(seen).toHaveLength(1);

    first.unmount();

    mount({ task: task(), location: TEMP }, [temporaryRoute(seen, true)]);

    expect(await screen.findByText('이 지시의 임시 적치를 이미 담아 두었습니다')).toBeTruthy();

    /*
     * 비고를 다시 적어 다른 이유로 잠기지 않게 한 뒤에 잰다. 비워 두면 「사유·비고가 둘 다
     * 비었다」로 잠겨, 큐를 셈에 넣지 않아도 시험이 통과한다.
     */
    await user.type(screen.getByLabelText('비고'), '통로에 둠');

    await waitFor(() => {
      expect(screen.getByRole('button', { name: '임시 적치 등록' })).toBeDisabled();
    });

    /*
     * 셸이 담긴 것을 다시 보내므로 요청 수로는 재지 못한다. 같은 멱등키면 서버가 흡수하는
     * 한 건이고, 새 키가 섞이면 두 건이 기록된다.
     */
    const keys = new Set(seen.map((each) => each.headers.get('Idempotency-Key')));

    expect(keys.size).toBe(1);
  });
});
