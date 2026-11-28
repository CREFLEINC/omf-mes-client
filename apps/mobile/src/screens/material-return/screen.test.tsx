import { messages } from '@omf-mes/i18n';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useEffect, type ReactNode } from 'react';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createStubFetch, jsonResponse, renderWithProviders } from '../../test/api-harness';
import { useWorkerSession } from '../../patterns/worker-session';
import type { MaterialReturnLotLookup, ReturnWorkOrder, ReturnWorkOrderLot } from './queries';
import { MaterialReturnScreen } from './screen';

/*
 * M-01-15 반납 입고(피처 019 · 시안 ⑤). 합성값만 쓴다.
 */

const t = messages.materialReturn;
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

const LOT_NO = 'SYN-M00000220261120000031';
const B_S1 = 'SYN-M00000220261127000041';

const lookupOf = (overrides: Partial<MaterialReturnLotLookup> = {}): MaterialReturnLotLookup => ({
  lotId: 501,
  lotNo: LOT_NO,
  item: { itemId: 11, itemCode: 'SYN-A100', itemName: '합성 볼트 M4×10' },
  uom: { uomId: 1, uomCode: 'EA' },
  returnableQty: 100,
  workOrder: { workOrderId: 610, workOrderNo: 'WO-SYN-0010', finalized: false },
  issueWarehouse: { warehouseId: 31, warehouseName: 'G 생산창고' },
  labelUnprinted: false,
  ...overrides,
});

const WORK_ORDER: ReturnWorkOrder = {
  workOrderId: 635,
  workOrderNo: 'WO-SYN-0011',
  /* W/O 생산 품목 — 목록 줄에는 보이지 않는다. 줄에는 나간 자재(`returnableMaterial`)를 보인다. */
  item: { itemId: 90, itemCode: 'SYN-P900', itemName: '합성 완제품' },
  processName: '공정 20 조립',
  lineName: 'L2',
  lastIssuedAt: '2026-11-27T02:40:00Z',
  finalized: false,
  returnableLotCount: 1,
  unprintedLotCount: 1,
  returnableMaterial: {
    item: { itemId: 21, itemCode: 'SYN-B220', itemName: '합성 하우징 커버' },
    otherItemCount: 2,
  },
};

/** 다른 품목 없이 자재 하나만 나간 W/O — 「외 n」 없이 품목만. */
const WORK_ORDER_ONE: ReturnWorkOrder = {
  ...WORK_ORDER,
  workOrderId: 601,
  workOrderNo: 'WO-SYN-0002',
  processName: '공정 10 사출',
  finalized: true,
  unprintedLotCount: 0,
  lastIssuedAt: '2026-11-25T01:10:00Z',
  returnableMaterial: {
    item: { itemId: 23, itemCode: 'SYN-A100', itemName: '합성 볼트 M4×10' },
    otherItemCount: 0,
  },
};

const WO_LOT: ReturnWorkOrderLot = {
  lotId: 541,
  lotNo: B_S1,
  item: { itemId: 21, itemCode: 'SYN-B220', itemName: '합성 하우징 커버' },
  uom: { uomId: 1, uomCode: 'EA' },
  goodsIssueLineId: 9001,
  issuedAt: '2026-11-27T02:40:00Z',
  issueQty: 300,
  returnableQty: 300,
  labelUnprinted: true,
};

interface Sent {
  method: string;
  path: string;
  headers: Headers;
  body: unknown;
}

/** 공장의 위치 — G 는 출고 생산창고, H 는 같은 공장의 다른 생산창고, R 은 자재창고(생산창고 아님). */
const G = { warehouseId: 31, warehouseCode: 'SYN-WH-G', warehouseName: 'G 생산창고' };
const H = { warehouseId: 32, warehouseCode: 'SYN-WH-H', warehouseName: 'H 생산창고' };
const R = { warehouseId: 11, warehouseCode: 'SYN-WH-R', warehouseName: '합성 자재창고' };
const LOCATIONS: Record<string, { locationId: number; warehouse: typeof G }> = {
  'G-S-01-03': { locationId: 812, warehouse: G },
  'G-S-05-02': { locationId: 813, warehouse: G },
  'G-S-02-01': { locationId: 814, warehouse: G },
  'H-S-01-01': { locationId: 821, warehouse: H },
  'R-A-01-01': { locationId: 701, warehouse: R },
  'G-STAGE': { locationId: 899, warehouse: G },
};

