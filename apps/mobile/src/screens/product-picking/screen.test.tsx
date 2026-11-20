import { screen, waitFor, within } from '@testing-library/react';
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
import type { ShipmentRequest, ShipmentRequestLine, ShipmentRequestLot } from './picking';
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

const pickedLot = (overrides: Partial<ShipmentRequestLot> = {}): ShipmentRequestLot => ({
  shipmentRequestLotId: 501,
  lotId: 1,
  lotNo: 'P2611-0001',
  itemId: 31,
  pickedQty: 40,
  uomId: 9,
  statusCode: 'PICKED',
  managementCode: null,
  pickedAt: '2026-11-18T01:00:00Z',
  pickedWorker: null,
  shipmentId: null,
  portions: [
    {
      warehouseId: 1,
      warehouseCode: 'WH-FG-A',
      warehouseName: '창고 A',
      locationId: 11,
      locationCode: 'A-01-01',
      locationSystemRoleCode: null,
      qty: 40,
    },
  ],
  oqcLotStatus: 'ACCEPTED',
  oqcResult: null,
  replacement: null,
  ...overrides,
});

const line = (overrides: Partial<ShipmentRequestLine> = {}): ShipmentRequestLine => ({
  shipmentRequestLineId: 77,
  lineNo: 1,
  itemId: 31,
  itemCode: 'FG-A100',
  itemName: '센서 모듈',
  requestedQty: 100,
  allocatedQty: 100,
  pickedQty: 40,
  shippedQty: 0,
  uomId: 9,
  uomCode: 'EA',
  salesOrderLine: null,
  shippingInspectionRequired: true,
  picks: [],
  overQty: 0,
  lots: [pickedLot()],
  /* 피처 012 — 줄 출고 창고. 옛 줄(창고 미지정)과 같다. */
  warehouse: null,
  ...overrides,
});

const request = (overrides: Partial<ShipmentRequest> = {}): ShipmentRequest =>
  ({
    shipmentRequestId: 5,
    shipmentRequestNo: 'SR-261118-001',
    salesOrderNo: null,
    customerId: 1,
    shipToPartnerId: 1,
    requestedShipDate: '2026-11-18',
    statusCode: 'RELEASED',
    shippingInspectionStatusCode: 'PENDING',
    shipmentProgressCode: 'PICKING',
    lines: [line()],
    code: 'SHPREQ:SR-261118-001',
    pickingWarehouses: [],
    replacementCount: 0,
    completionBlockers: [{ code: 'PICKING_SHORT', lineNo: 1 }],
    blockerSummary: { PICKING_SHORT: 1 },
    lotJudgmentSummary: { notInspected: 0, accepted: 1, rejected: 0, held: 0 },
    completedShipment: null,
    ...overrides,
  }) as ShipmentRequest;

/** 스캔값 → LOT. 품목 31 이 라인의 품목이다. */
const LOTS: Record<string, { lotId: number; itemId: number }> = {
  'P2611-0001': { lotId: 1, itemId: 31 },
  'P2611-0003': { lotId: 3, itemId: 31 },
  'P2611-0201': { lotId: 20, itemId: 99 },
};

interface Options {
  requests?: ShipmentRequest[];
}

