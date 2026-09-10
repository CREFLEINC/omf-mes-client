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
import { runBackStep } from '../../patterns/back-step';
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
  holds?: unknown[];
  balances?: unknown[];
  policy?: string;
  lotsStatus?: number;
  /** 보류 사유의 표시명 조회가 실패한다. 없는 것과 못 받은 것을 가르는 자리다. */
  reasonsStatus?: number;
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
    match: (req) => new URL(req.url).pathname === '/mdm/code-values',
    respond: () =>
      options.reasonsStatus === undefined
        ? jsonResponse({
            items: [
              {
                code: 'INSPECTION_PENDING',
                codeName: 'Inspection pending',
                nameKo: '수입검사 대기',
                displayOrder: 1,
                isActive: true,
              },
            ],
            page,
          })
        : jsonResponse({ message: '실패' }, { status: options.reasonsStatus }),
  },
  {
    match: (req) => new URL(req.url).pathname === '/mdm/partners',
    respond: () => jsonResponse({ items: [{ partnerId: 1, partnerName: '가나상사' }], page }),
  },
  {
    match: (req) => new URL(req.url).pathname === '/mdm/uoms',
    respond: () => jsonResponse({ items: [{ uomId: 9, uomCode: 'EA' }], page }),
  },
  {
    /* 고른 LOT 이 보류면 화면이 사유를 따로 묻는다. */
    match: (req) => /\/trace\/lots\/\d+\/holds$/.test(new URL(req.url).pathname),
    respond: () =>
      jsonResponse({
        items: options.holds ?? [
          {
            lotHoldId: 8501,
            lotId: 1,
            reasonCode: 'INSPECTION_PENDING',
            holdQty: null,
            uomId: 9,
            releaseCondition: '수입검사 합격',
            statusCode: 'OPEN',
            heldAt: '2026-09-06T01:12:00.000Z',
            releasedAt: null,
          },
        ],
        page,
      }),
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

/* 피킹 화면에는 권장 앞 세 건만 선다. 전부 보려면 목록 화면으로 넘어간다. */
const openList = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(await screen.findByRole('button', { name: /목록보기\(\d+\)/ }));
};

