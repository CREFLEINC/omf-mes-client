import type {
  MaterialLotSummary,
  SupplierItemDefault,
  WaitingMaterialLotGroup,
} from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { plantToday } from '../../patterns/plant-time';
import { createStubFetch, jsonResponse, renderWithProviders } from '../../test/api-harness';
import { MaterialLotIssueScreen } from './screen';

const t = messages.materialLotIssue;

/*
 * 시험 받침 — 공장 · 공급사 · 품목 · LOT 은 모두 지어낸 값이다.
 * 합성 공급사 가(8201) · 합성 캡(601, EA, 기본 정보 봉지 10 × 100 = 1,000) — 대기 3개(하나 미출력), 폐기 1개.
 * 합성 공급사 나(8202) · 합성 레진(602, TON, 기본 정보 없음 · 보관 단위 없음) — 대기 없음.
 */
const PLANT = {
  plantId: 8401,
  businessUnitId: 8301,
  legalEntityId: 8201,
  plantCode: 'G1',
  plantName: '합성 1공장',
  timezoneCode: 'Asia/Ho_Chi_Minh',
  isActive: true,
};

const UOMS = [
  { uomId: 1, uomCode: 'EA', uomName: '개', decimalScale: 0, isActive: true },
  { uomId: 2, uomCode: 'TON', uomName: '톤', decimalScale: 3, isActive: true },
  { uomId: 3, uomCode: 'BAG', uomName: '봉지', decimalScale: 0, isActive: true },
];

const lot = (lotId: number, over: Partial<MaterialLotSummary> = {}): MaterialLotSummary => ({
  lotId,
  lotNo: `SYN-CAP|1000|261111|SYN-S1|${String(lotId).padStart(4, '0')}`,
  lotQty: 1000,
  package: { uomId: 3, uomCode: 'BAG', count: 10, qtyPerPackage: 100 },
  supplierLotNo: 'SL-77',
  lifecycleStatusCode: 'WAITING',
  statusCode: 'INSPECTION_PENDING',
  inboundLotId: null,
  inboundLotNo: null,
  lastLabelIssue: { issueSeq: 1, issuedAt: '2026-11-11T01:12:00Z' },
  createdChannelCode: 'POP',
  createdAt: '2026-11-11T01:12:00Z',
  ...over,
});

const GROUPS: WaitingMaterialLotGroup[] = [
  {
    supplierId: 8201,
    supplierCode: 'SYN-S1',
    supplierName: '합성 공급사 가',
    itemId: 601,
    itemCode: 'SYN-CAP',
    itemName: '합성 캡',
    uomId: 1,
    uomCode: 'EA',
    inspectionRequired: true,
    waitingCount: 3,
    waitingQty: 3000,
    unprintedCount: 1,
    lastIssuedAt: '2026-11-11T01:12:00Z',
    batches: [],
    lots: [
      lot(1),
      lot(2),
      lot(3, { lastLabelIssue: null, createdChannelCode: 'WEB' }),
      lot(4, { lifecycleStatusCode: 'VOIDED' }),
    ],
  },
  {
    supplierId: 8202,
    supplierCode: 'SYN-S2',
    supplierName: '합성 공급사 나',
    itemId: 602,
    itemCode: 'SYN-RES',
    itemName: '합성 레진',
    uomId: 2,
    uomCode: 'TON',
    inspectionRequired: false,
    waitingCount: 0,
    waitingQty: 0,
    unprintedCount: 0,
    lastIssuedAt: null,
    batches: [],
    lots: [],
  },
];

const DEFAULTS: SupplierItemDefault[] = [
  {
    supplierItemDefaultId: 71,
    plantId: 8401,
    supplierId: 8201,
    supplierCode: 'SYN-S1',
    supplierName: '합성 공급사 가',
    itemId: 601,
    itemCode: 'SYN-CAP',
    itemName: '합성 캡',
    uomId: 1,
    uomCode: 'EA',
    lotQty: 1000,
    package: { uomId: 3, uomCode: 'BAG', count: 10, qtyPerPackage: 100 },
    remarks: null,
    versionNo: 1,
    updatedAt: '2026-11-10T02:00:00Z',
    updatedByName: null,
  },
];

