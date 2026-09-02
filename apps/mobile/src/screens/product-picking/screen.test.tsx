import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useEffect, type ReactNode } from 'react';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  createStubFetch,
  jsonResponse,
  renderWithProviders,
  type StubRoute,
} from '../../test/api-harness';
import { useWorkerSession } from '../../patterns/worker-session';
import { ProductPickingScreen } from './screen';

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

const lotRow = (lotId: number, lotNo: string, expiryDate: string | null) => ({
  lotId,
  lotNo,
  itemId: 31,
  lotTypeCode: 'PRODUCT',
  plantId: 1,
  initialQty: 500,
  uomId: 9,
  sourceTypeCode: 'PRODUCTION',
  sourceId: 1,
  statusCode: 'NORMAL',
  expiryDate,
  manufacturedAt: '2026-03-03T00:00:00+09:00',
});

const EARLY = lotRow(1, 'FG-0298', '2099-02-01');
const LATE = lotRow(2, 'FG-0311', '2099-02-06');
const UNDATED = lotRow(3, 'FG-0305', null);

const line = (overrides: Record<string, unknown> = {}) => ({
  shipmentRequestLineId: 77,
  lineNo: 1,
  itemId: 31,
  requestedQty: 300,
  allocatedQty: 300,
  pickedQty: 120,
  shippedQty: 0,
  uomId: 9,
  shippingInspectionRequired: false,
  picks: [],
  ...overrides,
});

const request = (overrides: Record<string, unknown> = {}) => ({
  shipmentRequestId: 5,
  shipmentRequestNo: 'SR-2026-0456',
  customerId: 1,
  shipToPartnerId: 1,
  requestedShipDate: '2026-09-01',
  statusCode: 'RELEASED',
  shippingInspectionStatusCode: 'NOT_REQUIRED',
  lines: [line()],
  ...overrides,
});

const balance = (lotId: number, availableQty: number) => ({
  groupBy: 'LOT',
  itemId: 31,
  lotId,
  availableQty,
  onHandQty: availableQty,
  reservedQty: 0,
  pickedQty: 0,
  blockedQty: 0,
  uomId: 9,
  ownershipTypeCode: 'OWN',
});

interface Options {
  requests?: unknown[];
  lots?: unknown[];
  held?: unknown[];
  balances?: unknown[];
  policy?: string;
  lotsStatus?: number;
}

