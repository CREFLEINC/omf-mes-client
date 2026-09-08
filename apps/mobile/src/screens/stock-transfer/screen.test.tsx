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
import { StockTransferScreen } from './screen';

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

const page = { page: 1, size: 20, total: 1, totalElements: 1, totalPages: 1 };

const LOT_NO = 'MLOT-2026-0001';
const TO_CODE = 'R-01-02';

interface Options {
  /** 이 LOT 이 보류 중이라고 답한다. */
  lotHeld?: boolean;
  /** 재고를 비워 답한다 - 옮길 것이 없는 자리다. */
  noStock?: boolean;
  /** 도착 위치가 출발과 같은 창고에 있다고 답한다. */
  sameWarehouse?: boolean;
  /** 반출됐으나 도착하지 않은 이동을 하나 답한다. */
  unfinished?: boolean;
  /** 보낸 요청을 모은다. 한 건인지는 요청 수가 아니라 멱등키가 하나인지로 잰다. */
  seen?: Request[];
  /** 조회가 어떤 축을 실었는지 보려면 응답이 아니라 요청을 봐야 한다. */
  asked?: string[];
}

const routes = (options: Options = {}): StubRoute[] => [
  {
    match: (req) => new URL(req.url).pathname === '/mdm/warehouses',
    respond: () =>
      jsonResponse({
        items: [
          {
            warehouseId: 1001,
            plantId: 1001,
            businessUnitId: 1001,
            warehouseCode: 'WH-01',
            warehouseName: '자재창고',
            isActive: true,
          },
          {
            warehouseId: 1003,
            plantId: 1001,
            businessUnitId: 1001,
            warehouseCode: 'WH-03',
            warehouseName: '불량창고',
            isActive: true,
          },
        ],
        page,
      }),
  },
  {
    match: (req) => new URL(req.url).pathname === '/mdm/locations',
    respond: (req) => {
      const warehouseId = Number(new URL(req.url).searchParams.get('warehouseId'));

      return jsonResponse({
        items: [
          {
            locationId: 3005,
            warehouseId,
            locationCode: TO_CODE,
            locationName: '반품 구역 02',
            isActive: true,
          },
        ],
        page,
      });
    },
  },
  {
    match: (req) => new URL(req.url).pathname === '/trace/lots',
    respond: () =>
      jsonResponse({
        items: [
          {
            lotId: 8001,
            lotNo: LOT_NO,
            itemId: 2002,
            lotTypeCode: 'MATERIAL',
            plantId: 1001,
            initialQty: 120,
            uomId: 1001,
            statusCode: 'ACTIVE',
            held: options.lotHeld === true,
          },
        ],
        page,
      }),
  },
  {
    match: (req) => new URL(req.url).pathname === '/inventory/balances',
    respond: () =>
      jsonResponse({
        items:
          options.noStock === true
            ? []
            : [
                {
                  groupBy: 'LOCATION',
                  inventoryBalanceId: 9001,
                  plantId: 1001,
                  businessUnitId: 1001,
                  warehouseId: options.sameWarehouse === true ? 1003 : 1001,
                  locationId: 3001,
                  itemId: 2002,
                  lotId: 8001,
                  onHandQty: 120,
                  reservedQty: 0,
                  pickedQty: 0,
                  blockedQty: 0,
                  uomId: 1001,
                },
              ],
        page,
      }),
  },
  {
    match: (req) => new URL(req.url).pathname === '/logistics/stock-transfers',
    respond: (req) => {
      if (req.method === 'GET') {
        options.asked?.push(req.url);
      }

      if (req.method === 'POST') {
        options.seen?.push(req.clone());
        return jsonResponse({ stockTransferId: 7001 }, { status: 201 });
      }

      return jsonResponse({
        items:
          options.unfinished === true
            ? [
                {
                  stockTransferId: 7001,
                  stockTransferNo: 'ST-2026-000001',
                  transferTypeCode: 'NORMAL',
                  fromBusinessUnitId: 1001,
                  toBusinessUnitId: 1001,
                  fromWarehouseId: 1001,
                  toWarehouseId: 1003,
                  requestedAt: '2026-09-07T09:00:00+09:00',
                  statusCode: 'IN_TRANSIT',
                },
              ]
            : [],
        page,
      });
    },
  },
  {
    match: (req) => /\/logistics\/stock-transfers\/\d+\/lines$/.test(new URL(req.url).pathname),
    respond: () =>
      jsonResponse({
        items: [
          {
            stockTransferLineId: 7101,
            stockTransferId: 7001,
            lineNo: 1,
            itemId: 2002,
            lotId: 8001,
            requestedQty: 80,
            shippedQty: 80,
            receivedQty: 0,
            uomId: 1001,
            fromLocationId: 3001,
            toLocationId: 3005,
          },
        ],
        page,
      }),
  },
  {
    match: (req) => /\/logistics\/stock-transfers\/\d+:arrive$/.test(new URL(req.url).pathname),
    respond: (req) => {
      options.seen?.push(req.clone());
      return jsonResponse({ stockTransferId: 7001 });
    },
  },
  {
    match: (req) => new URL(req.url).pathname === '/mdm/items',
    respond: () =>
      jsonResponse({
        items: [{ itemId: 2002, itemCode: 'ABC-123', itemName: '하우징', fifoPolicyCode: 'FIFO' }],
        page,
      }),
  },
];

