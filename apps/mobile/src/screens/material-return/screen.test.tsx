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
  item: { itemId: 21, itemCode: 'SYN-B220', itemName: '합성 하우징 커버' },
  processName: '공정 20 조립',
  lineName: 'L2',
  lastIssuedAt: '2026-11-27T02:40:00Z',
  finalized: false,
  returnableLotCount: 1,
  unprintedLotCount: 1,
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

const LOCATIONS: Record<string, number> = { 'G-S-01-03': 812, 'G-S-05-02': 813, 'G-S-02-01': 814 };

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
  } = {},
) => {
  const sent: Sent[] = [];
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
      match: pathIs('/mdm/locations'),
      respond: (request) => {
        const code = new URL(request.url).searchParams.get('locationCode') ?? '';
        const id = LOCATIONS[code];
        return jsonResponse({
          items:
            id === undefined
              ? []
              : [{ locationId: id, locationCode: code, warehouseId: 31, locationName: code }],
          page: { page: 1, size: 50, total: id === undefined ? 0 : 1 },
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
      respond: () => jsonResponse({ items: [WORK_ORDER], page: { page: 1, size: 50, total: 1 } }),
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

  return { sent };
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
    const { sent } = mount();

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
    expect(screen.getByText(`SYN-A100 · ${LOT_NO} · 20 EA → G-S-01-03`)).toBeTruthy();
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

  it('US2-1 · US2-3 미지정 위치는 확인 카드 뒤 확인 표시를 싣고, 지정 품목 위치 거절은 서버 문구 그대로 보인다', async () => {
    const user = userEvent.setup();
    const { sent } = mount({
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
    expect(screen.getByText('이 위치는 지정 품목만 받습니다.')).toBeTruthy();

    await scanLocation(user, 'G-S-05-02');
    expect(await screen.findByText(t.pda.undesignatedTitle('G-S-05-02', 'SYN-A100'))).toBeTruthy();
    await user.click(screen.getByRole('button', { name: t.pda.confirm }));

    expect(await screen.findByText(t.pda.doneLocated)).toBeTruthy();
    expect(sent.at(-1)?.body).toMatchObject({
      lines: [{ destinationLocationId: 813, confirmUndesignated: true }],
    });
  });

  it('US1-3 반납 가능 초과는 다음으로 가지 못하고, 반납 대상 아닌 LOT 은 서버 문구를 보인다', async () => {
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
    expect(await screen.findByText('반납할 수 있는 자재 LOT 이 아닙니다')).toBeTruthy();

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