const routes = (options: Options = {}): StubRoute[] => [
  {
    match: (req) => new URL(req.url).pathname === '/logistics/shipment-requests',
    respond: () => jsonResponse({ items: options.requests ?? [request()], page }),
  },
  {
    match: (req) => /^\/mdm\/items\/\d+$/.test(new URL(req.url).pathname),
    respond: (req) => {
      const id = new URL(req.url).pathname.split('/').pop();

      return jsonResponse({
        item: { itemCode: id === '31' ? 'FG-A100' : 'FG-B200', itemName: '센서 모듈' },
      });
    },
  },
  {
    match: (req) => new URL(req.url).pathname === '/mdm/partners',
    respond: () => jsonResponse({ items: [{ partnerId: 1, partnerName: '가나전자' }], page }),
  },
  {
    match: (req) => new URL(req.url).pathname === '/mdm/uoms',
    respond: () => jsonResponse({ items: [{ uomId: 9, uomCode: 'EA' }], page }),
  },
  {
    match: (req) => new URL(req.url).pathname === '/trace/lots',
    respond: (req) => {
      const lotNo = new URL(req.url).searchParams.get('lotNo') ?? '';
      const found = LOTS[lotNo];

      return jsonResponse({
        items: found === undefined ? [] : [{ ...found, lotNo, uomId: 9, statusCode: 'NORMAL' }],
        page,
      });
    },
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

type User = ReturnType<typeof userEvent.setup>;

/* 스캐너 대신 직접 입력으로 같은 값을 넣는다. */
const scan = async (user: User, value: string) => {
  if (screen.queryByRole('button', { name: '피킹' }) === null) {
    await user.click(await screen.findByRole('button', { name: '직접 입력' }));
  }

  const field = screen.getByLabelText('제품 LOT 스캔');

  await user.clear(field);
  await user.type(field, value);
  await user.click(screen.getByRole('button', { name: '피킹' }));
};

const openRequest = async (user: User) => {
  await user.click(await screen.findByRole('button', { name: /SR-261118-001/ }));
  await screen.findByLabelText('제품 LOT 스캔');
};

/** 라인 줄의 품목 단추 — 접근 이름이 「FG-A100 센서 모듈 라인 열기」. */
const lineButton = (itemCode = 'FG-A100') =>
  screen.findByRole('button', { name: new RegExp(`^${itemCode} .*라인 열기$`) });

/** 피킹 라인 표의 그 라인 줄. */
const lineRow = async (itemCode = 'FG-A100') => (await lineButton(itemCode)).closest('tr')!;

/** 라인 줄을 눌러 라인 시트를 연다 — 그 라인의 LOT · 교체 · 출하 관리 코드는 시트에 있다(사용자 지시 2026-11-20). */
const openLine = async (user: User, itemCode = 'FG-A100') => {
  await user.click(await lineButton(itemCode));
  return screen.findByRole('region', { name: '피킹한 LOT' });
};

const capture = (
  pathname: string,
  method: string,
  respond: (req: Request) => Response | Promise<Response>,
  seen: Request[],
): StubRoute => ({
  match: (req) => new URL(req.url).pathname === pathname && req.method === method,
  respond: (req) => {
    seen.push(req.clone());
    return respond(req);
  },
});

/** 쓰기 뒤 다시 읽으면 서버가 새 값을 준다 — 시험의 목록도 그 값을 따라간다. */
const liveList = (read: () => ShipmentRequest[]): StubRoute => ({
  match: (req) => new URL(req.url).pathname === '/logistics/shipment-requests',
  respond: () => jsonResponse({ items: read(), page }),
});

const conflict = (code: string, message = '') =>
  jsonResponse({ code, message, conflictCause: 'user' }, { status: 409 });

beforeEach(() => {
  store.clear();
  setOnline(true);
});

afterEach(() => {
  setOnline(true);
});

describe('M-04-01 제품 피킹 — 지시서 목록', () => {
  it('R-12 연결이 없으면 피킹할 수 없다고 말하고 목록을 열지 않는다', async () => {
    setOnline(false);
    mount();

    expect(await screen.findByText('오프라인이라 피킹할 수 없습니다')).toBeTruthy();
    expect(screen.getByText('LOT 상태와 검사 판정을 확인할 수 없습니다')).toBeTruthy();
    expect(screen.queryByText('오늘 출하 지시서')).toBeNull();
  });

  it('US1-1 카드가 지시서 하나고 라인을 「피킹 / 목표」로 줄여 보인다', async () => {
    mount([], {
      requests: [
        request({
          lines: [
            line(),
            line({
              shipmentRequestLineId: 78,
              lineNo: 2,
              itemId: 32,
              allocatedQty: 50,
              pickedQty: 0,
              lots: [],
            }),
          ],
        }),
      ],
    });

    const card = await screen.findByRole('button', { name: /SR-261118-001/ });

    /* 피처 012 — 줄 창고를 붙인다. 옛 줄은 「창고 미지정」. */
    expect(await within(card).findByText('1. FG-A100 창고 미지정 피킹 40 / 목표 100')).toBeTruthy();
    expect(await within(card).findByText('2. FG-B200 창고 미지정 피킹 0 / 목표 50')).toBeTruthy();
    expect(within(card).getByText('피킹 중, LOT 1')).toBeTruthy();
  });

  it('US1-1 수주가 있는 지시서는 카드와 머리에 수주 번호를 보인다', async () => {
    const user = userEvent.setup();
    mount([], { requests: [request({ salesOrderId: 70, salesOrderNo: 'SO-T1' })] });

    const card = await screen.findByRole('button', { name: /SR-261118-001/ });

    expect(within(card).getByText('수주 SO-T1, 출하 예정 2026-11-18')).toBeTruthy();
    await openRequest(user);
    expect(screen.getByText(/수주 SO-T1/)).toBeTruthy();
  });

  it('Q9 빈 목록이면 지시서가 없다고 말한다', async () => {
    mount([], { requests: [] });

    expect(await screen.findByText('오늘 이 기기에서 피킹할 출하 지시서가 없습니다')).toBeTruthy();
    /* 피처 012 — 범위가 좁아졌으니 무엇이 안 보이는지 적는다(시안 ⑨). */
    expect(screen.getByText(/이 기기 공장 창고 라인이 없는 지시서는 보이지 않습니다/)).toBeTruthy();
  });
});

describe('M-04-01 제품 피킹 — LOT 통째 피킹', () => {
  it('US1-1 지시서를 열면 라인별 목표·피킹·남음이 보이고 수량 칸과 숫자판이 없다', async () => {
    const user = userEvent.setup();
    mount();
    await openRequest(user);

    /* 라인 한 줄 — No · 품목 · LOT 수 · 피킹 / 목표(사용자 지시 2026-11-20). */
    const row = await lineRow();
    expect(row).toHaveTextContent('1');
    expect(row).toHaveTextContent('FG-A100');
    expect(row).toHaveTextContent('40/100 EA');
    expect(row).toHaveAttribute('data-reached', 'false');
    expect(screen.queryByLabelText(/피킹 수량/)).toBeNull();
    expect(screen.queryByRole('button', { name: '피킹 확정' })).toBeNull();
  });

  it('Q2 LOT 줄에 창고·위치별 몫이 보인다', async () => {
    const user = userEvent.setup();
    mount([], {
      requests: [
        request({
          lines: [
            line({
              lots: [
                pickedLot({
                  portions: [
                    {
                      warehouseId: 1,
                      warehouseCode: 'A',
                      warehouseName: '창고 A',
                      locationId: 1,
                      locationCode: 'A-01-02',
                      locationSystemRoleCode: null,
                      qty: 20,
                    },
                    {
                      warehouseId: 2,
                      warehouseCode: 'B',
                      warehouseName: '창고 B',
                      locationId: 2,
                      locationCode: 'B-02-01',
                      locationSystemRoleCode: null,
                      qty: 20,
                    },
                  ],
                }),
              ],
            }),
          ],
        }),
      ],
    });
    await openRequest(user);
    await openLine(user);

    expect(await screen.findByText('창고 A, A-01-02')).toBeTruthy();
    expect(screen.getByText('창고 B, B-02-01')).toBeTruthy();
    expect(screen.queryByText('적치 대기')).toBeNull();
  });

  it('R-2·Q2 적치 대기 자리 몫은 위치 코드(창고 접두가 붙은 시스템 코드) 대신 「적치 대기」로 보인다', async () => {
    const user = userEvent.setup();
    mount([], {
      requests: [
        request({
          lines: [
            line({
              lots: [
                pickedLot({
                  portions: [
                    {
                      warehouseId: 1,
                      warehouseCode: 'A',
                      warehouseName: '창고 A',
                      locationId: 9,
                      locationCode: '89YE-SYS-STAGING',
                      locationSystemRoleCode: 'PUTAWAY_STAGING',
                      qty: 10,
                    },
                  ],
                }),
              ],
            }),
          ],
        }),
      ],
    });
    await openRequest(user);
    await openLine(user);

    expect(await screen.findByText('창고 A')).toBeTruthy();
    expect(screen.getByText('적치 대기')).toBeTruthy();
    expect(screen.queryByText(/SYS-STAGING/)).toBeNull();
  });

  it('US1-1 LOT 스캔이 바로 :pick-lot 을 부르고 수량 없이 LOT 번호만 싣는다', async () => {
    const user = userEvent.setup();
    const seen: Request[] = [];
    const fresh = pickedLot({
      shipmentRequestLotId: 503,
      lotId: 3,
      lotNo: 'P2611-0003',
      pickedQty: 70,
      oqcLotStatus: 'NOT_INSPECTED',
      pickedAt: '2026-11-18T05:00:00Z',
    });
    const after = line({ pickedQty: 110, overQty: 10, lots: [pickedLot(), fresh] });
    let current = [request()];
    mount([
      liveList(() => current),
      capture(
        '/logistics/shipment-requests/5/lines/77:pick-lot',
        'POST',
        () => {
          current = [request({ lines: [after] })];
          return jsonResponse({ pickedLot: fresh, line: after });
        },
        seen,
      ),
    ]);
    await openRequest(user);
    await scan(user, 'P2611-0003');

    await waitFor(() => {
      expect(seen).toHaveLength(1);
    });
    expect(await seen[0]?.json()).toEqual({ lotNo: 'P2611-0003' });
    expect(seen[0]?.headers.get('X-Worker-No')).toBe('900028');
    expect(seen[0]?.headers.get('Idempotency-Key')).toBeTruthy();
    /* 방금 찍은 결과 칸 — 품목 · 큰 수량 · LOT 번호 전체 · 「목표 채움」(사용자 지시 2026-11-20). */
    const result = within(await screen.findByRole('region', { name: '피킹됨' }));
    expect(result.getByText('P2611-0003')).toBeTruthy();
    expect(result.getByText('70')).toBeTruthy();
    expect(result.getByText('목표 채움')).toBeTruthy();
    expect(result.getByText('라인 1 목표 100 을 채웠습니다, 초과 10')).toBeTruthy();
    const row = await lineRow();
    await waitFor(() => {
      expect(row).toHaveTextContent('110/100 EA');
    });
    expect(row).toHaveAttribute('data-current', 'true');
    expect(row).toHaveAttribute('data-reached', 'true');
  });

  it('US1-1 같은 품목 라인이 둘이면 남은 수량이 있는 앞 라인으로 보낸다', async () => {
    const user = userEvent.setup();
    const seen: Request[] = [];
    mount(
      [
        capture(
          '/logistics/shipment-requests/5/lines/78:pick-lot',
          'POST',
          () =>
            jsonResponse({
              pickedLot: pickedLot(),
              line: line({ shipmentRequestLineId: 78, lineNo: 2 }),
            }),
          seen,
        ),
      ],
      {
        requests: [
          request({
            lines: [
              line({ pickedQty: 100, lots: [] }),
              line({ shipmentRequestLineId: 78, lineNo: 2, pickedQty: 0, lots: [] }),
            ],
          }),
        ],
      },
    );
    await openRequest(user);
    await scan(user, 'P2611-0003');

    await waitFor(() => {
      expect(seen).toHaveLength(1);
    });
  });

  it('US1-2 목표를 채운 라인에 스캔하면 「목표 수량을 채웠습니다」로 거절한다', async () => {
    const user = userEvent.setup();
    mount(
      [
        {
          match: (req) => new URL(req.url).pathname.endsWith(':pick-lot'),
          respond: () => conflict('LOT_TARGET_REACHED', '목표 수량을 채웠습니다.'),
        },
      ],
      { requests: [request({ lines: [line({ pickedQty: 110, overQty: 10 })] })] },
    );
    await openRequest(user);
    await scan(user, 'P2611-0003');

    const banner = await screen.findByRole('alert', { name: /목표 수량을 채웠습니다/ });
    expect(within(banner).getByText(/라인 1 은 목표 100 에 피킹 110 입니다/)).toBeTruthy();
    expect(within(banner).getByText('피킹하지 않았습니다')).toBeTruthy();
  });

  it('FR-006 다른 작업에 잡힌 LOT · 이미 피킹한 LOT 을 코드별 문구로 거절한다', async () => {
    const user = userEvent.setup();
    let answer = 'LOT_ALREADY_RESERVED';
    mount([
      {
        match: (req) => new URL(req.url).pathname.endsWith(':pick-lot'),
        respond: () => conflict(answer),
      },
    ]);
    await openRequest(user);
    await scan(user, 'P2611-0003');
    expect(await screen.findByText('다른 작업에 잡힌 LOT 입니다')).toBeTruthy();

    /* 이미 피킹한 LOT 은 보내지 않고 회색으로 몇 번 라인인지 알린다(사용자 지시 2026-11-20). */
    await scan(user, 'P2611-0001');
    const already = within(await screen.findByRole('region', { name: '이미 피킹한 LOT입니다' }));
    expect(already.getByText('피킹 라인 No 1에 있습니다')).toBeTruthy();
    expect(await lineRow()).toHaveAttribute('data-duplicate', 'true');

    /* 다른 기기가 먼저 집어 서버가 막으면 코드별 문구로. */
    answer = 'LOT_ALREADY_PICKED';
    await scan(user, 'P2611-0003');
    expect(await screen.findByText('이미 이 지시서에 피킹한 LOT 입니다')).toBeTruthy();
  });

  it('US3-1 · Q14 분리 확인 전 LOT 은 「분리 확인 전인 LOT 입니다」와 할 일을 보인다(피처 013)', async () => {
    const user = userEvent.setup();
    mount([
      {
        match: (req) => new URL(req.url).pathname.endsWith(':pick-lot'),
        respond: () => conflict('LOT_SPLIT_UNCONFIRMED'),
      },
    ]);
    await openRequest(user);
    await scan(user, 'P2611-0003');

    const banner = await screen.findByRole('alert', { name: '분리 확인 전인 LOT 입니다' });
    expect(
      within(banner).getByText(
        'POP 에서 나눈 뒤 PDA 「LOT 분리 확인」을 하지 않았습니다. 두 라벨을 스캔해 확인한 뒤 다시 스캔하세요',
      ),
    ).toBeTruthy();
    expect(within(banner).getByText('피킹하지 않았습니다')).toBeTruthy();
  });

  it('FR-006 보류·불량·재고 없음은 서버 문구를 보인다', async () => {
    const user = userEvent.setup();
    mount([
      {
        match: (req) => new URL(req.url).pathname.endsWith(':pick-lot'),
        respond: () => conflict('INVALID_STATE', '보류 중인 LOT 입니다. (사유: QC)'),
      },
    ]);
    await openRequest(user);
    await scan(user, 'P2611-0003');

    expect(await screen.findByText('보류 중인 LOT 입니다. (사유: QC)')).toBeTruthy();
  });

  it('FR-006 이 지시서에 그 품목 라인이 없으면 보내지 않고 알린다', async () => {
    const user = userEvent.setup();
    const seen: Request[] = [];
    mount([
      capture(
        '/logistics/shipment-requests/5/lines/77:pick-lot',
        'POST',
        () => jsonResponse({}),
        seen,
      ),
    ]);
    await openRequest(user);
    await scan(user, 'P2611-0201');

    expect(await screen.findByText('이 지시서에 이 품목 라인이 없습니다')).toBeTruthy();
    expect(seen).toHaveLength(0);
  });

  it('FR-006 이 공장에서 찾지 못한 번호는 보내지 않고 알린다', async () => {
    const user = userEvent.setup();
    mount();
    await openRequest(user);
    await scan(user, 'NOPE-1');

    expect(await screen.findByText('이 공장의 LOT 이 아닙니다')).toBeTruthy();
  });

  it('US1-1 전송이 실패하면 같은 LOT 재스캔은 같은 멱등 키로 간다', async () => {
    const user = userEvent.setup();
    const seen: Request[] = [];
    let reachable = false;
    mount([
      capture(
        '/logistics/shipment-requests/5/lines/77:pick-lot',
        'POST',
        () => {
          if (!reachable) {
            throw new TypeError('Failed to fetch');
          }

          return jsonResponse({ pickedLot: pickedLot(), line: line() });
        },
        seen,
      ),
    ]);
    await openRequest(user);
    await scan(user, 'P2611-0003');
    expect(await screen.findByText('피킹을 기록하지 못했습니다')).toBeTruthy();

    reachable = true;
    await scan(user, 'P2611-0003');

    await waitFor(() => {
      expect(seen).toHaveLength(2);
    });
    expect(seen[1]?.headers.get('Idempotency-Key')).toBe(seen[0]?.headers.get('Idempotency-Key'));
  });

  it('US1-1 전송 실패 띠의 [다시 시도]는 실패한 그 LOT 을 같은 멱등 키로 다시 보낸다(시안 ⑩)', async () => {
    const user = userEvent.setup();
    const seen: Request[] = [];
    let reachable = false;
    mount([
      capture(
        '/logistics/shipment-requests/5/lines/77:pick-lot',
        'POST',
        () => {
          if (!reachable) {
            throw new TypeError('Failed to fetch');
          }

          return jsonResponse({ pickedLot: pickedLot(), line: line() });
        },
        seen,
      ),
    ]);
    await openRequest(user);
    await scan(user, 'P2611-0003');
    const banner = await screen.findByRole('alert', { name: '피킹을 기록하지 못했습니다' });

    reachable = true;
    await user.click(within(banner).getByRole('button', { name: '다시 시도' }));

    await waitFor(() => {
      expect(seen).toHaveLength(2);
    });
    expect(seen[1]?.headers.get('Idempotency-Key')).toBe(seen[0]?.headers.get('Idempotency-Key'));
    expect(((await seen[1]?.clone().json()) as { lotNo: string }).lotNo).toBe('P2611-0003');
  });

  it('뒤로가기는 연 지시서를 먼저 닫는다', async () => {
    const user = userEvent.setup();
    mount();
    await openRequest(user);

    expect(runBackStep()).toBe(true);

    expect(await screen.findByRole('button', { name: /SR-261118-001/ })).toBeTruthy();
  });
});

describe('M-04-01 제품 피킹 — OQC 판정과 [교체]', () => {
  it('FR-007 LOT 판정 배지 6종을 보인다', async () => {
    const user = userEvent.setup();
    const statuses = [
      'NOT_INSPECTED',
      'ACCEPTED',
      'REJECTED',
      'HELD',
      'NOT_REQUIRED',
      'SKIPPED',
    ] as const;
    mount([], {
      requests: [
        request({
          lines: [
            line({
              lots: statuses.map((status, index) =>
                pickedLot({
                  shipmentRequestLotId: 600 + index,
                  lotId: 600 + index,
                  lotNo: `L-${String(index)}`,
                  oqcLotStatus: status,
                }),
              ),
            }),
          ],
        }),
      ],
    });
    await openRequest(user);
    await openLine(user);

    for (const label of ['미검사', '합격', '불합격', '보류', '검사 불필요', '검사 생략']) {
      expect(await screen.findByText(label)).toBeTruthy();
    }
  });

  it('US2-1 불합격 LOT 에만 [교체]가 있다', async () => {
    const user = userEvent.setup();
    mount([], {
      requests: [
        request({
          lines: [
            line({
              lots: [
                pickedLot({
                  shipmentRequestLotId: 501,
                  lotNo: 'P2611-0001',
                  oqcLotStatus: 'ACCEPTED',
                }),
                pickedLot({
                  shipmentRequestLotId: 503,
                  lotId: 3,
                  lotNo: 'P2611-0003',
                  oqcLotStatus: 'REJECTED',
                }),
                pickedLot({
                  shipmentRequestLotId: 504,
                  lotId: 4,
                  lotNo: 'P2611-0004',
                  oqcLotStatus: 'HELD',
                }),
              ],
            }),
          ],
        }),
      ],
    });
    await openRequest(user);

    /* 불합격은 라인 줄 칩으로만 알린다 — [교체]는 시트에. */
    expect(await lineRow()).toHaveTextContent('불합격 1');
    expect(screen.queryByRole('button', { name: /교체/ })).toBeNull();

    await openLine(user);
    expect(await screen.findAllByRole('button', { name: /교체/ })).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'P2611-0003 교체' })).toBeTruthy();
  });

  it('US2-1 불합격 줄에 판정을 정한 「OQC 결과 n, 시각」을 보인다', async () => {
    const user = userEvent.setup();
    mount([], {
      requests: [
        request({
          lines: [
            line({
              lots: [
                pickedLot({
                  shipmentRequestLotId: 503,
                  lotId: 3,
                  lotNo: 'P2611-0003',
                  oqcLotStatus: 'REJECTED',
                  oqcResult: {
                    inspectionResultId: 2,
                    resultNo: 'IRS-2',
                    round: 2,
                    resultAt: '2026-11-18T07:10:00Z',
                  },
                }),
              ],
            }),
          ],
        }),
      ],
    });
    await openRequest(user);
    await openLine(user);

    expect(await screen.findByText('OQC 결과 2, 14:10')).toBeTruthy();
  });

  it('US2-2 [교체]는 확인 상자 뒤 :replace 를 부르고 부적합 번호와 다시 받는 수량을 보인다', async () => {
    const user = userEvent.setup();
    const seen: Request[] = [];
    const rejected = pickedLot({
      shipmentRequestLotId: 503,
      lotId: 3,
      lotNo: 'P2611-0003',
      pickedQty: 30,
      oqcLotStatus: 'REJECTED',
    });
    let current = [
      request({
        lines: [
          line({ pickedQty: 110, overQty: 10, lots: [pickedLot({ pickedQty: 80 }), rejected] }),
        ],
      }),
    ];
    const respond = (after: ShipmentRequestLine) => {
      current = [request({ lines: [after] })];
      return jsonResponse({
        replacedLot: { ...rejected, statusCode: 'REPLACED' },
        nonconformanceNo: 'NC-261118-0004',
        line: after,
      });
    };
    mount([
      liveList(() => current),
      capture(
        '/logistics/shipment-request-lots/503:replace',
        'POST',
        () =>
          respond(
            line({
              pickedQty: 80,
              lots: [
                pickedLot({ pickedQty: 80 }),
                {
                  ...rejected,
                  statusCode: 'REPLACED',
                  replacement: {
                    inspectionResultId: 1,
                    resultNo: '2',
                    resultRound: 2,
                    resultAt: '2026-11-18T07:10:00Z',
                    judgment: 'REJECTED',
                    nonconformanceId: 4,
                    nonconformanceNo: 'NC-261118-0004',
                    replacedAt: '2026-11-18T07:22:00Z',
                    worker: { workerId: 1, workerNo: '900028', workerName: '김철수' },
                  },
                },
              ],
            }),
          ),
        seen,
      ),
    ]);
    await openRequest(user);
    await openLine(user);
    await user.click(await screen.findByRole('button', { name: 'P2611-0003 교체' }));

    /* 확인 창이 시트 자리에 선다. */
    const dialog = await screen.findByRole('dialog', { name: 'P2611-0003 을 교체할까요?' });
    expect(within(dialog).getByText('P2611-0003 을 교체할까요?')).toBeTruthy();
    expect(
      within(dialog).getByText('피킹에서 30 EA 가 빠집니다(라인 1 피킹 110 → 80)'),
    ).toBeTruthy();
    expect(within(dialog).getByText('라인 1 이 20 EA 를 다시 받습니다')).toBeTruthy();
    expect(seen).toHaveLength(0);

    await user.click(within(dialog).getByRole('button', { name: '교체' }));

    await waitFor(() => {
      expect(seen).toHaveLength(1);
    });
    expect(seen[0]?.headers.get('X-Worker-No')).toBe('900028');
    expect(await screen.findByText('P2611-0003 을 교체했습니다')).toBeTruthy();
    expect(screen.getByText('부적합 NC-261118-0004 이 생겼습니다')).toBeTruthy();
    expect(screen.getByText('라인 1 이 20 EA 를 더 받습니다. 다른 LOT 을 스캔하세요')).toBeTruthy();
    expect(screen.getByRole('region', { name: '교체됨' })).toBeTruthy();
    const lots = await openLine(user);
    expect(await within(lots).findByText('교체됨')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'P2611-0003 교체' })).toBeNull();
  });

  it('US2-6 교체 전에 재검 합격이 들어오면 「교체하지 않았습니다」와 까닭을 보인다', async () => {
    const user = userEvent.setup();
    mount(
      [
        {
          match: (req) => new URL(req.url).pathname.endsWith(':replace'),
          respond: () => conflict('LOT_NOT_REJECTED'),
        },
      ],
      {
        requests: [
          request({
            lines: [
              line({
                lots: [
                  pickedLot({
                    shipmentRequestLotId: 503,
                    lotNo: 'P2611-0003',
                    oqcLotStatus: 'REJECTED',
                  }),
                ],
              }),
            ],
          }),
        ],
      },
    );
    await openRequest(user);
    await openLine(user);
    await user.click(await screen.findByRole('button', { name: 'P2611-0003 교체' }));
    await user.click(
      within(await screen.findByRole('dialog', { name: 'P2611-0003 을 교체할까요?' })).getByRole(
        'button',
        { name: '교체' },
      ),
    );

    expect(await screen.findByText('교체하지 않았습니다')).toBeTruthy();
    expect(
      screen.getByText(
        '교체 전에 이 LOT 의 재검 합격이 들어와 교체할 필요가 없습니다. LOT 은 피킹된 채 남습니다',
      ),
    ).toBeTruthy();
  });
});

