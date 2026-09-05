import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import {
  jsonResponse,
  renderWithProviders,
  type StubFetch,
  type StubRoute,
} from '../../test/api-harness';
import {
  ShipmentProcessingCandidateScreen,
  toShipmentDetailScreenState,
  toShipmentProcessingCandidateSnapshot,
  toSubmitBlockers,
} from './candidate-screen';

const t = {
  submit: '출하 처리',
  processedToast: '출하가 미확정 상태로 생성되었습니다.',
};

describe('toShipmentProcessingCandidateSnapshot', () => {
  it('조회 조건이 없으면 ABSENT', () => {
    expect(
      toShipmentProcessingCandidateSnapshot({
        enabled: false,
        isFetching: false,
        isError: false,
        candidateIds: undefined,
      }),
    ).toEqual({ kind: 'ABSENT' });
  });

  it('불러오는 중이면 PENDING', () => {
    expect(
      toShipmentProcessingCandidateSnapshot({
        enabled: true,
        isFetching: true,
        isError: false,
        candidateIds: undefined,
      }),
    ).toEqual({ kind: 'PENDING' });
  });

  it('실패하면 FAILED', () => {
    expect(
      toShipmentProcessingCandidateSnapshot({
        enabled: true,
        isFetching: false,
        isError: true,
        candidateIds: undefined,
      }),
    ).toEqual({ kind: 'FAILED' });
  });

  it('받았으면 SETTLED', () => {
    expect(
      toShipmentProcessingCandidateSnapshot({
        enabled: true,
        isFetching: false,
        isError: false,
        candidateIds: [501, 502],
      }),
    ).toEqual({ kind: 'SETTLED', candidateIds: [501, 502] });
  });
});

describe('toShipmentDetailScreenState', () => {
  const detail = { shipmentRequestId: 501 } as never;

  it('선택 전이면 NOT_SELECTED', () => {
    expect(
      toShipmentDetailScreenState({
        selectedShipmentRequestId: null,
        isFetching: false,
        isError: false,
        detail: undefined,
      }),
    ).toEqual({ kind: 'NOT_SELECTED' });
  });

  it('불러오는 중이면 CHECKING', () => {
    expect(
      toShipmentDetailScreenState({
        selectedShipmentRequestId: 501,
        isFetching: true,
        isError: false,
        detail: undefined,
      }),
    ).toEqual({ kind: 'CHECKING' });
  });

  it('실패하거나 값이 없으면 UNAVAILABLE', () => {
    expect(
      toShipmentDetailScreenState({
        selectedShipmentRequestId: 501,
        isFetching: false,
        isError: true,
        detail: undefined,
      }),
    ).toEqual({ kind: 'UNAVAILABLE' });
    expect(
      toShipmentDetailScreenState({
        selectedShipmentRequestId: 501,
        isFetching: false,
        isError: false,
        detail: undefined,
      }),
    ).toEqual({ kind: 'UNAVAILABLE' });
  });

  it('받았으면 RESOLVED', () => {
    expect(
      toShipmentDetailScreenState({
        selectedShipmentRequestId: 501,
        isFetching: false,
        isError: false,
        detail,
      }),
    ).toEqual({ kind: 'RESOLVED', detail });
  });
});

describe('toSubmitBlockers', () => {
  const balancedLine = {
    shipmentRequestLineId: 701,
    lineNo: 1,
    itemId: 910001,
    uomId: 920001,
    requestedQty: 100,
    allocatedQty: 100,
    pickedQty: 100,
    shippedQty: '100',
    allocations: [{ draftId: 'a', lotId: 1001, qty: '100' }],
  };

  it('관문 셋 다 통과하면 빈 배열', () => {
    expect(
      toSubmitBlockers({ gateBlockers: [], lineDrafts: [balancedLine], warehouseId: 1001 }),
    ).toEqual([]);
  });

  it('라인이 없거나 어긋나면 ALLOCATION_UNBALANCED', () => {
    expect(toSubmitBlockers({ gateBlockers: [], lineDrafts: [], warehouseId: 1001 })).toEqual([
      'ALLOCATION_UNBALANCED',
    ]);
    expect(
      toSubmitBlockers({
        gateBlockers: [],
        lineDrafts: [{ ...balancedLine, shippedQty: '' }],
        warehouseId: 1001,
      }),
    ).toEqual(['ALLOCATION_UNBALANCED']);
  });

  it('창고가 없으면 WAREHOUSE_UNRESOLVED', () => {
    expect(
      toSubmitBlockers({ gateBlockers: [], lineDrafts: [balancedLine], warehouseId: null }),
    ).toEqual(['WAREHOUSE_UNRESOLVED']);
  });

  it('상위 게이트 막힘도 그대로 옮긴다', () => {
    expect(
      toSubmitBlockers({
        gateBlockers: ['PICKING_INCOMPLETE'],
        lineDrafts: [balancedLine],
        warehouseId: 1001,
      }),
    ).toEqual(['PICKING_INCOMPLETE']);
  });
});