const SignedIn = ({ children }: { children: ReactNode }) => {
  const { worker, signIn } = useWorkerSession();

  useEffect(() => {
    if (worker === null) signIn({ workerNo: '900028', workerName: '합성 작업자' });
  }, [signIn, worker]);

  return worker === null ? null : children;
};

const mount = (
  options: {
    lookup?: (lotNo: string) => Response;
    receive?: (body: { lines: Record<string, unknown>[] }) => Response;
    locations?: (query: URLSearchParams) => Response | undefined;
  } = {},
) => {
  const sent: Sent[] = [];
  /* 위치 조회의 질의 — 반납 전용 조회는 코드만 싣는다(창고로 묶지 않는다 · 2026-11-28 사용자 결정). */
  const locationQueries: URLSearchParams[] = [];
  const pathIs = (path: string) => (request: Request) => new URL(request.url).pathname === path;
  const fetch = createStubFetch([
    {
      match: pathIs('/production/material-returns/lot-lookup'),
      respond: (request) => {
        const lotNo = new URL(request.url).searchParams.get('lotNo') ?? '';
        return options.lookup?.(lotNo) ?? jsonResponse(lookupOf({ lotNo }));
      },
    },
    {
      match: pathIs('/production/material-returns/location-lookup'),
      respond: (request) => {
        const query = new URL(request.url).searchParams;
        locationQueries.push(query);
        const answered = options.locations?.(query);
        if (answered !== undefined) return answered;
        const code = query.get('locationCode') ?? '';
        const found = LOCATIONS[code];
        if (found === undefined) {
          return jsonResponse(
            {
              errors: [{ scope: 'screen', code: 'NOT_FOUND', message: '위치를 찾을 수 없습니다.' }],
            },
            { status: 404 },
          );
        }
        /* 서버와 같이 — 적치 대기 자리는 400 STAGING. */
        if (code === 'G-STAGE') {
          return jsonResponse(
            {
              errors: [
                {
                  scope: 'field',
                  field: 'locationCode',
                  code: 'STAGING',
                  message: '적치 대기 자리에는 둘 수 없습니다.',
                },
              ],
            },
            { status: 400 },
          );
        }
        /* 서버와 같이 — 생산창고 위치가 아니면 400 NOT_PRODUCTION_WAREHOUSE. */
        if (found.warehouse === R) {
          return jsonResponse(
            {
              errors: [
                {
                  scope: 'field',
                  field: 'locationCode',
                  code: 'NOT_PRODUCTION_WAREHOUSE',
                  message: '생산창고 위치만 받을 수 있습니다.',
                },
              ],
            },
            { status: 400 },
          );
        }
        return jsonResponse({
          locationId: found.locationId,
          locationCode: code,
          locationName: code,
          warehouse: found.warehouse,
        });
      },
    },
    {
      match: (request) =>
        pathIs('/production/material-returns')(request) && request.method === 'POST',
      respond: async (request) => {
        const body = (await request.clone().json()) as { lines: Record<string, unknown>[] };
        sent.push({
          method: 'POST',
          path: '/production/material-returns',
          headers: request.headers,
          body,
        });
        return (
          options.receive?.(body) ??
          jsonResponse(
            {
              materialReturnId: 77,
              materialReturnNo: 'MR-SYN-0001',
              destinationWarehouseId: 31,
              statusCode: 'RECEIVED',
              requestedAt: '2026-11-28T02:10:00Z',
              lines: [],
            },
            { status: 201 },
          )
        );
      },
    },
    {
      match: pathIs('/production/material-returns/work-orders'),
      respond: () =>
        jsonResponse({
          items: [WORK_ORDER, WORK_ORDER_ONE],
          page: { page: 1, size: 50, total: 2 },
        }),
    },
    {
      match: pathIs('/production/material-returns/work-orders/635/lots'),
      respond: () => jsonResponse({ items: [WO_LOT] }),
    },
  ]);

  renderWithProviders(
    <MemoryRouter>
      <SignedIn>
        <MaterialReturnScreen />
      </SignedIn>
    </MemoryRouter>,
    { fetch },
  );

  return { sent, locationQueries };
};