describe('M-04-01 제품 피킹 — 출하 관리 코드', () => {
  it('US5-1 ✎ 로 연 코드 칸이 스캐너 입력을 받아 Enter 로 저장한다 — LOT 피킹으로 가지 않는다', async () => {
    const user = userEvent.setup();
    const seen: Request[] = [];
    const pickSeen: Request[] = [];
    mount([
      capture(
        '/logistics/shipment-request-lots/501/management-code',
        'PUT',
        () => jsonResponse(pickedLot({ managementCode: 'GN-PLT-0007' })),
        seen,
      ),
      capture(
        '/logistics/shipment-requests/5/lines/77:pick-lot',
        'POST',
        () => jsonResponse({}),
        pickSeen,
      ),
    ]);
    await openRequest(user);
    await openLine(user);
    await user.click(
      await screen.findByRole('button', { name: 'P2611-0001 출하 관리 코드 고치기' }),
    );

    /* 스캐너는 초점이 있는 코드 칸에 글자와 Enter 를 친다. */
    await user.type(
      screen.getByLabelText('출하 관리 코드(선택), 100자 이하'),
      'GN-PLT-0007{Enter}',
    );

    await waitFor(() => {
      expect(seen).toHaveLength(1);
    });
    expect(await seen[0]?.json()).toEqual({ managementCode: 'GN-PLT-0007' });
    expect(seen[0]?.headers.get('X-Worker-No')).toBe('900028');
    expect(pickSeen).toHaveLength(0);
    expect(await screen.findByText('GN-PLT-0007')).toBeTruthy();
  });

  it('US5-4 직접 입력은 [저장]이고 비우면 지운다', async () => {
    const user = userEvent.setup();
    const seen: Request[] = [];
    mount(
      [
        capture(
          '/logistics/shipment-request-lots/501/management-code',
          'PUT',
          () => jsonResponse(pickedLot({ managementCode: null })),
          seen,
        ),
      ],
      {
        requests: [request({ lines: [line({ lots: [pickedLot({ managementCode: 'OLD-1' })] })] })],
      },
    );
    await openRequest(user);
    await openLine(user);
    await user.click(
      await screen.findByRole('button', { name: 'P2611-0001 출하 관리 코드 고치기' }),
    );

    const field = screen.getByLabelText('출하 관리 코드(선택), 100자 이하');
    expect(field).toHaveValue('OLD-1');
    await user.clear(field);
    await user.click(screen.getByRole('button', { name: '저장' }));

    await waitFor(() => {
      expect(seen).toHaveLength(1);
    });
    expect(await seen[0]?.json()).toEqual({ managementCode: null });
  });

  it('US5-2 101자는 「100자까지 넣을 수 있습니다」로 막고 보내지 않는다', async () => {
    const user = userEvent.setup();
    const seen: Request[] = [];
    mount([
      capture(
        '/logistics/shipment-request-lots/501/management-code',
        'PUT',
        () => jsonResponse({}),
        seen,
      ),
    ]);
    await openRequest(user);
    await openLine(user);
    await user.click(
      await screen.findByRole('button', { name: 'P2611-0001 출하 관리 코드 고치기' }),
    );

    const field = screen.getByLabelText('출하 관리 코드(선택), 100자 이하');
    await user.click(field);
    await user.paste('a'.repeat(101));

    expect(await screen.findByText('100자까지 넣을 수 있습니다')).toBeTruthy();
    expect(screen.getByRole('button', { name: '저장' }).hasAttribute('disabled')).toBe(true);
    expect(seen).toHaveLength(0);
  });

  it('US5-1 저장이 실패하면 그 자리에 다시 하라고 남긴다', async () => {
    const user = userEvent.setup();
    mount([
      {
        match: (req) => new URL(req.url).pathname.endsWith('/management-code'),
        respond: () => {
          throw new TypeError('Failed to fetch');
        },
      },
    ]);
    await openRequest(user);
    await openLine(user);
    await user.click(
      await screen.findByRole('button', { name: 'P2611-0001 출하 관리 코드 고치기' }),
    );
    await user.type(
      screen.getByLabelText('출하 관리 코드(선택), 100자 이하'),
      'GN-PLT-0009{Enter}',
    );

    expect(
      await screen.findByText('코드를 저장하지 못했습니다. 다시 스캔하거나 입력하세요'),
    ).toBeTruthy();
  });
});