/* ── 통합: 화면 전체 흐름 ─────────────────────────────────────────────── */

const shipmentRequest = (overrides: Record<string, unknown> = {}) => ({
  shipmentRequestId: 501,
  shipmentRequestNo: 'SYN-SR-501',
  customerId: 601,
  shipToPartnerId: 602,
  requestedShipDate: '2026-08-28',
  statusCode: 'SYN-PENDING-SHIPMENT',
  shipmentProgressCode: 'PICKED',
  shippingInspectionStatusCode: 'PASSED',
  ...overrides,
});

const line = (overrides: Record<string, unknown> = {}) => ({
  shipmentRequestLineId: 701,
  lineNo: 1,
  itemId: 910001,
  requestedQty: 100,
  allocatedQty: 100,
  pickedQty: 100,
  shippedQty: 0,
  uomId: 920001,
  shippingInspectionRequired: false,
  ...overrides,
});

const jsonRoute = (
  method: string,
  pathname: string,
  body: unknown,
  status = 200,
  matchExtra?: (url: URL) => boolean,
): StubRoute => ({
  match: (request) => {
    const url = new URL(request.url);
    return request.method === method && url.pathname === pathname && (matchExtra?.(url) ?? true);
  },
  respond: () => jsonResponse(body, { status }),
});

const baseRoutes = (): StubRoute[] => [
  jsonRoute('GET', '/mdm/partners', {
    items: [
      { partnerId: 601, partnerCode: 'CUS-01', partnerName: 'Synthetic Customer', isActive: true },
    ],
    page: { page: 1, size: 200, total: 1 },
  }),
  jsonRoute('GET', '/mdm/workers', {
    items: [{ workerId: 801, workerNo: 'W-801', workerName: 'Synthetic Worker', isActive: true }],
    page: { page: 1, size: 200, total: 1 },
  }),
  jsonRoute('GET', '/mdm/warehouses', {
    items: [
      {
        warehouseId: 1001,
        plantId: 1,
        businessUnitId: 1,
        warehouseCode: 'WH-01',
        warehouseName: 'Synthetic Warehouse',
        warehouseTypeCode: 'PRODUCT',
        managementLevelCode: 'STANDARD',
        isExternal: false,
        isDefect: false,
        isActive: true,
      },
    ],
    page: { page: 1, size: 200, total: 1 },
  }),
  jsonRoute('GET', '/logistics/shipment-requests', {
    items: [shipmentRequest({ lines: [line()] })],
    page: { page: 1, size: 20, total: 1 },
  }),
  jsonRoute('GET', '/logistics/shipment-requests/501', shipmentRequest({ lines: [line()] })),
  jsonRoute('GET', '/trace/lots', {
    items: [
      { lotId: 1001, lotNo: 'SYN-LOT-1001', itemId: 910001, held: false, expiryDate: null },
      { lotId: 1002, lotNo: 'SYN-LOT-1002', itemId: 910001, held: true, expiryDate: null },
    ],
    page: { page: 1, size: 100, total: 2 },
  }),
];

const recordingFetch = (
  routes: StubRoute[],
): { fetch: StubFetch; posts: { url: URL; headers: Headers; body: unknown }[] } => {
  const posts: { url: URL; headers: Headers; body: unknown }[] = [];
  const withPostCapture: StubFetch = async (request) => {
    if (request.method === 'POST') {
      posts.push({
        url: new URL(request.url),
        headers: request.headers,
        body: await request.clone().json(),
      });
    }
    const route = routes.find((candidate) => candidate.match(request));
    if (route === undefined)
      throw new Error(`스텁에 없는 요청입니다: ${request.method} ${request.url}`);
    return route.respond(request);
  };
  return { fetch: withPostCapture, posts };
};