/* 설계는 스캔으로만 고르게 한다. 목록에서 바로 고르는 길은 없다. */
const pickLot = async (user: ReturnType<typeof userEvent.setup>, lotNo: string) => {
  if (screen.queryByRole('button', { name: '찾기' }) === null) {
    await user.click(await screen.findByRole('button', { name: '직접 입력' }));
  }

  const field = screen.getByLabelText('제품 LOT 스캔');

  await user.clear(field);
  await user.type(field, lotNo);

  const submit = screen.queryByRole('button', { name: '찾기' });

  if (submit !== null) {
    await user.click(submit);
  }
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

    expect(await screen.findByText('오프라인이라 피킹할 수 없습니다')).toBeTruthy();
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
  /*
   * 유형을 안 거르면 같은 품목의 생산 LOT 이 후보로 온다. 유효기간이 없어 순서를 정할 수
   * 없는 묶음에 서고, 작업자는 집을 수 없는 줄을 셋 넘게 본다.
   */
  it('후보를 제품 LOT으로만 묻는다', async () => {
    const asked: string[] = [];
    const user = userEvent.setup();
    mount([
      {
        match: (req) => new URL(req.url).pathname === '/trace/lots',
        respond: (req) => {
          asked.push(new URL(req.url).searchParams.get('lotTypeCode') ?? '');
          return jsonResponse({ items: [EARLY, LATE], page });
        },
      },
    ]);
    await chooseTarget(user);

    await waitFor(() => {
      expect(asked.length).toBeGreaterThan(0);
    });
    expect(asked.every((each) => each === 'PRODUCT')).toBe(true);
  });

  /*
   * 설계 레이아웃이 대상 - 권장 LOT - 스캔 순이다. 스캔이 먼저 서면 무엇을 집어야 하는지
   * 보기 전에 집으라고 시키는 것이 된다.
   */
  it('권장 LOT을 LOT 스캔보다 위에 보인다', async () => {
    const user = userEvent.setup();
    mount();
    await chooseTarget(user);

    const headings = screen.getAllByRole('heading').map((each) => each.textContent ?? '');
    const candidates = headings.findIndex((each) => each.startsWith('권장 LOT'));
    const scan = headings.indexOf('LOT 스캔');

    expect(candidates).toBeGreaterThanOrEqual(0);
    expect(scan).toBeGreaterThan(candidates);
  });

  /* 식별자만 오는 값이라 이름을 따로 풀지 않으면 작업자가 대조할 수 없다. */
  it('대상 카드에 고객과 출하 예정일을 보인다', async () => {
    const user = userEvent.setup();
    mount();
    await chooseTarget(user);

    expect(await screen.findByText('고객 가나상사')).toBeTruthy();
    expect(screen.getByText('출하 예정 2026-09-01')).toBeTruthy();
  });

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

    await openList(user);

    expect(await screen.findByText('순서를 정할 수 없습니다')).toBeTruthy();
    expect(screen.getByText('FG-0305')).toBeTruthy();
  });

  /*
   * 라우터 이력에는 이 화면 하나뿐이다. 단계를 되돌리지 않으면 대상을 고르고 스캔하던
   * 사람이 뒤로가기 한 번에 작업 목록까지 나가 처음부터 다시 들어와야 한다.
   */
  it('뒤로가기는 고른 대상을 먼저 놓는다', async () => {
    const user = userEvent.setup();
    mount();
    await chooseTarget(user);

    expect(runBackStep()).toBe(true);

    expect(await screen.findByRole('button', { name: /SR-2026-0456/ })).toBeTruthy();
  });

  it('목록 화면에서 뒤로가기는 피킹 화면으로 돌아간다', async () => {
    const user = userEvent.setup();
    mount([], { lots: [EARLY, LATE, UNDATED] });
    await chooseTarget(user);
    await openList(user);
    await screen.findByText('전체 LOT');

    expect(runBackStep()).toBe(true);

    expect(await screen.findByLabelText('제품 LOT 스캔')).toBeTruthy();
    expect(screen.queryByText('전체 LOT')).toBeNull();
  });

  /*
   * 후보 카드가 130~210px 이고 본문이 632px 이다. 상한이 없으면 한 품목의 LOT 이 쌓인 날
   * 목록이 화면 수십 장이 되어 스캐너를 든 한 손으로는 지날 수 없다.
   */
  it('권장 LOT 을 세 건까지만 세우고 나머지는 건수로 말한다', async () => {
    const user = userEvent.setup();
    const extra = [1, 2, 3].map((n) =>
      lotRow(20 + n, `FG-04${String(n)}`, `2099-03-0${String(n)}`),
    );
    mount([], {
      lots: [EARLY, LATE, ...extra],
      balances: extra
        .map((lot) => balance(lot.lotId, 500))
        .concat([balance(1, 500), balance(2, 500)]),
    });
    await chooseTarget(user);
    await screen.findByText('권장 1순위');

    expect(screen.getAllByText(/^FG-0/)).toHaveLength(3);
    expect(screen.getByRole('button', { name: '목록보기(5)' })).toBeTruthy();

    await openList(user);

    expect(screen.getAllByText(/^FG-0/)).toHaveLength(5);
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

  /*
   * 막는 것만으로는 무엇을 하면 풀리는지 알 수 없다. 스펙이 사유까지 요구하고, 형제 화면은
   * 이미 보이고 있어 같은 사람이 두 화면에서 다른 것을 받는다.
   */
  it('보류된 LOT 을 스캔하면 사유와 해제 조건을 함께 말한다', async () => {
    const user = userEvent.setup();
    mount([], { held: [EARLY] });
    await chooseTarget(user);
    await screen.findByText('보류 — 집을 수 없습니다');

    await user.click(await screen.findByRole('button', { name: '직접 입력' }));
    await user.type(screen.getByLabelText('제품 LOT 스캔'), EARLY.lotNo);
    await user.click(screen.getByRole('button', { name: '찾기' }));

    /* 코드를 그대로 보이면 무엇이 걸렸는지 모른다. 표시명은 마스터가 갖는다. */
    expect(await screen.findByText(/보류 사유 수입검사 대기/)).toBeTruthy();
    expect(screen.getByText(/해제 조건 수입검사 합격/)).toBeTruthy();
  });

  /*
   * 표시명 조회와 보류 조회는 서로 다른 물음이다. 뭉치면 표시명이 안 온 동안 표시명이 없다고
   * 해 두었다가 이름으로 바뀌고, 조회가 실패해도 없는 것처럼 말한다.
   */
  it('표시명 조회가 실패하면 표시명이 없다고 말하지 않는다', async () => {
    const user = userEvent.setup();
    mount([], { held: [EARLY], reasonsStatus: 500 });
    await chooseTarget(user);
    await screen.findByText('보류 — 집을 수 없습니다');

    await user.click(await screen.findByRole('button', { name: '직접 입력' }));
    await user.type(screen.getByLabelText('제품 LOT 스캔'), EARLY.lotNo);
    await user.click(screen.getByRole('button', { name: '찾기' }));

    expect(await screen.findByText(/보류 사유를 확인하지 못했습니다/)).toBeTruthy();
    expect(screen.queryByText(/표시명 없음/)).toBeNull();
  });

  /*
   * 해제 조건은 보류 조회가 들고 온 값이다. 표시명 조회가 실패했다고 함께 지우면, 손에 쥔
   * 것을 다른 물음이 실패했다는 이유로 버리는 것이 된다 - 현장이 실제로 쓰는 것은 이쪽이다.
   */
  it('표시명을 못 받아도 해제 조건은 그대로 낸다', async () => {
    const user = userEvent.setup();
    mount([], { held: [EARLY], reasonsStatus: 500 });
    await chooseTarget(user);
    await screen.findByText('보류 — 집을 수 없습니다');

    await user.click(await screen.findByRole('button', { name: '직접 입력' }));
    await user.type(screen.getByLabelText('제품 LOT 스캔'), EARLY.lotNo);
    await user.click(screen.getByRole('button', { name: '찾기' }));

    expect(await screen.findByText(/해제 조건 수입검사 합격/)).toBeTruthy();
  });

  /*
   * 후보는 이 품목으로 걸러 온다. 목록에 없다는 것만으로는 없는 번호와 남의 품목을 가를 수
   * 없고, 작업자가 할 일은 둘이 다르다 - 하나는 다시 찾고 하나는 대상을 다시 고른다.
   */
  it('다른 품목의 LOT 을 스캔하면 없는 번호와 다르게 말한다', async () => {
    const user = userEvent.setup();
    const foreign = { ...lotRow(9, 'FG-9999', '2099-05-05'), itemId: 77 };
    mount([
      {
        match: (req) =>
          new URL(req.url).pathname === '/trace/lots' && new URL(req.url).searchParams.has('lotNo'),
        respond: () => jsonResponse({ items: [foreign], page }),
      },
    ]);
    await chooseTarget(user);
    await pickLot(user, 'FG-9999');

    expect(await screen.findByText(/FG-9999 은\(는\) 이 라인의 품목이 아닙니다/)).toBeTruthy();
  });

  /*
   * 스캔이 빗나가도 앞서 고른 것은 남는다. 무엇을 집는 중인지 글자로 없으면, 손에 든 것과
   * 다른 LOT 에 수량을 적고 확정하게 된다.
   */
  it('스캔이 빗나가도 지금 집는 LOT 을 계속 말한다', async () => {
    const user = userEvent.setup();
    mount();
    await chooseTarget(user);

    await pickLot(user, EARLY.lotNo);
    expect(await screen.findByText(`스캔됨 ${EARLY.lotNo}`)).toBeTruthy();

    await pickLot(user, '없는LOT');

    expect(await screen.findByText(/없는LOT LOT을 이 품목에서 찾지 못했습니다/)).toBeTruthy();
    expect(screen.getByText(`스캔됨 ${EARLY.lotNo}`)).toBeTruthy();
  });

  /*
   * 스펙은 보류 LOT 스캔을 거부로 정했다. 수량칸이 열리면 집을 수 없다는 말 옆에 집을 수
   * 있다는 말이 나란히 서고, 확정 단추만 잠긴 채 이유가 어긋난다.
   */
  it('보류된 LOT 을 스캔해도 수량칸을 열지 않는다', async () => {
    const user = userEvent.setup();
    mount([], { held: [EARLY] });
    await chooseTarget(user);
    await screen.findByText('보류 — 집을 수 없습니다');

    await user.click(await screen.findByRole('button', { name: '직접 입력' }));
    await user.type(screen.getByLabelText('제품 LOT 스캔'), EARLY.lotNo);
    await user.click(screen.getByRole('button', { name: '찾기' }));
    await screen.findByText(/보류 사유 수입검사 대기/);

    expect(screen.queryByRole('button', { name: '피킹 확정' })).toBeNull();
    expect(screen.queryByText('권장 1순위가 아닙니다 — 집을 수 있습니다')).toBeNull();
  });

  /* 고르지도 않은 LOT 마다 사유를 물으면 후보 수만큼 호출이 나간다. */
  it('고르기 전에는 보류 사유를 묻지 않는다', async () => {
    const user = userEvent.setup();
    const asked: string[] = [];
    mount(
      [
        {
          match: (req) => /\/trace\/lots\/\d+\/holds$/.test(new URL(req.url).pathname),
          respond: (req) => {
            asked.push(new URL(req.url).pathname);
            return jsonResponse({ items: [], page });
          },
        },
      ],
      { held: [EARLY] },
    );
    await chooseTarget(user);
    await screen.findByText('보류 — 집을 수 없습니다');

    expect(asked).toHaveLength(0);
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

    await pickLot(user, EARLY.lotNo);

    expect(screen.queryByRole('button', { name: '피킹 확정' })).toBeNull();
  });

  /* 셀 수 없는 것을 넉넉한 것으로 두지 않는다. 판정의 정본은 서버다. */
  it('유효기간이 없어 잔여를 셀 수 없으면 그 사실을 말하되 막지는 않는다', async () => {
    const user = userEvent.setup();
    mount([], {
      lots: [UNDATED],
      requests: [request({ lines: [line({ minimumRemainingShelfLifeDays: 180 })] })],
    });
    await chooseTarget(user);

    await openList(user);

    expect(await screen.findByText('유효기간이 없어 잔여 일수를 판정할 수 없습니다')).toBeTruthy();

    await user.click(screen.getByRole('button', { name: '돌아가기' }));
    await pickLot(user, UNDATED.lotNo);

    expect(await screen.findByRole('button', { name: '피킹 확정' })).toBeTruthy();
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

    await pickLot(user, LATE.lotNo);

    expect(await screen.findByText('권장 1순위가 아닙니다 — 집을 수 있습니다')).toBeTruthy();
    expect(screen.queryByLabelText('사유')).toBeNull();
  });

  it('남은 배정을 넘으면 확정을 막는다', async () => {
    const user = userEvent.setup();
    mount();
    await chooseTarget(user);
    await screen.findByText('FG-0298');

    await pickLot(user, EARLY.lotNo);
    await user.type(await screen.findByLabelText(/피킹 수량/), '181');

    expect(
      await screen.findByText('피킹 수량은 남은 배정 180을(를) 넘을 수 없습니다'),
    ).toBeTruthy();
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

    await pickLot(user, EARLY.lotNo);
    await user.type(await screen.findByLabelText(/피킹 수량/), '180');
    await user.click(screen.getByRole('button', { name: '피킹 확정' }));

    await waitFor(() => {
      expect(seen).toHaveLength(1);
    });
    expect(seen[0]?.headers.get('X-Worker-No')).toBe('900028');
    expect(seen[0]?.headers.get('Idempotency-Key')).toBeTruthy();
    expect(await screen.findByText('피킹을 기록했습니다')).toBeTruthy();
  });

  /*
   * 보낼 때마다 키를 새로 만들면 멱등키가 아무것도 막지 못한다. 서버가 기록한 뒤 응답이
   * 유실되면 화면은 실패로 보이고, 다시 누르면 새 키라 서버가 같은 일을 한 번 더 한다.
   */
  it('확정을 다시 시도해도 같은 멱등키로 간다', async () => {
    const user = userEvent.setup();
    const seen: Request[] = [];
    let reachable = false;
    mount([
      {
        match: (req) =>
          new URL(req.url).pathname === '/logistics/shipment-requests/5/lines/77:pick' &&
          req.method === 'POST',
        respond: (req) => {
          seen.push(req.clone());

          if (!reachable) {
            throw new TypeError('Failed to fetch');
          }

          return jsonResponse(line({ pickedQty: 300 }));
        },
      },
    ]);
    await chooseTarget(user);
    await screen.findByText('FG-0298');

    await pickLot(user, EARLY.lotNo);
    await user.type(await screen.findByLabelText(/피킹 수량/), '180');
    await user.click(screen.getByRole('button', { name: '피킹 확정' }));

    await waitFor(() => {
      expect(seen).toHaveLength(1);
    });

    reachable = true;
    await user.click(screen.getByRole('button', { name: '피킹 확정' }));

    await waitFor(() => {
      expect(seen).toHaveLength(2);
    });
    expect(seen[1]?.headers.get('Idempotency-Key')).toBe(seen[0]?.headers.get('Idempotency-Key'));
  });

  /* 보낼 값이 달라졌으면 다른 쓰기다. 앞 키로 가면 서버가 앞 시도로 보고 흡수한다. */
  it('수량을 바꾸면 새 멱등키로 간다', async () => {
    const user = userEvent.setup();
    const seen: Request[] = [];
    mount([
      {
        match: (req) =>
          new URL(req.url).pathname === '/logistics/shipment-requests/5/lines/77:pick' &&
          req.method === 'POST',
        respond: (req) => {
          seen.push(req.clone());
          throw new TypeError('Failed to fetch');
        },
      },
    ]);
    await chooseTarget(user);
    await screen.findByText('FG-0298');

    await pickLot(user, EARLY.lotNo);

    const field = await screen.findByLabelText(/피킹 수량/);

    await user.type(field, '180');
    await user.click(screen.getByRole('button', { name: '피킹 확정' }));

    await waitFor(() => {
      expect(seen).toHaveLength(1);
    });

    await user.clear(field);
    await user.type(field, '150');
    await user.click(screen.getByRole('button', { name: '피킹 확정' }));

    await waitFor(() => {
      expect(seen).toHaveLength(2);
    });
    expect(seen[1]?.headers.get('Idempotency-Key')).not.toBe(
      seen[0]?.headers.get('Idempotency-Key'),
    );
  });

  /* 후보를 바꾸는 것이 이 화면의 주된 조작이다. 다른 LOT 은 다른 쓰기다. */
  it('다른 후보 LOT 을 고르면 새 멱등키로 간다', async () => {
    const user = userEvent.setup();
    const seen: Request[] = [];
    mount([
      {
        match: (req) =>
          new URL(req.url).pathname === '/logistics/shipment-requests/5/lines/77:pick' &&
          req.method === 'POST',
        respond: (req) => {
          seen.push(req.clone());
          throw new TypeError('Failed to fetch');
        },
      },
    ]);
    await chooseTarget(user);
    await screen.findByText('FG-0311');

    await pickLot(user, EARLY.lotNo);
    await user.type(await screen.findByLabelText(/피킹 수량/), '180');
    await user.click(screen.getByRole('button', { name: '피킹 확정' }));

    await waitFor(() => {
      expect(seen).toHaveLength(1);
    });

    await pickLot(user, LATE.lotNo);
    await user.type(await screen.findByLabelText(/피킹 수량/), '180');
    await user.click(screen.getByRole('button', { name: '피킹 확정' }));

    await waitFor(() => {
      expect(seen).toHaveLength(2);
    });
    expect(await seen[1]?.clone().json()).not.toMatchObject(
      (await seen[0]?.clone().json()) as Record<string, unknown>,
    );
    expect(seen[1]?.headers.get('Idempotency-Key')).not.toBe(
      seen[0]?.headers.get('Idempotency-Key'),
    );
  });

  /* 장갑 낀 손이 한 번 더 누르면 멱등키가 다른 두 건이 나가 예약이 두 번 소진된다. */
  it('보내는 동안 확정을 다시 눌러도 한 건만 나간다', async () => {
    const user = userEvent.setup();
    const seen: Request[] = [];
    const gate: { release: (() => void) | null } = { release: null };
    mount([
      {
        match: (req) =>
          new URL(req.url).pathname === '/logistics/shipment-requests/5/lines/77:pick' &&
          req.method === 'POST',
        respond: async (req) => {
          seen.push(req.clone());
          await new Promise<void>((resolve) => {
            gate.release = resolve;
          });

          return jsonResponse(line({ pickedQty: 300 }));
        },
      },
    ]);
    await chooseTarget(user);
    await screen.findByText('FG-0298');

    await pickLot(user, EARLY.lotNo);
    await user.type(await screen.findByLabelText(/피킹 수량/), '180');

    /* 장갑 낀 손의 연타다. 하나가 끝나기를 기다리지 않고 잇달아 누른다. */
    const button = screen.getByRole('button', { name: '피킹 확정' });

    button.click();
    button.click();
    button.click();

    await waitFor(() => {
      expect(seen.length).toBeGreaterThan(0);
    });
    gate.release?.();

    expect(await screen.findByText('피킹을 기록했습니다')).toBeTruthy();
    expect(seen).toHaveLength(1);
  });

  /*
   * 창고 구석에서 연결이 끊겼다 붙는다. 훅이 조기 반환 아래에 있으면 그 순간 훅 수가 달라져
   * 화면이 통째로 던지고, 이 앱에는 그것을 받을 자리가 없어 빈 화면이 남는다.
   */
  it('연결이 끊겼다 돌아와도 화면이 살아 있다', async () => {
    const user = userEvent.setup();
    setOnline(false);
    mount();

    await screen.findByText('오프라인이라 피킹할 수 없습니다');

    setOnline(true);
    window.dispatchEvent(new Event('online'));

    await chooseTarget(user);

    expect(screen.getByText('배정 300 · 피킹 120')).toBeTruthy();
  });

  /* 라인이 다르면 다른 쓰기다. 대상 바꾸기로 라인을 갈아탈 수 있다. */
  it('다른 라인을 고르면 새 멱등키로 간다', async () => {
    const user = userEvent.setup();
    const seen: Request[] = [];
    const second = line({ shipmentRequestLineId: 78, lineNo: 2 });
    mount(
      [
        {
          match: (req) =>
            /\/logistics\/shipment-requests\/5\/lines\/\d+:pick$/.test(req.url) &&
            req.method === 'POST',
          respond: (req) => {
            seen.push(req.clone());
            throw new TypeError('Failed to fetch');
          },
        },
      ],
      { requests: [request({ lines: [line(), second] })] },
    );

    await user.click(await screen.findByRole('button', { name: /1번 줄/ }));
    await screen.findByText('FG-1001 완제품');
    await screen.findByText('FG-0298');

    await pickLot(user, EARLY.lotNo);
    await user.type(await screen.findByLabelText(/피킹 수량/), '180');
    await user.click(screen.getByRole('button', { name: '피킹 확정' }));

    await waitFor(() => {
      expect(seen).toHaveLength(1);
    });

    await user.click(screen.getByRole('button', { name: '다른 대상 고르기' }));
    await user.click(await screen.findByRole('button', { name: /2번 줄/ }));
    await screen.findByText('FG-0298');
    await pickLot(user, EARLY.lotNo);
    await user.type(await screen.findByLabelText(/피킹 수량/), '180');
    await user.click(screen.getByRole('button', { name: '피킹 확정' }));

    await waitFor(() => {
      expect(seen).toHaveLength(2);
    });
    /* 전제 - 라인만 다르고 나머지는 같다. 그러지 않으면 이 시험은 라인을 재는 것이 아니다. */
    expect(new URL(seen[0]?.url ?? '').pathname).toContain('/lines/77:pick');
    expect(new URL(seen[1]?.url ?? '').pathname).toContain('/lines/78:pick');
    expect(await seen[1]?.clone().json()).toEqual(await seen[0]?.clone().json());
    expect(seen[1]?.headers.get('Idempotency-Key')).not.toBe(
      seen[0]?.headers.get('Idempotency-Key'),
    );
  });

  /*
   * 남은 배정은 굳은 스냅숏이 아니라 서버가 아는 값에서 나와야 한다. 확정 뒤에도 옛 값이
   * 남으면 배정보다 많이 집을 수 있다 - 되돌릴 수 없는 예약 소진이다.
   */
  it('확정한 뒤 다음 건으로 가면 남은 배정이 줄어 있다', async () => {
    const user = userEvent.setup();
    let picked = 120;
    mount([
      {
        match: (req) =>
          new URL(req.url).pathname === '/logistics/shipment-requests/5/lines/77:pick' &&
          req.method === 'POST',
        respond: async (req) => {
          /* 절대값을 박으면 화면이 무엇을 보냈든 통과한다. 보낸 만큼 더한다. */
          const body = (await req.clone().json()) as { pickedQty: number };

          picked += body.pickedQty;

          return jsonResponse(line({ pickedQty: picked }));
        },
      },
      {
        /* 서버가 집은 양을 기억한다. 기억하지 않으면 낡은 스냅숏을 잡을 수 없다. */
        match: (req) => new URL(req.url).pathname === '/logistics/shipment-requests',
        respond: () =>
          jsonResponse({ items: [request({ lines: [line({ pickedQty: picked })] })], page }),
      },
    ]);
    await chooseTarget(user);

    expect(screen.getByText('남은 배정 180 EA')).toBeTruthy();

    await screen.findByText('FG-0298');
    await pickLot(user, EARLY.lotNo);
    await user.type(await screen.findByLabelText(/피킹 수량/), '180');
    await user.click(screen.getByRole('button', { name: '피킹 확정' }));

    await screen.findByText('피킹을 기록했습니다');
    await user.click(screen.getByRole('button', { name: '다음 피킹' }));

    await waitFor(() => {
      expect(screen.getByText('남은 배정 0 EA')).toBeTruthy();
    });
    expect(screen.queryByText('남은 배정 180 EA')).toBeNull();
  });

  /*
   * 남은 배정을 목록 조회에서만 얻으면, 그 조회가 실패했을 때 확정 전 값이 그대로 남는다.
   * 배정을 다 채우고도 남은 배정이 남아 보여 한 번 더 집게 된다.
   */
  it('확정 뒤 목록 조회가 실패해도 남은 배정이 되살아나지 않는다', async () => {
    const user = userEvent.setup();
    let listFails = false;
    let picked = 120;
    mount([
      {
        match: (req) =>
          new URL(req.url).pathname === '/logistics/shipment-requests/5/lines/77:pick' &&
          req.method === 'POST',
        respond: async (req) => {
          const body = (await req.clone().json()) as { pickedQty: number };

          picked += body.pickedQty;
          listFails = true;

          return jsonResponse(line({ pickedQty: picked }));
        },
      },
      {
        match: (req) => new URL(req.url).pathname === '/logistics/shipment-requests',
        respond: () =>
          listFails
            ? jsonResponse({ message: '실패' }, { status: 500 })
            : jsonResponse({ items: [request()], page }),
      },
    ]);
    await chooseTarget(user);
    await screen.findByText('FG-0298');

    await pickLot(user, EARLY.lotNo);
    await user.type(await screen.findByLabelText(/피킹 수량/), '180');
    await user.click(screen.getByRole('button', { name: '피킹 확정' }));

    await screen.findByText('피킹을 기록했습니다');
    await user.click(screen.getByRole('button', { name: '다음 피킹' }));

    await waitFor(() => {
      expect(screen.getByText('남은 배정 0 EA')).toBeTruthy();
    });
    expect(screen.queryByText('남은 배정 180 EA')).toBeNull();
    /* 조회가 늙었다는 사실도 함께 말한다. */
    expect(screen.getByText('오늘 출하분을 확인할 수 없습니다')).toBeTruthy();
  });

  /* 말없이 빠지면 무슨 일이 있었는지 알 수 없다. 남겨 두면 없는 줄을 집게 된다. */
  it('고르던 라인이 목록에서 빠지면 그 사실을 말한다', async () => {
    const user = userEvent.setup();
    let dropped = false;
    let picked = 120;
    mount([
      {
        match: (req) =>
          new URL(req.url).pathname === '/logistics/shipment-requests/5/lines/77:pick' &&
          req.method === 'POST',
        respond: async (req) => {
          const body = (await req.clone().json()) as { pickedQty: number };

          picked += body.pickedQty;
          dropped = true;

          return jsonResponse(line({ pickedQty: picked }));
        },
      },
      {
        match: (req) => new URL(req.url).pathname === '/logistics/shipment-requests',
        respond: () => jsonResponse({ items: dropped ? [] : [request()], page }),
      },
    ]);
    await chooseTarget(user);
    await screen.findByText('FG-0298');

    await pickLot(user, EARLY.lotNo);
    await user.type(await screen.findByLabelText(/피킹 수량/), '180');
    await user.click(screen.getByRole('button', { name: '피킹 확정' }));

    await screen.findByText('피킹을 기록했습니다');
    await user.click(screen.getByRole('button', { name: '다음 피킹' }));

    expect(await screen.findByText('고르던 라인이 오늘 출하분에서 빠졌습니다')).toBeTruthy();
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

    await pickLot(user, EARLY.lotNo);
    await user.type(await screen.findByLabelText(/피킹 수량/), '180');
    await user.click(screen.getByRole('button', { name: '피킹 확정' }));

    expect(await screen.findByText('피킹을 기록했습니다')).toBeTruthy();
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

    await pickLot(user, EARLY.lotNo);
    await user.type(await screen.findByLabelText(/피킹 수량/), '180');
    await user.click(screen.getByRole('button', { name: '피킹 확정' }));

    expect(
      await screen.findByText('집을 수 없는 상태로 바뀌었습니다. 목록을 다시 확인하세요.'),
    ).toBeTruthy();
    expect(screen.queryByText('피킹을 기록하지 못했습니다. 다시 시도하세요.')).toBeNull();
  });

  /* 스캔이 실패했을 때 손으로 넣을 길이 없으면 현장이 멈춘다. */
  it('직접 입력으로도 LOT을 고를 수 있다', async () => {
    const user = userEvent.setup();
    mount();
    await chooseTarget(user);
    await screen.findByText('FG-0311');

    await user.click(await screen.findByRole('button', { name: '직접 입력' }));
    await user.type(screen.getByLabelText('제품 LOT 스캔'), 'FG-0311');
    await user.click(screen.getByRole('button', { name: '찾기' }));

    expect(await screen.findByLabelText(/피킹 수량/)).toBeTruthy();
    expect(screen.getByText('권장 1순위가 아닙니다 — 집을 수 있습니다')).toBeTruthy();
  });

  it('이 품목에 없는 번호를 넣으면 찾지 못했다고 말한다', async () => {
    const user = userEvent.setup();
    mount();
    await chooseTarget(user);
    await screen.findByText('FG-0298');

    await user.click(await screen.findByRole('button', { name: '직접 입력' }));
    await user.type(screen.getByLabelText('제품 LOT 스캔'), 'FG-9999');
    await user.click(screen.getByRole('button', { name: '찾기' }));

    expect(await screen.findByText('FG-9999 LOT을 이 품목에서 찾지 못했습니다')).toBeTruthy();
  });
});