describe('M-04-01 제품 피킹 — 지시서 코드 보기', () => {
  it('US4-1 SHPREQ 코드 QR 과 번호, 막는 이유를 전체 화면으로 보인다', async () => {
    const user = userEvent.setup();
    mount([], {
      requests: [
        request({
          completionBlockers: [
            { code: 'NOT_INSPECTED', lotNo: 'P2611-0004' },
            { code: 'SALES_ORDER_LINE_CANCELLED', lineNo: 2 },
          ],
        }),
      ],
    });
    await openRequest(user);
    await user.click(screen.getByRole('button', { name: '지시서 코드 보기' }));

    expect(await screen.findByRole('img', { name: '출하 지시서 SR-261118-001 QR' })).toBeTruthy();
    expect(screen.getByText('SHPREQ:SR-261118-001')).toBeTruthy();
    expect(screen.getByText('POP 「출하 완료」 화면의 스캐너에 비추세요')).toBeTruthy();
    expect(screen.getByText('아직 완료할 수 없습니다')).toBeTruthy();
    expect(screen.getByText('미검사 LOT P2611-0004')).toBeTruthy();
    expect(
      screen.getByText('라인 2 수주 라인이 취소되었습니다. 담당자에게 문의하세요'),
    ).toBeTruthy();

    await user.click(screen.getByRole('button', { name: '닫기' }));
    expect(await screen.findByLabelText('제품 LOT 스캔')).toBeTruthy();
  });

  describe('US4-4·Q9 고객·납품처 — 단말은 거래처 마스터를 못 읽으므로 지시서 응답의 이름을 쓴다', () => {
    const partnersDenied: StubRoute = {
      match: (req) => new URL(req.url).pathname.startsWith('/mdm/partners'),
      respond: () => new Response(JSON.stringify({ message: 'denied' }), { status: 401 }),
    };
    const named = () =>
      request({
        customerId: 1,
        shipToPartnerId: 2,
        customer: { partnerId: 1, partnerCode: 'C1', partnerName: '가나전자' },
        shipTo: { partnerId: 2, partnerCode: 'S2', partnerName: '가나전자 2공장' },
      });

    it('US4-4 목록 카드에 「고객, 납품처」를 보인다', async () => {
      mount([partnersDenied], { requests: [named()] });

      const card = await screen.findByRole('button', { name: /SR-261118-001/ });

      expect(within(card).getByText('가나전자, 가나전자 2공장')).toBeTruthy();
    });

    it('US4-4 상세 머리에 고객·납품처를 보인다', async () => {
      const user = userEvent.setup();
      mount([partnersDenied], { requests: [named()] });
      await openRequest(user);

      /* 지시서는 머리 한 줄 — 「고객, 납품처, 수주, 출하 예정」(사용자 지시 2026-11-20). */
      const head = screen.getByRole('region', { name: 'SR-261118-001' });
      expect(head).toHaveTextContent(/가나전자.*가나전자 2공장/);
    });

    it('US4-1·Q9 「지시서 코드 보기」에 고객·납품처를 보인다', async () => {
      const user = userEvent.setup();
      mount([partnersDenied], { requests: [named()] });
      await openRequest(user);
      await user.click(screen.getByRole('button', { name: '지시서 코드 보기' }));

      await screen.findByRole('img', { name: '출하 지시서 SR-261118-001 QR' });
      expect(screen.getByText('가나전자, 가나전자 2공장')).toBeTruthy();
    });

    it('US4-4 고객과 납품처가 같으면 한 번만 쓴다', async () => {
      mount([partnersDenied], {
        requests: [
          request({
            customer: { partnerId: 1, partnerCode: 'C1', partnerName: '다라상사' },
            shipTo: { partnerId: 1, partnerCode: 'C1', partnerName: '다라상사' },
          }),
        ],
      });

      const card = await screen.findByRole('button', { name: /SR-261118-001/ });

      expect(within(card).getByText('다라상사')).toBeTruthy();
    });
  });

  it('US4-1 막는 이유가 없으면 「아직 완료할 수 없습니다」를 보이지 않는다', async () => {
    const user = userEvent.setup();
    mount([], { requests: [request({ completionBlockers: [] })] });
    await openRequest(user);
    await user.click(screen.getByRole('button', { name: '지시서 코드 보기' }));

    await screen.findByRole('img', { name: '출하 지시서 SR-261118-001 QR' });
    expect(screen.queryByText('아직 완료할 수 없습니다')).toBeNull();
  });
});