interface Write {
  method: string;
  path: string;
  headers: Headers;
  body: unknown;
}

const pathOf = (request: Request): string => new URL(request.url).pathname;
const isGet = (request: Request, path: string | RegExp): boolean =>
  request.method === 'GET' &&
  (typeof path === 'string' ? pathOf(request) === path : path.test(pathOf(request)));
const page = <T,>(items: T[]) => ({ items, page: { page: 1, size: 200, total: items.length } });

const setup = (options: { voidFails?: number[] } = {}) => {
  const writes: Write[] = [];
  const fetch = createStubFetch([
    { match: (r) => isGet(r, '/mdm/plants'), respond: () => jsonResponse(page([PLANT])) },
    {
      match: (r) => isGet(r, '/logistics/waiting-material-lots'),
      respond: () => jsonResponse({ items: GROUPS }),
    },
    {
      match: (r) => isGet(r, '/mdm/supplier-item-defaults'),
      respond: (r) => {
        const query = new URL(r.url).searchParams;
        const supplierId = query.get('supplierId');
        const itemId = query.get('itemId');
        return jsonResponse(
          page(
            DEFAULTS.filter(
              (row) =>
                (supplierId === null || String(row.supplierId) === supplierId) &&
                (itemId === null || String(row.itemId) === itemId),
            ),
          ),
        );
      },
    },
    { match: (r) => isGet(r, '/mdm/uoms'), respond: () => jsonResponse({ items: UOMS }) },
    {
      match: (r) => isGet(r, /^\/mdm\/items\/\d+$/),
      respond: (r) => {
        const itemId = Number(pathOf(r).split('/').at(-1));
        return jsonResponse({
          item: {
            itemId,
            baseUomId: itemId === 601 ? 1 : 2,
            defaultLotStorageUomId: itemId === 601 ? 3 : null,
          },
        });
      },
    },
    {
      match: (r) => isGet(r, /^\/mdm\/items\/\d+\/uom-conversions$/),
      respond: () => jsonResponse({ items: [] }),
    },
    {
      match: (r) => r.method !== 'GET',
      respond: async (r) => {
        const text = await r.clone().text();
        const body: unknown = text === '' ? null : JSON.parse(text);
        writes.push({ method: r.method, path: pathOf(r), headers: r.headers, body });
        if (pathOf(r) === '/trace/lots:void') {
          const lotIds = (body as { lotIds: number[] }).lotIds;
          return jsonResponse({
            items: lotIds.map((lotId) => ({
              lotId,
              lotNo: lot(lotId).lotNo,
              voided: !(options.voidFails ?? []).includes(lotId),
              errorCode: (options.voidFails ?? []).includes(lotId) ? 'STATE_LOCKED' : null,
            })),
          });
        }
        return jsonResponse({ batchId: 5, lots: [lot(11), lot(12), lot(13)] }, { status: 201 });
      },
    },
  ]);
  renderWithProviders(<MaterialLotIssueScreen />, {
    fetch,
    route: '/logistics/material-lot-issue',
  });
  return { user: userEvent.setup(), writes };
};

const listTable = async () => within(await screen.findByRole('table', { name: t.list.label }));
const rowOf = async (code: string) => {
  const cell = (await listTable()).getByText(code);
  const row = cell.closest('tr');
  if (row === null) throw new Error(`${code} 줄이 없다`);
  return row;
};
const openDetail = async (user: ReturnType<typeof userEvent.setup>, code: string) => {
  await user.click(await rowOf(code));
  return within(await screen.findByRole('dialog', { name: /SYN-CAP|SYN-RES/ }));
};