const SignedIn = ({ children }: { children: ReactNode }) => {
  const { worker, signIn } = useWorkerSession();

  useEffect(() => {
    if (worker === null) {
      signIn({ workerNo: '100028', workerName: '김영수' });
    }
  }, [signIn, worker]);

  return worker === null ? null : children;
};

const mount = (options: Options = {}) =>
  renderWithProviders(
    <MemoryRouter>
      <SignedIn>
        <StockTransferScreen />
      </SignedIn>
    </MemoryRouter>,
    { fetch: createStubFetch(routes(options)) },
  );

const scanInto = (label: string, code: string) => {
  const field = screen.getByLabelText(label) as HTMLInputElement;
  field.focus();
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(field, code);
  field.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertFromPaste' }));
};

/** 창고만 고른다. 같은 창고인지 가르는 데는 위치까지 필요하지 않다. */
const pickWarehouse = async (user: ReturnType<typeof userEvent.setup>, name = '불량창고') => {
  await user.click(await screen.findByRole('combobox', { name: /도착 창고/ }));
  await user.click(await screen.findByRole('option', { name }));
};

/*
 * 창고와 위치를 함께 고른다.
 *
 * 도착 확인을 기다리는 줄을 빼지 않는다 - 위치 조회가 아직 안 끝난 채로 반출을 누르면
 * 단추가 잠겨 있어 시험이 엉뚱한 자리에서 갈린다.
 */
const pickDestination = async (user: ReturnType<typeof userEvent.setup>, name = '불량창고') => {
  await pickWarehouse(user, name);
  scanInto('도착 위치 스캔', TO_CODE);
  await screen.findByText(`도착 위치 ${TO_CODE}`);
};

beforeEach(() => {
  held.failWrite = null;
  store.clear();
  localStorage.clear();
});

