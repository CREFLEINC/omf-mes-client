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
import { RecycleEntryScreen } from './screen';

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

const CODE = 'ABC-123';

const itemRow = (overrides: Record<string, unknown> = {}) => ({
  itemId: 31,
  itemCode: CODE,
  itemName: '원자재',
  fifoPolicyCode: 'FIFO',
  mesCategoryCode: 'RECYCLED',
  baseUomId: 9,
  isActive: true,
  ...overrides,
});

interface Options {
  items?: unknown[];
  warehouses?: unknown[];
  locations?: unknown[];
}

const routes = (options: Options = {}): StubRoute[] => [
  {
    match: (req) => new URL(req.url).pathname === '/mdm/items',
    respond: () =>
      jsonResponse({
        items: options.items ?? [itemRow({ itemId: 30, mesCategoryCode: 'NEW' }), itemRow()],
        page,
      }),
  },
  {
    match: (req) => new URL(req.url).pathname === '/mdm/warehouses',
    respond: () =>
      jsonResponse({
        items: options.warehouses ?? [{ warehouseId: 2, warehouseName: '합성 자재창고' }],
        page,
      }),
  },
  {
    match: (req) => new URL(req.url).pathname === '/mdm/locations',
    respond: () =>
      jsonResponse({
        items: options.locations ?? [
          { locationId: 5, warehouseId: 2, locationCode: 'A-01-03', locationName: '자재 A열' },
        ],
        page,
      }),
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
        <RecycleEntryScreen />
      </SignedIn>
    </MemoryRouter>,
    { fetch: createStubFetch([...extra, ...routes(options)]) },
  );

const entryRoute = (seen: Request[], lotNo = '0001234500000012002607310001230007'): StubRoute => ({
  match: (req) =>
    new URL(req.url).pathname === '/logistics/recycle-entries' && req.method === 'POST',
  respond: (req) => {
    seen.push(req.clone());

    return jsonResponse(
      { recycleEntryId: 1, lotId: 4, lotNo, itemId: 31, quantity: 12.5 },
      {
        status: 201,
      },
    );
  },
});

const findItem = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.type(await screen.findByLabelText('찾기'), CODE);
  await user.click(screen.getByRole('button', { name: '찾기' }));
};

const fill = async (user: ReturnType<typeof userEvent.setup>, qty: string) => {
  await user.click(await screen.findByRole('combobox', { name: '창고' }));
  await user.click(await screen.findByRole('option', { name: /합성 자재창고/ }));
  await user.click(await screen.findByRole('combobox', { name: '위치' }));
  await user.click(await screen.findByRole('option', { name: /A-01-03/ }));
  await user.type(await screen.findByLabelText('수량'), qty);
};

beforeEach(() => {
  store.clear();
  localStorage.clear();
  held.failWrite = null;
});

