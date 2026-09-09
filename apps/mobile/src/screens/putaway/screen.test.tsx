import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useEffect, type ReactNode } from 'react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  createStubFetch,
  jsonResponse,
  renderWithProviders,
  type StubRoute,
} from '../../test/api-harness';
import { useWorkerSession } from '../../patterns/worker-session';
import { PutawayScreen } from './screen';

const store = vi.hoisted(() => new Map<string, string>());
/** 소리는 화면에 남지 않는다. 울렸는지를 재려면 세는 수밖에 없다. */
const tone = vi.hoisted(() => ({ played: 0 }));

vi.mock('../../patterns/error-tone', () => ({
  playErrorTone: () => {
    tone.played += 1;
  },
}));

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
  warehouseManagementLevelCode: 'ZONE',
  priorityNo: 1,
  statusCode: 'PENDING',
  ...overrides,
});

const LOT_NO = 'RM-LOT-0007';

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

const OTHER = location({ locationId: 9, locationCode: 'B-02-01', locationName: '자재 B열' });
const FROM = location({ locationId: 1, locationCode: 'DOCK-1', locationName: '입하장' });

interface Options {
  tasks?: unknown[];
  locations?: unknown[];
  workers?: unknown[];
  tasksStatus?: number;
  /** 지금 그 위치에 들어 있는 것. 혼적·수용량 판정의 근거다. */
  balances?: unknown[];
}