describe('재고 이동 화면', () => {
  it('스캔한 LOT 의 재고를 보인다', async () => {
    mount();
    await screen.findByLabelText('반출 LOT 스캔');

    scanInto('반출 LOT 스캔', LOT_NO);

    expect(await screen.findByText('재고 120')).toBeTruthy();
  });

  /* 재고보다 많이 내보내면 반출이 되돌아오는데, 그때 물건은 이미 옮겨진 뒤다. */
  it('재고보다 많이 내보내지 못한다', async () => {
    const user = userEvent.setup();
    mount();
    await screen.findByLabelText('반출 LOT 스캔');

    scanInto('반출 LOT 스캔', LOT_NO);
    await user.type(await screen.findByLabelText(/ABC-123 · MLOT-2026-0001 반출 수량/), '121');

    expect(await screen.findByText(/재고 120 을\(를\) 넘을 수 없습니다/)).toBeTruthy();
    expect(screen.getByRole('button', { name: '반출 기록' })).toBeDisabled();
  });

  /* 결정 14 — 보류는 막지 않고 알린다. 막으면 현장이 물건을 못 옮긴다. */
  it('보류 중인 LOT 은 알리되 막지 않는다', async () => {
    const user = userEvent.setup();
    mount({ lotHeld: true });
    await screen.findByLabelText('반출 LOT 스캔');

    scanInto('반출 LOT 스캔', LOT_NO);
    await user.type(await screen.findByLabelText(/반출 수량/), '80');
    await pickDestination(user);

    expect(await screen.findByText(`${LOT_NO} 은(는) 보류 중인 LOT입니다`)).toBeTruthy();

    await waitFor(() => {
      expect(screen.getByRole('button', { name: '반출 기록' })).not.toBeDisabled();
    });
  });

  it('옮길 재고가 없으면 그 사실을 말한다', async () => {
    mount({ noStock: true });
    await screen.findByLabelText('반출 LOT 스캔');

    scanInto('반출 LOT 스캔', LOT_NO);

    expect(await screen.findByText('이 LOT은 옮길 재고가 없습니다')).toBeTruthy();
  });

  /*
   * 이동 헤더가 창고 간만 받는다. 같은 창고 안은 적을 자리가 없어, 통과시키면 반출이
   * 서버에서 되돌아온다.
   */
  it('같은 창고 안 이동은 막고 그 사실을 말한다', async () => {
    const user = userEvent.setup();
    mount({ sameWarehouse: true });
    await screen.findByLabelText('반출 LOT 스캔');

    scanInto('반출 LOT 스캔', LOT_NO);
    await user.type(await screen.findByLabelText(/반출 수량/), '80');
    await pickWarehouse(user);

    expect(
      await screen.findByText('같은 창고 안의 위치 이동은 아직 이 화면에서 할 수 없습니다.'),
    ).toBeTruthy();
    expect(screen.getByRole('button', { name: '반출 기록' })).toBeDisabled();
  });

  /*
   * 반출과 도착 사이에 그만두면 반쪽만 저장된 이동이 남는데 데이터베이스가 막지 않는다.
   * 진입에서 보이지 않으면 작업자는 같은 물건을 또 반출한다.
   */
  it('반출됐으나 도착하지 않은 이동을 진입에서 보인다', async () => {
    mount({ unfinished: true });

    expect(await screen.findByText('ST-2026-000001 · 1라인')).toBeTruthy();
    expect(screen.getByRole('button', { name: '이어하기' })).toBeTruthy();
  });

  it('이어할 이동이 없으면 없다고 말한다', async () => {
    mount();

    expect(await screen.findByText('이어할 이동이 없습니다')).toBeTruthy();
  });

  /*
   * 축을 빼면 이미 끝난 이동까지 이어할 것으로 보인다. 작업자가 그것을 또 도착시키면
   * 서버가 되돌리는데, 그 사이 화면은 할 일이 있는 것처럼 말한다.
   */
  it('이어할 이동은 아직 도착하지 않은 것만 묻는다', async () => {
    const asked: string[] = [];
    mount({ asked, unfinished: true });

    await screen.findByText('ST-2026-000001 · 1라인');

    expect(asked.some((url) => url.includes('inTransitOnly=true'))).toBe(true);
  });

  it('이어하면 도착만 남는다', async () => {
    const user = userEvent.setup();
    mount({ unfinished: true });

    await user.click(await screen.findByRole('button', { name: '이어하기' }));

    expect(await screen.findByRole('button', { name: '이동 완료' })).toBeTruthy();
    expect(screen.queryByLabelText('반출 LOT 스캔')).toBeNull();
  });

  it('반출하면 도착 위치를 라인마다 실어 보낸다', async () => {
    const user = userEvent.setup();
    const seen: Request[] = [];
    mount({ seen });
    await screen.findByLabelText('반출 LOT 스캔');

    scanInto('반출 LOT 스캔', LOT_NO);
    await user.type(await screen.findByLabelText(/반출 수량/), '80');
    await pickDestination(user);
    await user.click(screen.getByRole('button', { name: '반출 기록' }));

    await waitFor(() => {
      expect(seen).toHaveLength(1);
    });

    const body = (await seen[0]?.json()) as {
      fromWarehouseId: number;
      toWarehouseId: number;
      lines: { toLocationId: number; requestedQty: number }[];
    };

    expect(body.fromWarehouseId).toBe(1001);
    expect(body.toWarehouseId).toBe(1003);
    expect(body.lines[0]?.toLocationId).toBe(3005);
    expect(body.lines[0]?.requestedQty).toBe(80);
  });

  /*
   * 연타는 button.click() 을 연속으로 불러야 갈린다. await user.click() 세 번은 클릭 사이에
   * 다시 그리기가 끼어 결함이 있어도 통과한다. 요청 수가 아니라 멱등키가 하나인지로 잰다.
   */
  it('연타해도 한 건만 담는다', async () => {
    const user = userEvent.setup();
    const seen: Request[] = [];
    mount({ seen });
    await screen.findByLabelText('반출 LOT 스캔');

    scanInto('반출 LOT 스캔', LOT_NO);
    await user.type(await screen.findByLabelText(/반출 수량/), '80');
    await pickDestination(user);

    const button = screen.getByRole('button', { name: '반출 기록' });
    button.click();
    button.click();
    button.click();

    await waitFor(() => {
      expect(seen.length).toBeGreaterThan(0);
    });

    const keys = new Set(seen.map((each) => each.headers.get('Idempotency-Key')));

    expect(keys.size).toBe(1);
  });

  /* 담기지 못하면 적은 것이 어디에도 없다. 말하지 않으면 사람은 옮긴 줄 안다. */
  it('단말 보관소가 거절하면 기록되지 않았다고 말한다', async () => {
    const user = userEvent.setup();
    mount();
    await screen.findByLabelText('반출 LOT 스캔');

    scanInto('반출 LOT 스캔', LOT_NO);
    await user.type(await screen.findByLabelText(/반출 수량/), '80');
    await pickDestination(user);

    held.failWrite = 'outbox';
    await user.click(screen.getByRole('button', { name: '반출 기록' }));

    expect(await screen.findByText('이동을 담아 두지 못했습니다')).toBeTruthy();
  });
});