/* ── 피처 012 — 줄 출고 창고 · 이 기기 범위(US2 · quickstart Q6~Q8) ───────────────────────── */

const WH_A = { warehouseId: 1, warehouseCode: 'WH-FG-A', warehouseName: '완제품창고 A', plantId: 1, plantName: '1공장' };
const WH_B = { warehouseId: 2, warehouseCode: 'WH-FG-B', warehouseName: '완제품창고 B', plantId: 2, plantName: '2공장' };
const WH_C = { warehouseId: 3, warehouseCode: 'WH-FG-C', warehouseName: '완제품창고 C', plantId: 1, plantName: '1공장' };
const UNIT_X = { businessUnitId: 7, businessUnitCode: 'BU-X', businessUnitName: '사업부 X' };

/** 줄1 = 창고 A(이 기기) · 줄2 = 창고 B(다른 공장) · 줄3 = 창고 C(같은 공장, 같은 품목). */
const scopedRequest = (overrides: Partial<ShipmentRequest> = {}) =>
  request({
    businessUnit: UNIT_X,
    lines: [
      line({ warehouse: WH_A, inTerminalScope: true, outOfScopeReason: null, allocatedQty: 60, pickedQty: 0, lots: [] }),
      line({
        shipmentRequestLineId: 79,
        lineNo: 2,
        warehouse: WH_B,
        inTerminalScope: false,
        outOfScopeReason: 'OTHER_PLANT',
        allocatedQty: 40,
        pickedQty: 0,
        lots: [],
      }),
      line({
        shipmentRequestLineId: 80,
        lineNo: 3,
        warehouse: WH_C,
        inTerminalScope: true,
        outOfScopeReason: null,
        allocatedQty: 40,
        pickedQty: 0,
        lots: [],
      }),
    ],
    pickableLineCount: 2,
    ...overrides,
  });