const searchAndSelect = async (user: ReturnType<typeof userEvent.setup>): Promise<void> => {
  await user.type(screen.getByLabelText('출하일 시작'), '2026-08-24');
  await user.click(screen.getByRole('button', { name: '조회' }));
  await user.click(await screen.findByRole('button', { name: 'SYN-SR-501 선택' }));
};

describe('ShipmentProcessingCandidateScreen', () => {
  it('선택 전에는 안내를 보이고, 선택하면 3구획이 채워진다(C-2)', async () => {
    const user = userEvent.setup();
    const { fetch } = recordingFetch(baseRoutes());
    renderWithProviders(<ShipmentProcessingCandidateScreen />, { fetch });

    expect(screen.getByText('출하작업지시를 선택하세요.')).toBeInTheDocument();

    await searchAndSelect(user);

    expect(await screen.findByText('출하수량')).toBeInTheDocument();
    expect(screen.getByRole('region', { name: '상차 정보' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: '확정하면 일어나는 일' })).toBeInTheDocument();
  });

  it('LOT을 고르지 않으면 [출하 처리]가 막혀 있고 사유를 낸다(C-3·C-4)', async () => {
    const user = userEvent.setup();
    const { fetch } = recordingFetch(baseRoutes());
    renderWithProviders(<ShipmentProcessingCandidateScreen />, { fetch });

    await searchAndSelect(user);
    await screen.findByText('LOT 추가');

    expect(screen.getByRole('button', { name: t.submit })).toBeDisabled();
    expect(screen.getByText(/LOT을 하나 이상 선택해 주세요/)).toBeInTheDocument();
  });

  it('held LOT은 선택 목록에서 잠겨 있다(C-3)', async () => {
    const user = userEvent.setup();
    const { fetch } = recordingFetch(baseRoutes());
    renderWithProviders(<ShipmentProcessingCandidateScreen />, { fetch });

    await searchAndSelect(user);
    await user.click(await screen.findByRole('button', { name: 'LOT 추가' }));
    await user.click(screen.getByRole('combobox', { name: /LOT/ }));

    expect(screen.getByRole('option', { name: 'SYN-LOT-1001' })).toBeEnabled();
    expect(screen.getByRole('option', { name: /SYN-LOT-1002.*보류/ })).toHaveAttribute(
      'aria-disabled',
      'true',
    );
  });

  it('전 관문을 채우고 확정하면 Idempotency-Key만 싣고 전송하고, 성공 시 미확정 토스트를 낸다(C-5)', async () => {
    const user = userEvent.setup();
    const routes = [
      ...baseRoutes(),
      jsonRoute(
        'POST',
        '/logistics/shipments',
        {
          shipmentId: 9001,
          shipmentNo: 'SYN-SH-9001',
          shipmentRequestId: 501,
          warehouseId: 1001,
          statusCode: 'UNCONFIRMED',
          lines: [],
        },
        201,
      ),
    ];
    const { fetch, posts } = recordingFetch(routes);
    renderWithProviders(<ShipmentProcessingCandidateScreen />, { fetch });

    await searchAndSelect(user);
    await user.click(await screen.findByRole('button', { name: 'LOT 추가' }));
    await user.click(screen.getByRole('combobox', { name: /LOT/ }));
    await user.click(screen.getByRole('option', { name: 'SYN-LOT-1001' }));
    await user.type(screen.getByLabelText('출하수량'), '100');
    await user.type(screen.getByLabelText(/수량 · 라인 1/), '100');

    await waitFor(() => expect(screen.getByRole('button', { name: t.submit })).toBeEnabled());
    await user.click(screen.getByRole('button', { name: t.submit }));

    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: t.submit }));

    await waitFor(() => expect(posts).toHaveLength(1));
    expect(posts[0]?.url.pathname).toBe('/logistics/shipments');
    expect(posts[0]?.headers.get('Idempotency-Key')).toMatch(/^[0-9a-f-]{36}$/i);
    expect(posts[0]?.headers.has('If-Match')).toBe(false);
    expect(posts[0]?.headers.has('X-Worker-No')).toBe(false);
    expect(posts[0]?.body).toMatchObject({
      shipmentRequestId: 501,
      warehouseId: 1001,
      expedited: false,
      lines: [
        {
          shipmentRequestLineId: 701,
          shippedQty: 100,
          allocations: [{ lotId: 1001, allocatedQty: 100 }],
        },
      ],
    });

    expect(await screen.findByText(t.processedToast)).toBeVisible();
    expect(screen.getByText('출하작업지시를 선택하세요.')).toBeInTheDocument();
  });

  /*
   * C-6 — 400과 409는 같은 배너 자리를 쓰되 서로 다른 문구로 낸다(공통 부품
   * `SaveErrorBanner`의 오류 5갈래 분기). 확인 창 안에는 이 화면의 입력칸이 없어
   * (`mutations.ts`의 `knownFields: []`, `item-extended-attrs`의 창 안 쓰기와 같은 근거)
   * 필드 오류도 인라인이 아니라 이 배너로 온다 — 그래서 「인라인」이 아니라 두 오류가
   * 서로 다른 문구로 구분되는지를 검증한다.
   */
  it('400은 검증 문구를, 409는 충돌 문구를 각자 다르게 배너로 낸다(C-6)', async () => {
    const user = userEvent.setup();
    const fillAndOpenConfirm = async (): Promise<HTMLElement> => {
      await searchAndSelect(user);
      await user.click(await screen.findByRole('button', { name: 'LOT 추가' }));
      await user.click(screen.getByRole('combobox', { name: /LOT/ }));
      await user.click(screen.getByRole('option', { name: 'SYN-LOT-1001' }));
      await user.type(screen.getByLabelText('출하수량'), '100');
      await user.type(screen.getByLabelText(/수량 · 라인 1/), '100');
      await waitFor(() => expect(screen.getByRole('button', { name: t.submit })).toBeEnabled());
      await user.click(screen.getByRole('button', { name: t.submit }));
      return screen.findByRole('dialog');
    };

    const badRoutes = [
      ...baseRoutes(),
      jsonRoute(
        'POST',
        '/logistics/shipments',
        {
          errors: [
            {
              scope: 'field',
              field: 'warehouseId',
              code: 'X',
              message: 'Synthetic invalid warehouse',
            },
          ],
        },
        400,
      ),
    ];
    const { fetch: badFetch } = recordingFetch(badRoutes);
    const { unmount } = renderWithProviders(<ShipmentProcessingCandidateScreen />, {
      fetch: badFetch,
    });
    const badDialog = await fillAndOpenConfirm();
    await user.click(within(badDialog).getByRole('button', { name: t.submit }));

    expect(await within(badDialog).findByText('Synthetic invalid warehouse')).toBeVisible();
    unmount();

    const conflictRoutes = [
      ...baseRoutes(),
      jsonRoute(
        'POST',
        '/logistics/shipments',
        { code: 'INVALID_STATE', conflictCause: 'erpSync', message: 'Synthetic conflict message' },
        409,
      ),
    ];
    const { fetch: conflictFetch } = recordingFetch(conflictRoutes);
    renderWithProviders(<ShipmentProcessingCandidateScreen />, { fetch: conflictFetch });
    const conflictDialog = await fillAndOpenConfirm();
    await user.click(within(conflictDialog).getByRole('button', { name: t.submit }));

    // 409(conflictCause)는 검증 오류와 다른 갈래라 공통 충돌 문구로 낸다 — 서버 message 그대로가 아니다.
    expect(
      within(conflictDialog).queryByText('Synthetic invalid warehouse'),
    ).not.toBeInTheDocument();
    expect(
      within(conflictDialog).queryByText('Synthetic conflict message'),
    ).not.toBeInTheDocument();
    expect(
      await within(conflictDialog).findByText(/외부 시스템에서 이 항목이 다시 동기화됐습니다/),
    ).toBeVisible();
    expect(
      within(conflictDialog).getByRole('button', { name: '최신 불러오기' }),
    ).toBeInTheDocument();
  });
});
