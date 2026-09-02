import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useEffect, type ReactNode } from 'react';
import { MemoryRouter } from 'react-router';
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

const OTHER = location({ locationId: 9, locationCode: 'B-02-01', locationName: '자재 B열' });
const FROM = location({ locationId: 1, locationCode: 'DOCK-1', locationName: '입하장' });

interface Options {
  tasks?: unknown[];
  locations?: unknown[];
  workers?: unknown[];
  tasksStatus?: number;
}

const routes = (options: Options = {}): StubRoute[] => [
  {
    match: (req) => new URL(req.url).pathname === '/mdm/workers',
    respond: () =>
      jsonResponse({
        items: options.workers ?? [
          { workerId: 77, workerNo: '900028', workerName: '김철수', businessUnitId: 1, plantId: 1, statusCode: 'ACTIVE' },
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

const mount = (extra: StubRoute[] = [], options: Options = {}) =>
  renderWithProviders(
    <MemoryRouter>
      <SignedIn>
        <PutawayScreen />
      </SignedIn>
    </MemoryRouter>,
    { fetch: createStubFetch([...extra, ...routes(options)]) },
  );

const scan = (code: string) => {
  const field = screen.getByLabelText('위치 코드 스캔') as HTMLInputElement;
  field.focus();
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(field, code);
  field.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertFromPaste' }));
};

const chooseTask = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(await screen.findByRole('button', { name: /PT-2026-0007/ }));
  await screen.findByLabelText('위치 코드 스캔');
};

beforeEach(() => {
  store.clear();
  localStorage.clear();
});

describe('적치·입고 완료 화면', () => {
  /* 비우고 물으면 남의 지시까지 온다. 사번으로 작업자를 먼저 푼다. */
  it('사번으로 작업자를 풀어 그 사람의 지시만 묻는다', async () => {
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

    await screen.findByRole('button', { name: /PT-2026-0007/ });

    expect(seen[0]?.searchParams.get('assignedWorkerId')).toBe('77');
    expect(seen[0]?.searchParams.get('statusCode')).toBeNull();
  });

  it('사번의 작업자를 찾지 못하면 목록을 열지 않는다', async () => {
    mount([], { workers: [] });

    expect(await screen.findByText('900028 사번의 작업자를 찾지 못했습니다')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /PT-2026-0007/ })).toBeNull();
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

  it('권장 위치를 스캔하면 같다고 말하고 완료를 연다', async () => {
    const user = userEvent.setup();
    mount();
    await chooseTask(user);

    scan('A-01-03');

    expect(await screen.findByText('권장 위치와 같습니다')).toBeTruthy();
    expect(screen.getByRole('button', { name: '적치 완료' }).hasAttribute('disabled')).toBe(false);
  });

  /* 다른 곳에 두면 다음 사람이 찾지 못한다. 서버도 막는다. */
  it('권장이 아닌 위치를 스캔하면 막고 어디가 권장인지 말한다', async () => {
    const user = userEvent.setup();
    mount();
    await chooseTask(user);

    scan('B-02-01');

    expect(await screen.findByText('권장 위치 A-01-03 가 아닙니다')).toBeTruthy();
    expect(screen.getByRole('button', { name: '적치 완료' }).hasAttribute('disabled')).toBe(true);
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
    expect(screen.getByRole('button', { name: '적치 완료' }).hasAttribute('disabled')).toBe(true);

    await user.click(screen.getByRole('button', { name: '여기 적치합니다' }));

    expect(screen.getByRole('button', { name: '적치 완료' }).hasAttribute('disabled')).toBe(false);
  });

  /* 지금 무엇이 들어 있는지는 이 화면이 알지 못한다. 위반이라고 말하지 않는다. */
  it('한 품목만 받는 위치는 그 사실만 말하고 막지 않는다', async () => {
    const user = userEvent.setup();
    mount([], { locations: [location({ allowMixedItem: false }), FROM] });
    await chooseTask(user);

    scan('A-01-03');

    expect(
      await screen.findByText('이 위치는 단일 품목만 보관합니다. 다른 품목이 있으면 서버가 막습니다.'),
    ).toBeTruthy();
    expect(screen.getByRole('button', { name: '적치 완료' }).hasAttribute('disabled')).toBe(false);
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
    await chooseTask(user);

    scan('A-01-03');
    await screen.findByText('권장 위치와 같습니다');
    await user.click(screen.getByRole('button', { name: '적치 완료' }));

    await waitFor(() => {
      expect(seen).toHaveLength(1);
    });
    expect(seen[0]?.headers.get('X-Worker-No')).toBe('900028');
    expect(seen[0]?.headers.get('Idempotency-Key')).toBeTruthy();

    
    const body = (await seen[0]!.json()) as { actualLocationId: number; confirmedNoRule: boolean; businessDate: string };

    expect(body.actualLocationId).toBe(5);
    expect(body.confirmedNoRule).toBe(false);
    expect(body.businessDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(await screen.findByText('적치를 기록했습니다')).toBeTruthy();
  });
});