describe('재생재 등록 화면', () => {
  /*
   * 품목코드 하나에 행이 둘 온다. 신재를 잡으면 신재로 재고가 늘고 되돌릴 자리가 없다.
   */
  it('같은 코드로 온 신재와 재생재 중 재생재를 고른다', async () => {
    const user = userEvent.setup();
    const seen: Request[] = [];
    mount([entryRoute(seen)]);
    await findItem(user);

    expect(await screen.findByText('ABC-123 원자재')).toBeTruthy();

    await fill(user, '12.5');
    await user.click(screen.getByRole('button', { name: '재생재 등록' }));

    await waitFor(() => {
      expect(seen).toHaveLength(1);
    });

    const body = (await seen[0]!.json()) as { itemId: number };

    expect(body.itemId).toBe(31);
  });

  /* 이 화면은 품목을 만들지 않는다. 없으면 어디서 만드는지 알린다. */
  it('재생재 품목 행이 없으면 등록할 수 없다고 말한다', async () => {
    const user = userEvent.setup();
    mount([], { items: [itemRow({ itemId: 30, mesCategoryCode: 'NEW' })] });
    await findItem(user);

    expect(await screen.findByText('등록되지 않은 재생재 품목입니다')).toBeTruthy();
    expect(screen.getByText('재생재 품목 행을 관리웹에서 먼저 등록해야 합니다.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: '재생재 등록' })).toBeNull();
  });

  /* 번호를 화면이 정하면 오프라인 두 단말이 같은 번호를 만든다. 저장 전에 그 사실을 말한다. */
  it('저장 전에는 번호가 아직 없다고 말한다', async () => {
    const user = userEvent.setup();
    mount();
    await findItem(user);
    await screen.findByText('ABC-123 원자재');

    expect(screen.getByText('자재 묶음 번호는 저장 후 정해집니다')).toBeTruthy();
  });

  /* 단위는 품목의 기본 단위를 서버가 쓴다. 화면은 읽기만 하고 보내지 않는다. */
  it('품목의 기본 단위를 읽기 전용으로 보이고 싣지 않는다', async () => {
    const user = userEvent.setup();
    const seen: Request[] = [];
    mount([entryRoute(seen)]);
    await findItem(user);

    expect(await screen.findByText('단위 EA')).toBeTruthy();

    await fill(user, '12.5');
    await user.click(screen.getByRole('button', { name: '재생재 등록' }));

    await waitFor(() => {
      expect(seen).toHaveLength(1);
    });
    expect(await seen[0]!.json()).not.toHaveProperty('uomId');
  });

  it('저장 후에 서버가 매긴 번호를 보인다', async () => {
    const user = userEvent.setup();
    const seen: Request[] = [];
    mount([entryRoute(seen, 'SYN-LOT-0001')]);
    await findItem(user);
    await screen.findByText('ABC-123 원자재');
    await fill(user, '12.5');

    await user.click(screen.getByRole('button', { name: '재생재 등록' }));

    expect(await screen.findByText('재생재를 등록했습니다')).toBeTruthy();
    expect(screen.getByText('자재 묶음 SYN-LOT-0001')).toBeTruthy();
  });

  /* 버려지는 것이 아니라 미뤄지는 것임이 드러나야 한다. */
  it('오프라인이면 미뤄진다는 것과 번호가 나중에 정해진다는 것을 말한다', async () => {
    const user = userEvent.setup();
    mount([
      {
        match: (req) =>
          new URL(req.url).pathname === '/logistics/recycle-entries' && req.method === 'POST',
        respond: () => {
          throw new TypeError('Failed to fetch');
        },
      },
    ]);
    await findItem(user);
    await screen.findByText('ABC-123 원자재');
    await fill(user, '12.5');

    await user.click(screen.getByRole('button', { name: '재생재 등록' }));

    expect(await screen.findByText('재생재 등록을 담아 두었습니다')).toBeTruthy();
    expect(screen.getByText('연결되면 전송됩니다. 번호는 전송 후 정해집니다.')).toBeTruthy();
    expect(screen.getByText('라벨은 번호가 정해진 뒤에 인쇄할 수 있습니다')).toBeTruthy();
  });

  it('수량이 0 이하면 등록을 막고 이유를 말한다', async () => {
    const user = userEvent.setup();
    mount();
    await findItem(user);
    await screen.findByText('ABC-123 원자재');
    await fill(user, '0');

    expect(await screen.findByText('수량은 0보다 커야 합니다')).toBeTruthy();
    expect(screen.getByRole('button', { name: '재생재 등록' })).toBeDisabled();
  });

  /* 위치는 비울 수 없다. 서버도 400 으로 막지만 보내기 전에 알아야 한다. */
  it('위치를 고르지 않으면 등록을 막는다', async () => {
    const user = userEvent.setup();
    mount();
    await findItem(user);
    await screen.findByText('ABC-123 원자재');

    await user.click(await screen.findByRole('combobox', { name: '창고' }));
    await user.click(await screen.findByRole('option', { name: /합성 자재창고/ }));
    await user.type(await screen.findByLabelText('수량'), '12.5');

    expect(screen.getByRole('button', { name: '재생재 등록' })).toBeDisabled();
  });

  /*
   * 장갑 낀 손은 한 번 더 누른다. 상태로 잠그면 다시 그리기 전의 연타를 놓쳐, 멱등키가 다른
   * 두 건이 담기고 서버가 흡수하지 못해 재고가 두 번 는다.
   */
  it('같은 틱에 등록을 세 번 눌러도 한 건만 나간다', async () => {
    const user = userEvent.setup();
    const seen: Request[] = [];
    mount([entryRoute(seen)]);
    await findItem(user);
    await screen.findByText('ABC-123 원자재');
    await fill(user, '12.5');

    const button = screen.getByRole('button', { name: '재생재 등록' });

    button.click();
    button.click();
    button.click();

    await screen.findByText('재생재를 등록했습니다');
    expect(seen).toHaveLength(1);
  });

  /* 담기지 못하면 적은 것이 어디에도 없다. 말하지 않으면 사람은 등록된 줄 안다. */
  it('담아 두지 못하면 등록되지 않았다고 말한다', async () => {
    const user = userEvent.setup();
    const seen: Request[] = [];
    mount([entryRoute(seen)]);
    await findItem(user);
    await screen.findByText('ABC-123 원자재');
    await fill(user, '12.5');

    held.failWrite = 'outbox';
    await user.click(screen.getByRole('button', { name: '재생재 등록' }));

    expect(await screen.findByText('재생재 등록을 담아 두지 못했습니다')).toBeTruthy();
    expect(screen.queryByText('재생재를 등록했습니다')).toBeNull();
    expect(seen).toHaveLength(0);
  });

  /* 사번은 인증이 아니라 귀속이다. 없으면 서버가 요청 자체를 받지 않는다. */
  it('등록은 사번과 멱등키를 실어 보낸다', async () => {
    const user = userEvent.setup();
    const seen: Request[] = [];
    mount([entryRoute(seen)]);
    await findItem(user);
    await screen.findByText('ABC-123 원자재');
    await fill(user, '12.5');

    await user.click(screen.getByRole('button', { name: '재생재 등록' }));

    await waitFor(() => {
      expect(seen).toHaveLength(1);
    });
    expect(seen[0]?.headers.get('X-Worker-No')).toBe('900028');
    expect(seen[0]?.headers.get('Idempotency-Key')).toBeTruthy();
  });
});