describe('W-01-14 자재 관리 LOT 발행', () => {
  it('US1-8 공급사·품목 목록에 기본 정보 · 대기 수 · 라벨 미출력 · 최근 발행을 보이고, 라벨은 POP 에서 찍는다고 알린다', async () => {
    setup();

    const cap = within(await rowOf('SYN-CAP'));
    const cells = cap.getAllByRole('cell').map((cell) => cell.textContent);
    expect(cells[0]).toBe('합성 공급사 가 SYN-S1');
    expect(cells[1]).toBe('SYN-CAP 합성 캡');
    expect(cells[2]).toBe('EA');
    expect(cells[3]).toBe('BAG 10 × 100 = 1,000 EA');
    expect(cells[4]).toBe('3');
    expect(cells[5]).toBe('1');
    expect(cells[6]).toMatch(/^11-11 \d\d:12$/);

    const resin = within(await rowOf('SYN-RES'));
    expect(resin.getByText(t.defaults.missing)).toBeInTheDocument();
    expect(await resin.findByText(t.defaults.manual)).toBeInTheDocument();

    expect(screen.getByText(t.banner)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /라벨|인쇄/ })).not.toBeInTheDocument();
  });

  it('US1-8 「대기 있는 것만」은 대기 없는 조합을 뺀다', async () => {
    const { user } = setup();
    await rowOf('SYN-RES');

    await user.click(screen.getByRole('checkbox', { name: t.filters.waitingOnly }));

    await waitFor(() => expect(screen.queryByText('SYN-RES')).not.toBeInTheDocument());
    expect(await rowOf('SYN-CAP')).toBeInTheDocument();
  });

  it('US1-8 상세 창은 대기 · 폐기 자재 관리 LOT 와 만든 곳을 보이고 라벨 단추가 없다', async () => {
    const { user } = setup();
    const detail = await openDetail(user, 'SYN-CAP');

    const table = within(detail.getByRole('table', { name: t.detail.waitingTitle }));
    expect(table.getAllByRole('row')).toHaveLength(5);
    expect(table.getAllByRole('checkbox')).toHaveLength(3);
    expect(table.getByText(t.detail.status.VOIDED)).toBeInTheDocument();
    expect(table.getByText(t.detail.unprinted)).toBeInTheDocument();
    expect(table.getByText(/^관리웹 /)).toBeInTheDocument();
    expect(detail.getByText(t.detail.waitingCount(3))).toBeInTheDocument();
    expect(detail.queryByRole('button', { name: /라벨|인쇄/ })).not.toBeInTheDocument();
  });

  it('US1-8 대기 LOT 폐기 — 고른 LOT 를 :void 로 보내고 건별 실패는 「N개 폐기 · 실패 N」으로 묶는다', async () => {
    const { user, writes } = setup({ voidFails: [2] });
    const detail = await openDetail(user, 'SYN-CAP');

    await user.click(detail.getByRole('checkbox', { name: t.detail.pick(lot(1).lotNo) }));
    await user.click(detail.getByRole('checkbox', { name: t.detail.pick(lot(2).lotNo) }));
    await user.click(detail.getByRole('button', { name: t.detail.void(2) }));

    const confirm = within(await screen.findByRole('dialog', { name: t.void.title(2) }));
    expect(confirm.getByText(t.void.printed(2))).toBeInTheDocument();
    await user.click(confirm.getByRole('button', { name: t.void.confirm(2) }));

    await waitFor(() =>
      expect(writes.filter((w) => w.path === '/trace/lots:void')).toHaveLength(1),
    );
    const sent = writes.find((w) => w.path === '/trace/lots:void');
    expect(sent?.body).toEqual({ lotIds: [1, 2] });
    expect(sent?.headers.get('Idempotency-Key')).not.toBeNull();
    expect(await screen.findByText(t.toast.voidedPartly(1, 1))).toBeInTheDocument();
  });

  it('US1-8 발행 창은 기본 정보로 채우고(바꿀 수 있음) POP 과 같은 본문으로 발행한다', async () => {
    const { user, writes } = setup();
    const detail = await openDetail(user, 'SYN-CAP');
    await user.click(detail.getByRole('button', { name: t.detail.issue }));

    const dialog = within(await screen.findByRole('dialog', { name: t.dialog.title }));
    expect(await dialog.findByText(t.dialog.source.default)).toBeInTheDocument();
    expect(dialog.getByLabelText(t.dialog.packageCount)).toHaveValue('10');
    expect(dialog.getByLabelText(t.dialog.qtyPerPackage('EA'))).toHaveValue('100');
    expect(dialog.getByLabelText(t.dialog.lotQty)).toHaveValue('1000');
    expect(dialog.queryByRole('button', { name: /라벨|인쇄/ })).not.toBeInTheDocument();

    await user.type(dialog.getByLabelText(t.dialog.supplierLotNo), 'SL-77');
    await user.type(dialog.getByLabelText(t.dialog.lotCount), '3');
    await user.click(dialog.getByRole('button', { name: t.dialog.submit(3) }));

    await waitFor(() =>
      expect(writes.filter((w) => w.path === '/logistics/material-lot-batches')).toHaveLength(1),
    );
    const sent = writes.find((w) => w.path === '/logistics/material-lot-batches');
    expect(sent?.headers.get('Idempotency-Key')).not.toBeNull();
    expect(sent?.headers.get('X-Worker-No')).toBeNull();
    expect(sent?.body).toEqual({
      plantId: 8401,
      supplierId: 8201,
      itemId: 601,
      lotQty: 1000,
      package: { uomId: 3, count: 10, qtyPerPackage: 100 },
      supplierLotNo: 'SL-77',
      lotCount: 3,
      businessDate: plantToday(),
      occurredAt: expect.any(String) as string,
    });
    expect(await screen.findByText(t.toast.issued(3))).toBeInTheDocument();
  });

  it('US1-8 발행 창 — 재고 수량이 패키징 곱과 다르면 알리고 발행을 잠근다', async () => {
    const { user } = setup();
    await listTable();
    await user.click(screen.getByRole('button', { name: t.list.issue }));

    const dialog = within(await screen.findByRole('dialog', { name: t.dialog.title }));
    await user.click(dialog.getByRole('combobox', { name: t.dialog.target }));
    await user.click(
      await screen.findByRole('option', {
        name: t.dialog.targetOption('합성 공급사 가', 'SYN-CAP', '합성 캡', 'EA'),
      }),
    );
    const qty = await dialog.findByLabelText(t.dialog.lotQty);
    /* 곱을 따라 채운 값을 통째로 바꿔 쓴다 — 비우면 곱으로 다시 채워진다(시안과 같음). */
    await user.tripleClick(qty);
    await user.keyboard('950');
    await user.type(dialog.getByLabelText(t.dialog.lotCount), '2');

    expect(
      dialog.getByText(t.dialog.errors.mismatch('950 EA', '봉지 10 × 100', '1,000 EA')),
    ).toBeInTheDocument();
    expect(dialog.getByRole('button', { name: t.dialog.submit(null) })).toBeDisabled();
  });

  it('US1-8 발행 창 — 기본 정보도 보관 단위도 없으면 「직접 입력」으로 패키징 없이 시작한다', async () => {
    const { user } = setup();
    await listTable();
    await user.click(screen.getByRole('button', { name: t.list.issue }));

    const dialog = within(await screen.findByRole('dialog', { name: t.dialog.title }));
    await user.click(dialog.getByRole('combobox', { name: t.dialog.target }));
    await user.click(
      await screen.findByRole('option', {
        name: t.dialog.targetOption('합성 공급사 나', 'SYN-RES', '합성 레진', 'TON'),
      }),
    );

    expect(await dialog.findByText(t.dialog.source.none)).toBeInTheDocument();
    expect(dialog.getByText(t.dialog.packageNone.none)).toBeInTheDocument();
    expect(dialog.getByLabelText(t.dialog.lotQty)).toHaveValue('');
  });
});