const routes = (options: Options = {}): StubRoute[] => [
  {
    match: (req) => new URL(req.url).pathname === '/mdm/workers',
    respond: () =>
      jsonResponse({
        items: options.workers ?? [
          {
            workerId: 77,
            workerNo: '900028',
            workerName: '김철수',
            businessUnitId: 1,
            plantId: 1,
            statusCode: 'ACTIVE',
          },
        ],
        page,
      }),
  },
  {
    match: (req) => new URL(req.url).pathname === '/logistics/putaway-tasks',
    respond: () =>
      options.tasksStatus === undefined
        ? jsonResponse({ items: options.tasks ?? [task()], page })
        : jsonResponse({ message: '실패' }, { status: options.tasksStatus }),
  },
  {
    match: (req) => new URL(req.url).pathname === '/mdm/locations',
    respond: (req) => {
      const code = new URL(req.url).searchParams.get('locationCode');
      const all = options.locations ?? [location(), OTHER, FROM];

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
    match: (req) => new URL(req.url).pathname === '/mdm/uoms',
    respond: () => jsonResponse({ items: [{ uomId: 9, uomCode: 'EA' }], page }),
  },
  {
    match: (req) => new URL(req.url).pathname === '/mdm/items',
    respond: () =>
      jsonResponse({
        items: [{ itemId: 31, itemCode: 'RM-1001', itemName: '수지A', fifoPolicyCode: 'FEFO' }],
        page,
      }),
  },
  {
    match: (req) => new URL(req.url).pathname === '/trace/lots/4',
    respond: () =>
      jsonResponse({
        lot: { lotId: 4, lotNo: LOT_NO, itemId: 31, lotTypeCode: 'MATERIAL' },
        externalIdentifiers: [],
        holds: [],
      }),
  },
  {
    match: (req) => new URL(req.url).pathname === '/inventory/balances',
    respond: () => jsonResponse({ items: options.balances ?? [], page }),
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

/** 임시 적치 화면이 무엇을 받는지만 비춘다. 인계 내용은 DOM 에 남지 않는다. */
const HandoffProbe = () => {
  const routed = useLocation();
  const state = routed.state as { location?: unknown } | null;

  return <p>{state !== null && 'location' in state ? '위치 넘김' : '위치 안 넘김'}</p>;
};

const mount = (extra: StubRoute[] = [], options: Options = {}) =>
  renderWithProviders(
    <MemoryRouter>
      <SignedIn>
        <Routes>
          <Route path="/" element={<PutawayScreen />} />
          <Route path="/temporary-putaway" element={<HandoffProbe />} />
        </Routes>
      </SignedIn>
    </MemoryRouter>,
    { fetch: createStubFetch([...extra, ...routes(options)]) },
  );

const into = (field: HTMLInputElement, value: string) => {
  field.focus();
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(field, value);
  field.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertFromPaste' }));
};

const scan = (code: string) => {
  into(screen.getByLabelText(/위치 코드 스캔/) as HTMLInputElement, code);
};

/** 위치가 통과해야 이 칸이 선다. 설계가 스캔을 두 단계로 두었다. */
const scanLot = async (lotNo: string) => {
  into((await screen.findByLabelText(/LOT 라벨 스캔/)) as HTMLInputElement, lotNo);
};

const chooseTask = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(await screen.findByRole('button', { name: /RM-1001/ }));
  await screen.findByLabelText(/위치 코드 스캔/);
};

/** 위치까지 통과시키고 LOT 까지 맞춰 적치 단추를 여는 데까지. */
const readyToRecord = async (user: ReturnType<typeof userEvent.setup>) => {
  await chooseTask(user);
  scan('A-01-03');
  await screen.findByText('권장 위치와 같습니다');
  await scanLot(LOT_NO);
  await waitFor(() => {
    expect(screen.getByRole('button', { name: '이 지시 적치' })).not.toBeDisabled();
  });
};

beforeEach(() => {
  held.failWrite = null;
  tone.played = 0;
  store.clear();
  localStorage.clear();
});

describe('적치·입고 완료 화면', () => {
  /*
   * 비우고 물으면 남의 지시까지 온다. 끝낸 지시까지 함께 오면 같은 자리를 두 번 다녀온다.
   */
  it('담당자와 적치 대기 상태로 좁혀 묻는다', async () => {
    const seen: URL[] = [];
    mount([
      {
        match: (req) => new URL(req.url).pathname === '/logistics/putaway-tasks',
        respond: (req) => {
          seen.push(new URL(req.url));
          return jsonResponse({ items: [task()], page });
        },
      },
    ]);

    await screen.findByRole('button', { name: /RM-1001/ });

    expect(seen[0]?.searchParams.get('assignedWorkerId')).toBe('77');
    expect(seen[0]?.searchParams.get('statusCode')).toBe('PENDING');
  });

  /* 지시 번호는 라벨에 없다. 품목과 수량이 있어야 손에 든 것과 눈으로 맞춘다. */
  it('목록에 품목과 수량을 보인다', async () => {
    mount();

    expect(await screen.findByText(/RM-1001/)).toBeTruthy();
    expect(screen.getByText(/120 EA/)).toBeTruthy();
  });

  it('사번의 작업자를 찾지 못하면 목록을 열지 않는다', async () => {
    mount([], { workers: [] });

    expect(await screen.findByText('900028 사번의 작업자를 찾지 못했습니다')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /RM-1001/ })).toBeNull();
  });

  /* 확인하지 못한 것을 지시가 없는 것으로 말하지 않는다. */
  it('지시 조회 실패를 지시 없음으로 말하지 않는다', async () => {
    mount([], { tasksStatus: 500 });

    expect(
      await screen.findByText('적치 지시를 확인할 수 없습니다. 연결을 확인하세요.'),
    ).toBeTruthy();
    expect(screen.queryByText('받은 적치 지시가 없습니다')).toBeNull();
  });

  it('지시를 고르면 권장 위치를 코드로 보인다', async () => {
    const user = userEvent.setup();
    mount();
    await chooseTask(user);

    expect(await screen.findByText('권장 위치 A-01-03')).toBeTruthy();
  });

  /*
   * 위치만 맞으면 통과시키면 손에 든 것이 그 지시의 자재인지 아무도 확인하지 않는다. 설계가
   * 스캔을 두 단계로 둔 이유다.
   */
  it('위치가 통과해야 LOT 을 묻는다', async () => {
    const user = userEvent.setup();
    mount();
    await chooseTask(user);

    expect(screen.queryByLabelText(/LOT 라벨 스캔/)).toBeNull();

    scan('A-01-03');
    await screen.findByText('권장 위치와 같습니다');

    expect(await screen.findByLabelText(/LOT 라벨 스캔/)).toBeTruthy();
  });

  it('권장 위치와 지시 LOT 이 맞으면 적치를 연다', async () => {
    const user = userEvent.setup();
    mount();
    await readyToRecord(user);

    expect(screen.getByText(`스캔됨 ${LOT_NO}`)).toBeTruthy();
  });

  /* 다른 자재를 얹으면 그 뒤로 재고가 있다는 자리에 없다. */
  it('지시의 LOT 이 아니면 적치할 수 없다', async () => {
    const user = userEvent.setup();
    mount();
    await chooseTask(user);

    scan('A-01-03');
    await screen.findByText('권장 위치와 같습니다');
    await scanLot('RM-LOT-9999');

    expect(await screen.findByText('이 지시의 LOT 이 아닙니다')).toBeTruthy();
    expect(screen.getByRole('button', { name: '이 지시 적치' })).toBeDisabled();
  });

  /* 다른 곳에 두면 다음 사람이 찾지 못한다. 서버도 막는다. */
  it('권장이 아닌 위치를 스캔하면 막고 어디가 권장인지 말한다', async () => {
    const user = userEvent.setup();
    mount();
    await chooseTask(user);

    scan('B-02-01');

    expect(await screen.findByText('권장 위치 A-01-03 가 아닙니다')).toBeTruthy();
    expect(screen.queryByLabelText(/LOT 라벨 스캔/)).toBeNull();
  });

  /*
   * 임시 적치로 넘어가는 이유는 이 자리에 둘 수 없어서다. 그 자리를 함께 넘기면 다음 화면이
   * 임시 목적지로 고른 채 열려, 막혔던 그 자리에 임시 적치가 기록된다.
   */
  it('임시 적치로 넘길 때 막힌 위치는 넘기지 않는다', async () => {
    const user = userEvent.setup();
    mount();
    await chooseTask(user);

    scan('B-02-01');
    await screen.findByText('권장 위치 A-01-03 가 아닙니다');

    await user.click(
      screen.getByRole('link', { name: '임시로 두어야 하면 임시 위치 적재로 갑니다' }),
    );

    expect(await screen.findByText('위치 안 넘김')).toBeTruthy();
  });

  /*
   * 장갑 낀 손은 단말을 허리에 매달고 읽는다. 화면에만 적으면 사람은 통과한 줄 알고 다음
   * 동작으로 넘어간다(공유계약 D-2 · §6).
   */
  it('막힌 위치를 스캔하면 소리로도 알린다', async () => {
    const user = userEvent.setup();
    mount();
    await chooseTask(user);

    scan('B-02-01');
    await screen.findByText('권장 위치 A-01-03 가 아닙니다');

    expect(tone.played).toBeGreaterThan(0);
  });

  it('권장 위치를 스캔하면 소리를 내지 않는다', async () => {
    const user = userEvent.setup();
    mount();
    await chooseTask(user);

    scan('A-01-03');
    await screen.findByText('권장 위치와 같습니다');

    expect(tone.played).toBe(0);
  });

  it('이 창고에 없는 코드를 스캔하면 찾지 못했다고 말한다', async () => {
    const user = userEvent.setup();
    mount();
    await chooseTask(user);

    scan('Z-99-99');

    expect(await screen.findByText('Z-99-99 위치를 이 창고에서 찾지 못했습니다')).toBeTruthy();
  });

  /* 규칙이 없다고 막으면 미등록 품목이 적치 자체를 못 해 현장이 선다. */
  it('권장이 없으면 확인을 받고 통과시킨다', async () => {
    const user = userEvent.setup();
    mount([], { tasks: [task({ recommendedLocationId: null })] });
    await chooseTask(user);

    scan('B-02-01');

    expect(await screen.findByText('관리 위치가 없는 품목입니다. 여기 적치합니까?')).toBeTruthy();
    expect(screen.queryByLabelText(/LOT 라벨 스캔/)).toBeNull();

    await user.click(screen.getByRole('button', { name: '여기 적치합니다' }));

    expect(await screen.findByLabelText(/LOT 라벨 스캔/)).toBeTruthy();
  });

  /*
   * 한 품목만 받는 자리에 얹으면 그 재고는 다음 사람이 찾지 못한다. 안내로만 두면 사람은
   * 통과로 읽는다.
   */
  it('한 품목만 받는 자리에 다른 품목이 있으면 막는다', async () => {
    const user = userEvent.setup();
    mount([], {
      locations: [location({ allowMixedItem: false }), FROM],
      balances: [{ itemId: 99, lotId: 8, onHandQty: 40, groupBy: 'LOT', ownershipTypeCode: 'OWN' }],
    });
    await chooseTask(user);

    scan('A-01-03');

    expect(await screen.findByText('이 위치는 단일 품목만 보관합니다')).toBeTruthy();
    expect(screen.queryByLabelText(/LOT 라벨 스캔/)).toBeNull();
  });

  /*
   * 잔액을 받지 못한 것은 부딪치는 것이 없다는 뜻이 아니다. 빈 목록으로 판정하면 혼적이 막힌
   * 자리가 조회 실패 한 번에 열린다.
   */
  it('위치에 무엇이 있는지 확인하지 못하면 다음으로 넘기지 않는다', async () => {
    const user = userEvent.setup();
    mount([
      {
        match: (req) => new URL(req.url).pathname === '/inventory/balances',
        respond: () => jsonResponse({ message: '실패' }, { status: 500 }),
      },
    ]);
    await chooseTask(user);

    scan('A-01-03');
    await screen.findByText('A-01-03 자재 A열');

    expect(screen.queryByLabelText(/LOT 라벨 스캔/)).toBeNull();
  });

  /* 자리는 유한하다. 넘겨서 두는 판단은 자리를 보는 사람이 하되, 넘는다는 것은 알려야 한다. */
  it('수용량을 넘기면 지금 있는 양과 함께 알린다', async () => {
    const user = userEvent.setup();
    mount([], {
      locations: [location({ capacityQty: 200 }), OTHER, FROM],
      balances: [
        { itemId: 31, lotId: 4, onHandQty: 100, groupBy: 'LOT', ownershipTypeCode: 'OWN' },
      ],
    });
    await chooseTask(user);

    scan('A-01-03');

    expect(await screen.findByText('수용량 200 · 현재 100 + 120')).toBeTruthy();
  });

  /*
   * 관리하는 창고에서 목록 선택을 함께 열면 라벨을 읽지 않고 화면만 보고 적치가 끝난다.
   * 관리하지 않는 창고에는 스캔할 라벨이 없어 반대로 목록만 연다.
   */
  it('위치를 관리하는 창고는 스캔만 연다', async () => {
    const user = userEvent.setup();
    mount();
    await chooseTask(user);

    expect(screen.queryByRole('combobox', { name: /적치 위치/ })).toBeNull();
  });

  it('위치를 관리하지 않는 창고는 목록으로 고른다', async () => {
    const user = userEvent.setup();
    mount([], {
      tasks: [task({ warehouseManagementLevelCode: 'WAREHOUSE', recommendedLocationId: null })],
    });
    await user.click(await screen.findByRole('button', { name: /RM-1001/ }));

    expect(await screen.findByRole('combobox', { name: /적치 위치/ })).toBeTruthy();
    expect(screen.queryByLabelText(/위치 코드 스캔/)).toBeNull();
  });

  /* 사번은 인증이 아니라 귀속이다. 없으면 서버가 요청 자체를 받지 않는다. */
  it('완료는 실제 위치와 업무 기준일을 실어 지시 경로로 보낸다', async () => {
    const user = userEvent.setup();
    const seen: Request[] = [];
    mount([
      {
        match: (req) =>
          new URL(req.url).pathname === '/logistics/putaway-tasks/90:complete' &&
          req.method === 'POST',
        respond: (req) => {
          seen.push(req.clone());
          return jsonResponse(task({ actualLocationId: 5 }));
        },
      },
    ]);
    await readyToRecord(user);
    await user.click(screen.getByRole('button', { name: '이 지시 적치' }));

    await waitFor(() => {
      expect(seen).toHaveLength(1);
    });
    expect(seen[0]?.headers.get('X-Worker-No')).toBe('900028');
    expect(seen[0]?.headers.get('Idempotency-Key')).toBeTruthy();

    const body = (await seen[0]!.json()) as {
      actualLocationId: number;
      confirmedNoRule: boolean;
      businessDate: string;
    };

    expect(body.actualLocationId).toBe(5);
    expect(body.confirmedNoRule).toBe(false);
    expect(body.businessDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(await screen.findByText(`${LOT_NO} → A-01-03 120 EA`)).toBeTruthy();
  });

  /*
   * 연속 작업이다. 한 건마다 화면이 끝나면 다음 지시를 고르러 매번 되돌아와야 한다. 설계는
   * 건별로 저장하고 마지막에 한 번 마친다.
   */
  it('한 건을 적치하면 목록에 쌓고 다음 지시를 고르게 한다', async () => {
    const user = userEvent.setup();
    const seen: Request[] = [];
    mount([completeRoute(seen)]);
    await readyToRecord(user);

    await user.click(screen.getByRole('button', { name: '이 지시 적치' }));

    expect(await screen.findByText('적치됨 1건')).toBeTruthy();
    expect(await screen.findByRole('button', { name: /RM-1001/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: '적치 완료' })).not.toBeDisabled();
  });

  /*
   * 목록을 그대로 두면 방금 끝낸 지시가 그 자리에 서 있다. 다시 골라 같은 자리에 두 번
   * 적치하면 재고가 두 번 움직인다.
   */
  it('적치를 마치면 지시 목록을 다시 읽는다', async () => {
    const user = userEvent.setup();
    const asked: URL[] = [];
    mount([
      completeRoute([]),
      {
        match: (req) => new URL(req.url).pathname === '/logistics/putaway-tasks',
        respond: (req) => {
          asked.push(new URL(req.url));
          return jsonResponse({ items: asked.length > 1 ? [] : [task()], page });
        },
      },
    ]);
    await readyToRecord(user);

    await user.click(screen.getByRole('button', { name: '이 지시 적치' }));

    expect(await screen.findByText('받은 적치 지시가 없습니다')).toBeTruthy();
  });

  /* 마치는 단추가 처음부터 열려 있으면 아무것도 안 하고 나간 것이 마친 것으로 보인다. */
  it('적치한 건이 없으면 마칠 수 없다', async () => {
    mount();

    await screen.findByRole('button', { name: /RM-1001/ });

    expect(screen.getByRole('button', { name: '적치 완료' })).toBeDisabled();
  });
  const completeRoute = (seen: Request[]): StubRoute => ({
    match: (req) =>
      new URL(req.url).pathname === '/logistics/putaway-tasks/90:complete' && req.method === 'POST',
    respond: (req) => {
      seen.push(req.clone());
      return jsonResponse(task({ actualLocationId: 5 }));
    },
  });

  /*
   * 장갑 낀 손은 한 번 더 누른다. 상태로 잠그면 다시 그리기 전의 연타를 놓쳐, 멱등키가 다른
   * 두 건이 담기고 서버가 흡수하지 못해 같은 적치가 두 번 기록된다.
   */
  it('같은 틱에 완료를 세 번 눌러도 한 건만 나간다', async () => {
    const user = userEvent.setup();
    const seen: Request[] = [];
    mount([completeRoute(seen)]);
    await readyToRecord(user);

    const button = screen.getByRole('button', { name: '이 지시 적치' });

    button.click();
    button.click();
    button.click();

    await screen.findByText('적치됨 1건');
    expect(seen).toHaveLength(1);
  });

  /* 담기지 못하면 적은 것이 어디에도 없다. 말하지 않으면 사람은 기록된 줄 안다. */
  it('담아 두지 못하면 기록되지 않았다고 말한다', async () => {
    const user = userEvent.setup();
    const seen: Request[] = [];
    mount([completeRoute(seen)]);
    await readyToRecord(user);

    held.failWrite = 'outbox';
    await user.click(screen.getByRole('button', { name: '이 지시 적치' }));

    expect(await screen.findByText('적치를 저장하지 못했습니다')).toBeTruthy();
    expect(screen.queryByText('적치됨 1건')).toBeNull();
    expect(seen).toHaveLength(0);
  });
});