const routes = (options: Options = {}): StubRoute[] => [
  {
    match: (req) => new URL(req.url).pathname === '/logistics/shipment-requests',
    respond: () => jsonResponse({ items: options.requests ?? [request()], page }),
  },
  {
    match: (req) => new URL(req.url).pathname === '/mdm/items/31',
    respond: () =>
      jsonResponse({
        item: {
          itemCode: 'FG-1001',
          itemName: '완제품',
          fifoPolicyCode: options.policy ?? 'FEFO',
        },
      }),
  },
  {
    match: (req) => new URL(req.url).pathname === '/mdm/uoms',
    respond: () => jsonResponse({ items: [{ uomId: 9, uomCode: 'EA' }], page }),
  },
  {
    match: (req) => new URL(req.url).pathname === '/trace/lots',
    respond: (req) => {
      if (options.lotsStatus !== undefined) {
        return jsonResponse({ message: '실패' }, { status: options.lotsStatus });
      }

      const held = new URL(req.url).searchParams.get('heldOnly') === 'true';

      return jsonResponse({
        items: held ? (options.held ?? []) : (options.lots ?? [EARLY, LATE]),
        page,
      });
    },
  },
  {
    match: (req) => new URL(req.url).pathname === '/inventory/balances',
    respond: () =>
      jsonResponse({
        items: options.balances ?? [balance(1, 500), balance(2, 500), balance(3, 500)],
        page,
      }),
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
        <ProductPickingScreen />
      </SignedIn>
    </MemoryRouter>,
    { fetch: createStubFetch([...extra, ...routes(options)]) },
  );

const setOnline = (value: boolean) => {
  Object.defineProperty(navigator, 'onLine', { value, configurable: true });
};

const chooseTarget = async (user: ReturnType<typeof userEvent.setup>) => {
  const target = await screen.findByRole('button', { name: /SR-2026-0456/ });
  await user.click(target);
  await screen.findByText('FG-1001 완제품');
};

beforeEach(() => {
  store.clear();
  setOnline(true);
});

afterEach(() => {
  setOnline(true);
});

describe('제품LOT 피킹 스캔 화면', () => {
  /* 보류 판정을 캐시할 수 없다. 확인하지 못한 채로 집게 두지 않는다. */
  it('연결이 없으면 피킹할 수 없다고 말하고 목록을 열지 않는다', async () => {
    setOnline(false);
    mount();

    expect(await screen.findByText('연결이 없어 피킹할 수 없습니다')).toBeTruthy();
    expect(screen.queryByText('오늘 출하분')).toBeNull();
  });

  it('오늘 출하분에서 대상을 고르면 배정과 남은 배정을 보인다', async () => {
    const user = userEvent.setup();
    mount();
    await chooseTarget(user);

    expect(screen.getByText('배정 300 · 피킹 120')).toBeTruthy();
    expect(screen.getByText('남은 배정 180 EA')).toBeTruthy();
  });

  /* 자유 텍스트라 해석하지 않는다. 사람이 읽고 고르도록 그대로 크게 보인다. */
  it('고객 LOT 요구 문장을 그대로 보이고 그것으로 LOT을 걸러내지 않는다', async () => {
    const user = userEvent.setup();
    mount([], {
      requests: [
        request({ lines: [line({ customerLotRequirement: '제조 90일 이내 · 동일 LOT 단일' })] }),
      ],
    });
    await chooseTarget(user);

    expect(screen.getByText('제조 90일 이내 · 동일 LOT 단일')).toBeTruthy();
    expect(await screen.findByText('FG-0298')).toBeTruthy();
    expect(screen.getByText('FG-0311')).toBeTruthy();
  });

  it('유효기간이 이른 것을 권장 1순위로 보인다', async () => {
    const user = userEvent.setup();
    mount();
    await chooseTarget(user);

    await screen.findByText('FG-0298');

    const cards = screen.getAllByText(/FG-03|FG-02/);

    expect(cards[0]?.textContent).toBe('FG-0298');
    expect(screen.getByText('권장 1순위')).toBeTruthy();
  });

  /* 섞으면 잘못된 순서를 권장으로 내놓고, 빼면 재고가 사라진 것처럼 보인다. */
  it('유효기간이 없는 LOT은 섞지 않고 따로 두고 그 사실을 말한다', async () => {
    const user = userEvent.setup();
    mount([], { lots: [EARLY, LATE, UNDATED] });
    await chooseTarget(user);

    expect(await screen.findByText('순서를 정할 수 없습니다')).toBeTruthy();
    expect(screen.getByText('FG-0305')).toBeTruthy();
  });

  it('모르는 선출 정책이면 순서를 세우지 않고 그 사실을 말한다', async () => {
    const user = userEvent.setup();
    mount([], { policy: 'LIFO' });
    await chooseTarget(user);

    expect(await screen.findByText('선출 정책을 알 수 없어 순서를 정하지 않았습니다')).toBeTruthy();
    expect(screen.queryByText('권장 1순위')).toBeNull();
  });

  it('보류가 걸린 LOT은 집을 수 없다고 말한다', async () => {
    const user = userEvent.setup();
    mount([], { held: [EARLY] });
    await chooseTarget(user);

    expect(await screen.findByText('보류 — 집을 수 없습니다')).toBeTruthy();
  });

  it('가용이 없는 LOT은 다른 출하에 배정됐다고 말한다', async () => {
    const user = userEvent.setup();
    mount([], { balances: [balance(1, 0), balance(2, 500)] });
    await chooseTarget(user);

    expect(await screen.findByText('다른 출하에 배정됐습니다')).toBeTruthy();
  });

  it('잔여 유효기간이 하한에 못 미치면 그 수치와 함께 막는다', async () => {
    const user = userEvent.setup();
    mount([], {
      requests: [request({ lines: [line({ minimumRemainingShelfLifeDays: 999999 })] })],
    });
    await chooseTarget(user);

    const blocked = await screen.findAllByText(/고객 요구 999999일 미달/);

    expect(blocked).toHaveLength(2);
    expect(screen.getAllByRole('button', { name: '이 LOT 고르기' })[0]?.hasAttribute('disabled')).toBe(
      true,
    );
  });

  /* 셀 수 없는 것을 넉넉한 것으로 두지 않는다. 판정의 정본은 서버다. */
  it('유효기간이 없어 잔여를 셀 수 없으면 그 사실을 말하되 막지는 않는다', async () => {
    const user = userEvent.setup();
    mount([], {
      lots: [UNDATED],
      requests: [request({ lines: [line({ minimumRemainingShelfLifeDays: 180 })] })],
    });
    await chooseTarget(user);

    expect(
      await screen.findByText('유효기간이 없어 잔여 일수를 판정할 수 없습니다'),
    ).toBeTruthy();
    expect(screen.getByRole('button', { name: '이 LOT 고르기' }).hasAttribute('disabled')).toBe(
      false,
    );
  });

  /* 확인하지 못한 것을 LOT 이 없는 것으로 말하지 않는다. */
  it('LOT 조회 실패를 LOT 없음으로 말하지 않는다', async () => {
    const user = userEvent.setup();
    mount([], { lotsStatus: 500 });
    await chooseTarget(user);

    expect(await screen.findByText('LOT을 확인할 수 없습니다. 연결을 확인하세요.')).toBeTruthy();
    expect(screen.queryByText('이 품목에 집을 수 있는 LOT이 없습니다')).toBeNull();
  });

  /* 권장은 순서 제안이지 위치가 아니다. 다른 것을 집어도 물건은 맞다. */
  it('권장 1순위가 아닌 LOT을 골라도 경고만 하고 막지 않는다', async () => {
    const user = userEvent.setup();
    mount();
    await chooseTarget(user);
    await screen.findByText('FG-0311');

    await user.click(screen.getAllByRole('button', { name: '이 LOT 고르기' })[1] as HTMLElement);

    expect(await screen.findByText('권장 1순위가 아닙니다 — 집을 수 있습니다')).toBeTruthy();
    expect(screen.queryByLabelText('사유')).toBeNull();
  });

  it('남은 배정을 넘으면 확정을 막는다', async () => {
    const user = userEvent.setup();
    mount();
    await chooseTarget(user);
    await screen.findByText('FG-0298');

    await user.click(screen.getAllByRole('button', { name: '이 LOT 고르기' })[0] as HTMLElement);
    await user.type(await screen.findByLabelText('피킹 수량'), '181');

    expect(await screen.findByText('피킹 수량은 남은 배정 180을(를) 넘을 수 없습니다')).toBeTruthy();
    expect(screen.getByRole('button', { name: '피킹 확정' }).hasAttribute('disabled')).toBe(true);
  });

  /* 사번은 인증이 아니라 귀속이다. 없으면 서버가 요청 자체를 받지 않는다. */
  it('확정은 사번과 멱등키를 실어 라인 경로로 보낸다', async () => {
    const user = userEvent.setup();
    const seen: Request[] = [];
    mount([
      {
        match: (req) =>
          new URL(req.url).pathname === '/logistics/shipment-requests/5/lines/77:pick' &&
          req.method === 'POST',
        respond: (req) => {
          seen.push(req);
          return jsonResponse(line({ pickedQty: 300 }));
        },
      },
    ]);
    await chooseTarget(user);
    await screen.findByText('FG-0298');

    await user.click(screen.getAllByRole('button', { name: '이 LOT 고르기' })[0] as HTMLElement);
    await user.type(await screen.findByLabelText('피킹 수량'), '180');
    await user.click(screen.getByRole('button', { name: '피킹 확정' }));

    await waitFor(() => {
      expect(seen).toHaveLength(1);
    });
    expect(seen[0]?.headers.get('X-Worker-No')).toBe('900028');
    expect(seen[0]?.headers.get('Idempotency-Key')).toBeTruthy();
    expect(await screen.findByText('피킹을 기록했습니다')).toBeTruthy();
  });

  /* 확정 후 되돌리기를 두지 않는다. 예약이 소진된다. */
  it('확정 뒤에 되돌리기를 두지 않고 그 사실을 말한다', async () => {
    const user = userEvent.setup();
    mount([
      {
        match: (req) =>
          new URL(req.url).pathname === '/logistics/shipment-requests/5/lines/77:pick',
        respond: () => jsonResponse(line({ pickedQty: 300 })),
      },
    ]);
    await chooseTarget(user);
    await screen.findByText('FG-0298');

    await user.click(screen.getAllByRole('button', { name: '이 LOT 고르기' })[0] as HTMLElement);
    await user.type(await screen.findByLabelText('피킹 수량'), '180');
    await user.click(screen.getByRole('button', { name: '피킹 확정' }));

    expect(await screen.findByText('되돌리기는 이 화면에서 하지 않습니다')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /되돌리/ })).toBeNull();
  });

  /* 서버가 충돌로 되돌린 것은 다시 눌러서 풀리지 않는다. */
  it('서버가 충돌로 되돌리면 다시 시도하라고 말하지 않는다', async () => {
    const user = userEvent.setup();
    mount([
      {
        match: (req) =>
          new URL(req.url).pathname === '/logistics/shipment-requests/5/lines/77:pick',
        respond: () => jsonResponse({ code: 'INVALID_STATE', message: '보류' }, { status: 409 }),
      },
    ]);
    await chooseTarget(user);
    await screen.findByText('FG-0298');

    await user.click(screen.getAllByRole('button', { name: '이 LOT 고르기' })[0] as HTMLElement);
    await user.type(await screen.findByLabelText('피킹 수량'), '180');
    await user.click(screen.getByRole('button', { name: '피킹 확정' }));

    expect(await screen.findByText('집을 수 없는 상태로 바뀌었습니다. 목록을 다시 확인하세요.')).toBeTruthy();
    expect(screen.queryByText('피킹을 기록하지 못했습니다. 다시 시도하세요.')).toBeNull();
  });

  /* 스캔이 실패했을 때 손으로 넣을 길이 없으면 현장이 멈춘다. */
  it('직접 입력으로도 LOT을 고를 수 있다', async () => {
    const user = userEvent.setup();
    mount();
    await chooseTarget(user);
    await screen.findByText('FG-0311');

    await user.type(screen.getByLabelText('직접 입력'), 'FG-0311');
    await user.click(screen.getByRole('button', { name: '찾기' }));

    expect(await screen.findByLabelText('피킹 수량')).toBeTruthy();
    expect(screen.getByText('권장 1순위가 아닙니다 — 집을 수 있습니다')).toBeTruthy();
  });

  it('이 품목에 없는 번호를 넣으면 찾지 못했다고 말한다', async () => {
    const user = userEvent.setup();
    mount();
    await chooseTarget(user);
    await screen.findByText('FG-0298');

    await user.type(screen.getByLabelText('직접 입력'), 'FG-9999');
    await user.click(screen.getByRole('button', { name: '찾기' }));

    expect(await screen.findByText('FG-9999 LOT을 이 품목에서 찾지 못했습니다')).toBeTruthy();
  });
});