describe('M-04-01 제품 피킹 — 줄 출고 창고(피처 012)', () => {
  it('US2-1·Q6 카드는 이 기기 줄만 「창고 피킹 / 목표」로 세고, 다른 공장 창고 줄은 한 줄로 접는다', async () => {
    mount([], { requests: [scopedRequest()] });

    const card = await screen.findByRole('button', { name: /SR-261118-001/ });

    expect(await within(card).findByText('1. FG-A100 완제품창고 A (1공장) 피킹 0 / 목표 60')).toBeTruthy();
    expect(within(card).getByText('3. FG-A100 완제품창고 C (1공장) 피킹 0 / 목표 40')).toBeTruthy();
    expect(within(card).queryByText(/완제품창고 B/)).toBeNull();
    expect(within(card).getByText('다른 공장 창고 라인 1')).toBeTruthy();
    expect(screen.getByText(/이 기기 공장 창고 라인이 있는 지시서만 보입니다/)).toBeTruthy();
  });

  it('US2-2·Q6 지시서 머리에 사업부, 줄마다 출고 창고, 다른 공장 창고 줄은 읽기만 한다', async () => {
    const user = userEvent.setup();
    mount([], { requests: [scopedRequest()] });
    await openRequest(user);

    expect(screen.getByText('사업부 X')).toBeTruthy();
    const firstRow = (await screen.findAllByRole('button', { name: /^FG-A100 .*라인 열기$/ }))[0]!.closest('tr')!;
    expect(within(firstRow).getByText('완제품창고 A (1공장)')).toBeTruthy();

    const outside = screen
      .getByText('다른 공장 창고(완제품창고 B (2공장)), 이 기기에서 피킹하지 않습니다')
      .closest('tr')!;

    expect(outside).toHaveAttribute('data-out-of-scope', 'true');
    /* 누를 자리가 없다 — LOT · 교체 · 코드 칸을 여는 길이 없다. */
    expect(within(outside).queryByRole('button')).toBeNull();
    expect(outside).toHaveTextContent('0/40 EA');
    /* FR-025 — 완료 전 화면에 ERP 송신 여부를 보이지 않는다. */
    expect(screen.queryByText(/ERP/)).toBeNull();
  });

  it('US2-6·Q8 창고가 지정된 기기는 같은 공장 다른 창고 줄을 「이 기기 창고 밖」으로 읽기만 한다', async () => {
    const user = userEvent.setup();
    const lines = scopedRequest().lines!.map((each) =>
      each.lineNo === 3 ? { ...each, inTerminalScope: false, outOfScopeReason: 'OTHER_WAREHOUSE' as const } : each,
    );
    mount([], { requests: [scopedRequest({ lines, pickableLineCount: 1 })] });

    const card = await screen.findByRole('button', { name: /SR-261118-001/ });
    expect(within(card).getByText('이 기기 창고 밖 라인 1')).toBeTruthy();

    await openRequest(user);
    expect(
      screen.getByText('이 기기 창고 밖(완제품창고 C (1공장)), 이 기기에서 피킹하지 않습니다'),
    ).toBeTruthy();
  });

  it('US2-4 같은 품목이면 서버가 LOT 창고로 고른 줄(응답 line)로 화면을 갱신한다', async () => {
    const user = userEvent.setup();
    const seen: Request[] = [];
    let current = scopedRequest();
    mount(
      [
        capture(
          '/logistics/shipment-requests/5/lines/77:pick-lot',
          'POST',
          () => {
            const picked = { ...current.lines![2]!, pickedQty: 40, lots: [pickedLot({ shipmentRequestLotId: 601, lotNo: 'P2611-0003', lotId: 3 })] };
            current = { ...current, lines: current.lines!.map((each) => (each.lineNo === 3 ? picked : each)) };
            return jsonResponse({ pickedLot: picked.lots[0], line: picked });
          },
          seen,
        ),
        liveList(() => [current]),
      ],
    );
    await openRequest(user);
    await scan(user, 'P2611-0003');

    /* 경로는 이 기기 줄 중 앞 줄(77)이지만, 서버가 고른 줄 3 이 피킹됐다고 말한다. */
    expect(await screen.findByText('라인 3 목표 40 을 채웠습니다')).toBeTruthy();
    expect(seen).toHaveLength(1);
    const row3 = screen.getAllByRole('row').find((row) => row.getAttribute('data-current') === 'true')!;
    expect(row3).toHaveTextContent('40/40 EA');
  });

  it('US2-5·Q7 줄 창고에 없는 LOT 은 LOT 이 있는 창고를 적어 거절한다', async () => {
    const user = userEvent.setup();
    mount(
      [
        {
          match: (req) => new URL(req.url).pathname.endsWith(':pick-lot'),
          respond: () =>
            jsonResponse(
              {
                code: 'LOT_NOT_IN_LINE_WAREHOUSE',
                message: '이 지시서의 출고 창고에 없는 LOT 입니다.',
                conflictCause: 'user',
                warehouses: [WH_B],
              },
              { status: 409 },
            ),
        },
      ],
      { requests: [scopedRequest()] },
    );
    await openRequest(user);
    await scan(user, 'P2611-0003');

    const banner = await screen.findByRole('alert', { name: '이 지시서의 출고 창고에 없는 LOT 입니다' });
    expect(within(banner).getByText('LOT 이 있는 창고: 완제품창고 B(2공장)')).toBeTruthy();
    expect(within(banner).getByText('피킹하지 않았습니다')).toBeTruthy();
  });

  it('E-2 줄 창고를 쓸 수 없으면 「출고 창고를 쓸 수 없습니다」로 막고 할 일을 적는다', async () => {
    const user = userEvent.setup();
    mount(
      [
        {
          match: (req) => new URL(req.url).pathname.endsWith(':pick-lot'),
          respond: () => conflict('LINE_WAREHOUSE_UNAVAILABLE', '출고 창고를 쓸 수 없습니다.'),
        },
      ],
      { requests: [scopedRequest()] },
    );
    await openRequest(user);
    await scan(user, 'P2611-0003');

    const banner = await screen.findByRole('alert', { name: '출고 창고를 쓸 수 없습니다' });
    expect(within(banner).getByText(/지시서를 취소하고 다시 만들어야 합니다/)).toBeTruthy();
  });

  it('Edge-span·Q7 두 창고에 걸친 LOT 은 줄 창고 몫만 집고 「다른 창고에 n EA 남음」을 결과와 LOT 줄에 적는다', async () => {
    const user = userEvent.setup();
    let current = scopedRequest();
    mount(
      [
        {
          match: (req) => new URL(req.url).pathname.endsWith(':pick-lot'),
          respond: () => {
            const lot = pickedLot({ shipmentRequestLotId: 602, lotNo: 'P2611-0003', lotId: 3, pickedQty: 20 });
            const picked = { ...current.lines![0]!, pickedQty: 20, lots: [lot] };
            current = { ...current, lines: current.lines!.map((each) => (each.lineNo === 1 ? picked : each)) };
            return jsonResponse({ pickedLot: lot, line: picked, otherWarehouseQty: 15 });
          },
        },
        liveList(() => [current]),
      ],
    );
    await openRequest(user);
    await scan(user, 'P2611-0003');

    expect(await screen.findByText('라인 1, 완제품창고 A 몫만 피킹했습니다')).toBeTruthy();
    expect(screen.getByText('다른 창고에 15 EA 남음')).toBeTruthy();

    await user.click((await screen.findAllByRole('button', { name: /^FG-A100 .*라인 열기$/ }))[0]!);
    const sheet = await screen.findByRole('region', { name: '피킹한 LOT' });
    expect(within(sheet).getByText('다른 창고에 15 EA 남음')).toBeTruthy();
    expect(within(sheet).getByText('완제품창고 A (1공장)')).toBeTruthy();
  });

  it('그 품목 줄이 범위 밖뿐이면 보내지 않고 「이 기기에서 피킹할 이 품목 줄이 없습니다」', async () => {
    const user = userEvent.setup();
    const seen: Request[] = [];
    const only = scopedRequest({
      lines: [
        line({ itemId: 32, warehouse: WH_A, inTerminalScope: true, outOfScopeReason: null, lots: [] }),
        line({ shipmentRequestLineId: 79, lineNo: 2, warehouse: WH_B, inTerminalScope: false, outOfScopeReason: 'OTHER_PLANT', lots: [] }),
      ],
    });
    mount(
      [capture('/logistics/shipment-requests/5/lines/79:pick-lot', 'POST', () => jsonResponse({}), seen)],
      { requests: [only] },
    );
    await openRequest(user);
    await scan(user, 'P2611-0003');

    expect(await screen.findByText('이 기기에서 피킹할 이 품목 라인이 없습니다')).toBeTruthy();
    expect(seen).toHaveLength(0);
  });

  it('시안 ⑦ 이 기기 줄이 다 차고 다른 공장 줄이 남으면 「이 기기 몫은 끝났습니다」', async () => {
    const user = userEvent.setup();
    const done = scopedRequest({
      lines: [
        line({ warehouse: WH_A, inTerminalScope: true, outOfScopeReason: null, allocatedQty: 40, pickedQty: 40 }),
        line({ shipmentRequestLineId: 79, lineNo: 2, warehouse: WH_B, inTerminalScope: false, outOfScopeReason: 'OTHER_PLANT', lots: [] }),
      ],
    });
    mount([], { requests: [done] });
    await openRequest(user);

    expect(screen.getByText('이 기기 몫은 끝났습니다')).toBeTruthy();
    expect(screen.getByText(/사업부 X 의 아무 POP 「출하 완료」에서 합니다/)).toBeTruthy();
  });

  it('US6-1·빈 곳 ⑨ 옛 지시서는 「창고 미지정」 줄과 「사업부 미지정」 배지로 지금처럼 피킹한다', async () => {
    const user = userEvent.setup();
    mount([], { requests: [request({ businessUnit: null })] });
    await openRequest(user);

    expect(screen.getByText('사업부 미지정')).toBeTruthy();
    expect(within(await lineRow()).getByText('창고 미지정')).toBeTruthy();
    expect(screen.queryByText(/이 기기에서 피킹하지 않습니다/)).toBeNull();
  });
});