type User = ReturnType<typeof userEvent.setup>;

/* 스캐너 대신 직접 입력으로 같은 값을 넣는다. */
const scan = async (user: User, label: string, manual: string, value: string) => {
  await user.click(await screen.findByRole('button', { name: manual }));
  const field = screen.getByLabelText(label);
  await user.clear(field);
  await user.type(field, value);
  await user.click(screen.getByRole('button', { name: manual }));
};

const scanLot = (user: User, value = LOT_NO) => scan(user, t.pda.scan, t.pop.manualLabel, value);
const scanLocation = (user: User, value: string) =>
  scan(user, t.pda.location, messages.putaway.location.manual, value);

const typeQty = async (user: User, digits: string) => {
  const field = await screen.findByLabelText(t.pda.qty);
  await user.type(field, digits);
};

const setOnline = (value: boolean): void => {
  Object.defineProperty(globalThis.navigator, 'onLine', { value, configurable: true });
};

beforeEach(() => {
  store.clear();
  setOnline(true);
});

afterEach(() => {
  setOnline(true);
});

describe('M-01-15 반납 입고', () => {
  it('US2-1 LOT → 수량 → 위치 스캔으로 바로 보내고 「반납 입고 · 적치 끝 → 위치」를 보인다. W/O 는 보이지 않는다', async () => {
    const user = userEvent.setup();
    const { sent, locationQueries } = mount();

    await scanLot(user);
    /* 수량은 빈칸에서 시작하고, 반납 가능 양은 칸 아래에. */
    const qty = (await screen.findByLabelText(t.pda.qty)) as HTMLInputElement;
    expect(qty.value).toBe('');
    expect(screen.getByRole('button', { name: t.pda.next })).toBeDisabled();
    expect(screen.queryByText('WO-SYN-0010')).toBeNull();

    await typeQty(user, '20');
    await user.click(screen.getByRole('button', { name: t.pda.next }));
    expect(await screen.findByRole('heading', { name: t.pda.location })).toBeTruthy();
    expect(screen.getByRole('button', { name: t.pda.stepCard(t.pda.steps.lot) })).toBeTruthy();
    expect(screen.getByRole('button', { name: t.pda.stepCard(t.pda.steps.qty) })).toBeTruthy();

    await scanLocation(user, 'G-S-01-03');

    expect(await screen.findByText(t.pda.doneLocated)).toBeTruthy();
    /* 위치 코드만 싣는다 — 창고로 묶지 않는다(공장의 생산창고 어디서든 찾는다). */
    expect(locationQueries.map((query) => Object.fromEntries(query))).toEqual([
      { locationCode: 'G-S-01-03' },
    ]);
    expect(
      screen.getByText(
        `SYN-A100 · ${LOT_NO} · 20 EA → ${t.pda.locationAt('G-S-01-03', 'G 생산창고')}`,
      ),
    ).toBeTruthy();
    expect(sent).toHaveLength(1);
    expect(sent[0]?.body).toMatchObject({
      lines: [{ lotId: 501, returnQty: 20, destinationLocationId: 812 }],
    });
    expect((sent[0]?.body as { lines: Record<string, unknown>[] }).lines[0]).not.toHaveProperty(
      'workOrderId',
    );
    expect(sent[0]?.headers.get('X-Worker-No')).toBe('900028');
    expect(sent[0]?.headers.get('Idempotency-Key')).toBeTruthy();
    expect(screen.queryByText('WO-SYN-0010')).toBeNull();

    await user.click(screen.getByRole('button', { name: t.pda.nextLot }));
    expect(await screen.findByRole('heading', { name: t.pda.scan })).toBeTruthy();
  });

  it('US2-2 「적치 대기로 받기」는 위치 없이 보내고 「반납 입고 끝 · 적치 대기」와 적치 안내를 보인다', async () => {
    const user = userEvent.setup();
    const { sent } = mount();

    await scanLot(user);
    await typeQty(user, '20');
    await user.click(screen.getByRole('button', { name: t.pda.next }));
    await user.click(await screen.findByRole('button', { name: t.pda.skip }));

    expect(await screen.findByText(t.pda.doneStaged)).toBeTruthy();
    expect(
      screen.getByText(`SYN-A100 · ${LOT_NO} · 20 EA → ${t.pda.stagingOf('G 생산창고')}`),
    ).toBeTruthy();
    expect(screen.getByText(t.pda.doneStagedHint)).toBeTruthy();
    expect((sent[0]?.body as { lines: unknown[] }).lines).toEqual([{ lotId: 501, returnQty: 20 }]);
  });

  it('US2-2 경계 — 위치 없이 받았는데 적치 지시가 없으면(창고 전체) 적치 안내 없이 받은 창고만 보인다', async () => {
    const user = userEvent.setup();
    mount({
      receive: () =>
        jsonResponse(
          {
            materialReturnId: 78,
            materialReturnNo: 'MR-SYN-0002',
            destinationWarehouseId: 31,
            statusCode: 'RECEIVED',
            requestedAt: '2026-11-28T02:10:00Z',
            lines: [{ itemId: 11, lotId: 501, returnQty: 20, uomId: 1 }],
          },
          { status: 201 },
        ),
    });

    await scanLot(user);
    await typeQty(user, '20');
    await user.click(screen.getByRole('button', { name: t.pda.next }));
    await user.click(await screen.findByRole('button', { name: t.pda.skip }));

    expect(await screen.findByText(t.pda.doneWhole)).toBeTruthy();
    expect(screen.getByText(`SYN-A100 · ${LOT_NO} · 20 EA → G 생산창고`)).toBeTruthy();
    expect(screen.queryByText(t.pda.doneStaged)).toBeNull();
    expect(screen.queryByText(t.pda.doneStagedHint)).toBeNull();
  });

  it('US2-1 · US2-3 미지정 위치는 확인 카드 뒤 확인 표시를 싣고, 지정 품목 위치 거절은 판정 코드의 문구로 보인다', async () => {
    const user = userEvent.setup();
    const { sent, locationQueries } = mount({
      receive: (body) => {
        const line = body.lines[0] ?? {};
        if (line.destinationLocationId === 814) {
          return jsonResponse(
            {
              errors: [
                {
                  scope: 'field',
                  field: 'lines[0].destinationLocationId',
                  code: 'RESTRICTED_LOCATION',
                  message: '이 위치는 지정 품목만 받습니다.',
                },
              ],
            },
            { status: 400 },
          );
        }
        if (line.destinationLocationId === 813 && line.confirmUndesignated !== true) {
          return jsonResponse(
            {
              errors: [
                {
                  scope: 'field',
                  field: 'lines[0].destinationLocationId',
                  code: 'UNDESIGNATED_NEEDS_CONFIRM',
                  message: '지정되지 않은 위치입니다',
                },
              ],
            },
            { status: 409 },
          );
        }
        return jsonResponse(
          {
            materialReturnId: 78,
            materialReturnNo: 'MR-SYN-0002',
            destinationWarehouseId: 31,
            statusCode: 'RECEIVED',
            requestedAt: '2026-11-28T02:10:00Z',
            lines: [],
          },
          { status: 201 },
        );
      },
    });

    await scanLot(user);
    await typeQty(user, '20');
    await user.click(screen.getByRole('button', { name: t.pda.next }));

    await scanLocation(user, 'G-S-02-01');
    expect(await screen.findByText(t.pda.blockedTitle('G-S-02-01'))).toBeTruthy();
    expect(screen.getByText(messages.putaway.direct.verdict.RESTRICTED_LOCATION)).toBeTruthy();

    await scanLocation(user, 'G-S-05-02');
    expect(
      await screen.findByText(
        t.pda.undesignatedTitle(t.pda.locationAt('G-S-05-02', 'G 생산창고'), 'SYN-A100'),
      ),
    ).toBeTruthy();
    await user.click(screen.getByRole('button', { name: t.pda.confirm }));

    expect(await screen.findByText(t.pda.doneLocated)).toBeTruthy();
    expect(sent.at(-1)?.body).toMatchObject({
      lines: [{ destinationLocationId: 813, confirmUndesignated: true }],
    });
    /* 두 번 스캔 모두 창고를 싣지 않았다. */
    expect(locationQueries.map((query) => query.get('warehouseId'))).toEqual([null, null]);
  });

  it('US2-1 같은 공장의 다른 생산창고 위치도 받고, 위치 카드 · 끝 카드에 그 창고 이름을 보인다', async () => {
    const user = userEvent.setup();
    let confirmed = false;
    const { sent } = mount({
      receive: (body) => {
        const line = body.lines[0] ?? {};
        if (line.confirmUndesignated !== true) {
          return jsonResponse(
            {
              errors: [
                {
                  scope: 'field',
                  field: 'lines[0].destinationLocationId',
                  code: 'UNDESIGNATED_NEEDS_CONFIRM',
                  message: '지정되지 않은 위치입니다',
                },
              ],
            },
            { status: 409 },
          );
        }
        confirmed = true;
        return jsonResponse(
          {
            materialReturnId: 79,
            materialReturnNo: 'MR-SYN-0003',
            destinationWarehouseId: 32,
            statusCode: 'RECEIVED',
            requestedAt: '2026-11-28T02:10:00Z',
            lines: [],
          },
          { status: 201 },
        );
      },
    });

    await scanLot(user);
    await typeQty(user, '20');
    await user.click(screen.getByRole('button', { name: t.pda.next }));

    /* 출고 생산창고는 G 인데 H 생산창고 위치를 스캔한다 — 「G 에 없음」이 아니라 받는다. */
    await scanLocation(user, 'H-S-01-01');
    expect(
      await screen.findByText(
        t.pda.undesignatedTitle(t.pda.locationAt('H-S-01-01', 'H 생산창고'), 'SYN-A100'),
      ),
    ).toBeTruthy();
    await user.click(screen.getByRole('button', { name: t.pda.confirm }));

    expect(await screen.findByText(t.pda.doneLocated)).toBeTruthy();
    expect(confirmed).toBe(true);
    expect(
      screen.getByText(
        `SYN-A100 · ${LOT_NO} · 20 EA → ${t.pda.locationAt('H-S-01-01', 'H 생산창고')}`,
      ),
    ).toBeTruthy();
    expect(sent.at(-1)?.body).toMatchObject({
      lines: [{ lotId: 501, destinationLocationId: 821, confirmUndesignated: true }],
    });
  });

  it('US2-3 없는 위치는 「찾을 수 없습니다」(창고 이름 없이), 자재창고 위치는 「생산창고 위치만」, 적치 대기 자리는 STAGING 문구, 서버가 답한 조회 실패는 연결 문구가 아니다', async () => {
    const user = userEvent.setup();
    const { sent } = mount({
      locations: (query) =>
        query.get('locationCode') === 'G-BROKEN'
          ? jsonResponse({ errors: [] }, { status: 500 })
          : undefined,
    });

    await scanLot(user);
    await typeQty(user, '20');
    await user.click(screen.getByRole('button', { name: t.pda.next }));

    await scanLocation(user, 'X-NONE-01');
    expect(await screen.findByText(t.pda.locationNotFound('X-NONE-01'))).toBeTruthy();
    expect(screen.queryByText(/G 생산창고/u)).toBeNull();

    await scanLocation(user, 'R-A-01-01');
    expect(await screen.findByText(t.pda.locationNotProduction('R-A-01-01'))).toBeTruthy();

    await scanLocation(user, 'G-STAGE');
    expect(await screen.findByText(t.reason.STAGING)).toBeTruthy();

    await scanLocation(user, 'G-BROKEN');
    expect(
      await screen.findByText(`${messages.httpError.loadServer} ${t.pda.locationLookupCaution}`),
    ).toBeTruthy();
    expect(screen.queryByText(t.pda.locationLookupFailed)).toBeNull();
    /* 막힌 스캔은 반납을 보내지 않는다. */
    expect(sent).toHaveLength(0);
  });

  it('US1-3 반납 가능 초과는 다음으로 가지 못하고, 반납 대상 아닌 LOT 은 오류 코드의 문구를 보인다', async () => {
    const user = userEvent.setup();
    mount({
      lookup: (lotNo) =>
        lotNo === 'SYN-NOT'
          ? jsonResponse(
              {
                errors: [
                  {
                    scope: 'field',
                    field: 'lotNo',
                    code: 'NOT_RETURNABLE',
                    message: '반납할 수 있는 자재 LOT 이 아닙니다',
                  },
                ],
              },
              { status: 400 },
            )
          : jsonResponse(lookupOf({ lotNo })),
    });

    await scanLot(user, 'SYN-NOT');
    expect(await screen.findByText(t.reason.NOT_RETURNABLE)).toBeTruthy();

    await scanLot(user);
    await typeQty(user, '120');
    expect(screen.getByText(t.pop.qtyOver('100 EA'))).toBeTruthy();
    expect(screen.getByRole('button', { name: t.pda.next })).toBeDisabled();
  });

  it('오프라인이면 확인 뒤 대기열에 넣고 다음 LOT 으로 간다', async () => {
    const user = userEvent.setup();
    const { sent } = mount();

    await scanLot(user);
    await typeQty(user, '20');
    await user.click(screen.getByRole('button', { name: t.pda.next }));
    setOnline(false);
    await user.click(await screen.findByRole('button', { name: t.pda.skip }));

    expect(await screen.findByText(t.pda.queued)).toBeTruthy();
    expect(sent).toHaveLength(0);
    await waitFor(() => {
      expect(store.get('outbox') ?? '').toContain('/production/material-returns');
    });
  });

  it('US4-1 · US4-4 · US4-5 W/O 로 찾기 → LOT(미발행 자동 선택) → 수량 → 보내면 고른 W/O 가 실리고 라벨 찍기는 없다', async () => {
    const user = userEvent.setup();
    const { sent } = mount({
      lookup: (lotNo) =>
        jsonResponse(
          lookupOf({
            lotId: 541,
            lotNo,
            item: { itemId: 21, itemCode: 'SYN-B220', itemName: '합성 하우징 커버' },
            returnableQty: 300,
            labelUnprinted: true,
          }),
        ),
    });

    await user.click(await screen.findByRole('button', { name: t.pop.byWorkOrder }));
    const list = await screen.findByRole('list', { name: t.findByWo.recent });
    expect(within(list).getByText(t.findByWo.unprintedShort(1))).toBeTruthy();
    /* 줄에는 W/O 생산 품목이 아니라 나간 자재 코드 — 다른 품목이 있으면 「외 n」, 없으면 코드만(시안 ⑤). */
    const rows = within(list).getAllByRole('listitem');
    expect(rows[0]?.textContent).toContain('SYN-B220 외 2 · 공정 20 조립 · ');
    expect(rows[0]?.textContent).not.toContain('SYN-P900');
    expect(rows[1]?.textContent).toContain('SYN-A100 · 공정 10 사출 · ');
    expect(rows[1]?.textContent).not.toContain('외');
    await user.click(within(list).getByText('WO-SYN-0011'));

    const lots = await screen.findByRole('list', { name: t.findByWo.lotTable.label });
    expect(await within(lots).findByText(t.findByWo.autoPicked)).toBeTruthy();
    await user.click(screen.getByRole('button', { name: t.findByWo.next }));

    await typeQty(user, '40');
    await user.click(screen.getByRole('button', { name: t.pda.next }));
    await user.click(await screen.findByRole('button', { name: t.pda.skip }));

    expect(await screen.findByText(t.pda.doneStaged)).toBeTruthy();
    expect((sent[0]?.body as { lines: unknown[] }).lines).toEqual([
      { lotId: 541, returnQty: 40, workOrderId: 635 },
    ]);
    /* PDA 는 라벨을 찍지 않는다 — 미발행으로 남아 POP 분할 LOT 라벨에 보인다(FR-017). */
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.queryByText(t.label.print)).toBeNull();
  });
});
