import { messages } from '@omf-mes/i18n';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { SessionProvider } from '../../patterns/session';
import { createStubFetch, jsonResponse, renderWithProviders } from '../../test/api-harness';
import { SYNTHETIC_SESSION } from '../../test/session-harness';
import { LotTraceScreen } from './screen';
import { traceRoutes } from './trace-fixtures';
import type { InputLine, ReceiptLine, ShipmentLine } from './types';

/*
 * FR-035 W-02-09 LOT 생산 이력 — 입하 LOT 칸 · 거르기(005 계약 §13 · screens/W-02-09.md).
 * 값은 전부 지어낸 합성값이다.
 */

const t = messages.lotTrace;
const IL_NO = 'IL-20261112-0001';
const ROUTE = '/production/lot-trace?from=2026-10-20&to=2026-10-26';

const receiptLine = (id: number, overrides: Partial<ReceiptLine> = {}): ReceiptLine => ({
  goodsReceiptLineId: id,
  goodsReceiptId: 900 + id,
  goodsReceiptNo: `GR-SYN-${String(id).padStart(4, '0')}`,
  lineNo: 1,
  receiptTypeCode: 'MATERIAL',
  receiptDatetime: '2026-10-23T08:00:00Z',
  statusCode: 'POSTED',
  plantId: 1,
  warehouse: { id: 2, code: 'WH-A', name: '창고 A' },
  item: { id: 1, code: 'ITEM-A', name: '품목 A' },
  lotId: 100 + id,
  lotNo: `ITEM-A|500|261023|SUP-A|${String(id).padStart(4, '0')}`,
  receiptQty: 500,
  uomId: 2,
  uomCode: 'KG',
  supplier: { id: 3, code: 'SUP-A', name: '공급사 A' },
  workOrder: null,
  inboundLotId: null,
  inboundLotNo: null,
  ...overrides,
});

const inputLine = (id: number, overrides: Partial<InputLine> = {}): InputLine => ({
  materialConsumptionId: id,
  consumptionNo: `MC-SYN-${String(id).padStart(4, '0')}`,
  occurredAt: '2026-10-23T09:00:00Z',
  statusCode: 'POSTED',
  consumptionTypeCode: 'NORMAL',
  correctsConsumptionId: null,
  plantId: 1,
  workOrder: { workOrderId: 70, workOrderNo: 'WO-SYN-0070' },
  item: { id: 1, code: 'ITEM-A', name: '품목 A' },
  lotId: 101,
  lotNo: 'ITEM-A|500|261023|SUP-A|0001',
  inputQty: 30,
  uomId: 2,
  uomCode: 'KG',
  inboundLotId: null,
  inboundLotNo: null,
  ...overrides,
});

const shipmentLine: ShipmentLine = {
  shipmentLineId: 11,
  shipmentId: 711,
  shipmentNo: 'SH-SYN-0011',
  lineNo: 1,
  shippedAt: '2026-10-24T02:00:00Z',
  statusCode: 'CONFIRMED',
  plantId: 1,
  warehouse: { id: 4, code: 'WH-FG', name: '제품 창고 B' },
  customer: { id: 5, code: 'CUS-A', name: '고객 A' },
  item: { id: 6, code: 'FG-A', name: '제품 A' },
  shippedQty: 120,
  uomId: 1,
  uomCode: 'EA',
  lots: [{ lotId: 500, lotNo: 'P-SYN-0001', qty: 10 }],
  lotCount: 1,
};

const RECEIPTS: ReceiptLine[] = [
  receiptLine(1, { inboundLotId: 9901, inboundLotNo: IL_NO }),
  /* 입하 LOT 이 없는 자재 LOT — 칸은 빈칸이다. */
  receiptLine(2),
  receiptLine(3, {
    receiptTypeCode: 'PRODUCT',
    lotId: 500,
    lotNo: 'P-SYN-0001',
    supplier: null,
    workOrder: { workOrderId: 70, workOrderNo: 'WO-SYN-0070' },
  }),
];

const page = (items: unknown[], size: number) => ({
  items: size === 1 ? items.slice(0, 1) : items,
  page: { page: 1, size, total: items.length },
  totals: {
    lineCount: items.length,
    qtyByUom: items.length === 0 ? [] : [{ uomId: 2, uomCode: 'KG', qty: 1000 }],
    lineCountByType: [],
  },
});

const setup = (route = ROUTE) => {
  const calls: Record<string, URL[]> = {
    receipt: [],
    input: [],
    packing: [],
    shipment: [],
  };
  const lineRoute = (pathname: string, key: string, items: (url: URL) => unknown[]) => ({
    match: (request: Request) => new URL(request.url).pathname === pathname,
    respond: (request: Request) => {
      const url = new URL(request.url);
      calls[key]?.push(url);
      return jsonResponse(page(items(url), Number(url.searchParams.get('size'))));
    },
  });

  renderWithProviders(
    <SessionProvider>
      <LotTraceScreen permissionMenuPath="합성 묶음 › 합성 메뉴" />
    </SessionProvider>,
    {
      session: SYNTHETIC_SESSION,
      route,
      fetch: createStubFetch([
        lineRoute('/logistics/goods-receipt-lines', 'receipt', (url) =>
          RECEIPTS.filter(
            (line) => line.receiptTypeCode === url.searchParams.get('receiptTypeCode'),
          ),
        ),
        lineRoute('/trace/material-input-lines', 'input', () => [
          inputLine(21, { inboundLotId: 9901, inboundLotNo: IL_NO }),
        ]),
        lineRoute('/trace/packing-lines', 'packing', () => []),
        lineRoute('/logistics/shipment-lines', 'shipment', () => [shipmentLine]),
        ...traceRoutes({}, []),
        {
          match: (request) => new URL(request.url).pathname === '/mdm/code-values',
          respond: () => jsonResponse({ items: [], page: { page: 1, size: 100, total: 0 } }),
        },
      ]),
    },
  );

  return { calls, user: userEvent.setup() };
};

const listCalls = (queries: URL[] | undefined): URL[] =>
  (queries ?? []).filter((url) => url.searchParams.get('size') !== '1');

describe('FR-035 W-02-09 LOT 생산 이력 — 입하 LOT 칸 · 거르기', () => {
  it('FR-035 이동 표에 「입하 LOT」 칸 — 자재 입고 · 투입 줄은 번호, 입하 LOT 이 없는 줄은 빈칸', async () => {
    setup();

    expect(await screen.findByText('GR-SYN-0001')).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: t.list.columns.inboundLot })).toBeVisible();
    /* 자재 입고 1줄 + 투입 1줄 — 입하 LOT 이 없는 자재 입고 · 제품입고 · 출하 줄에는 단추가 없다. */
    expect(screen.getAllByRole('button', { name: t.list.filterInboundLot(IL_NO) })).toHaveLength(2);
  });

  it('FR-035 제품 쪽 구분(제품입고)만 볼 때는 「입하 LOT」 칸이 없다', async () => {
    setup(`${ROUTE}&kind=PRODUCT`);

    expect(await screen.findByText('GR-SYN-0003')).toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: t.list.columns.inboundLot })).toBeNull();
  });

  it('FR-035 입하 LOT 번호 조건만 있으면 기간 없이 조회하고, 자재 입고 · 투입만 부른다', async () => {
    const { calls } = setup(`/production/lot-trace?ilno=${IL_NO}`);

    expect(await screen.findByText('GR-SYN-0001')).toBeInTheDocument();
    const receipt = listCalls(calls.receipt);
    const input = listCalls(calls.input);
    expect(receipt.length).toBeGreaterThan(0);
    expect(input.length).toBeGreaterThan(0);
    for (const url of receipt) {
      expect(url.searchParams.get('receiptTypeCode')).toBe('MATERIAL');
      expect(url.searchParams.get('inboundLotNo')).toBe(IL_NO);
      expect(url.searchParams.has('receiptDateFrom')).toBe(false);
      expect(url.searchParams.has('receiptDateTo')).toBe(false);
    }
    for (const url of input) {
      expect(url.searchParams.get('inboundLotNo')).toBe(IL_NO);
      expect(url.searchParams.has('inputDateFrom')).toBe(false);
    }
    /* 제품 쪽 구분은 부르지 않는다 — 자재 LOT 번호 · 입하번호와 같은 규칙. */
    expect(calls.packing).toEqual([]);
    expect(calls.shipment).toEqual([]);
    /* 기간 사유가 없다. */
    expect(screen.queryByText(messages.lotTrace.period.required)).toBeNull();
  });

  it('FR-035 상세 조건 「입하 LOT 번호」 칸에 넣으면 그 조건으로 조회한다', async () => {
    const { calls, user } = setup();

    await screen.findByText('GR-SYN-0001');
    await user.click(screen.getByRole('button', { name: new RegExp(t.filters.more) }));
    await user.type(
      screen.getByRole('searchbox', { name: t.filters.inboundLotNo }),
      `${IL_NO}{Enter}`,
    );

    await waitFor(() => {
      expect(listCalls(calls.receipt).at(-1)?.searchParams.get('inboundLotNo')).toBe(IL_NO);
    });
    expect(listCalls(calls.input).at(-1)?.searchParams.get('inboundLotNo')).toBe(IL_NO);
  });

  it('FR-035 행의 입하 LOT 번호를 누르면 inboundLotId 로 거르고(기간 없이), 거르기 표시의 ✕ 로 지운다', async () => {
    const { calls, user } = setup();

    await screen.findByText('GR-SYN-0001');
    const [first] = screen.getAllByRole('button', { name: t.list.filterInboundLot(IL_NO) });
    if (first === undefined) throw new Error('입하 LOT 단추가 없습니다.');
    await user.click(first);

    await waitFor(() => {
      expect(listCalls(calls.receipt).at(-1)?.searchParams.get('inboundLotId')).toBe('9901');
    });
    expect(listCalls(calls.receipt).at(-1)?.searchParams.has('receiptDateFrom')).toBe(false);
    expect(listCalls(calls.input).at(-1)?.searchParams.get('inboundLotId')).toBe('9901');
    expect(screen.getByText(t.filters.inboundLotChip(IL_NO))).toBeInTheDocument();

    const before = listCalls(calls.receipt).length;
    await user.click(screen.getByRole('button', { name: t.filters.inboundLotChipRemove }));

    await waitFor(() => {
      expect(listCalls(calls.receipt).length).toBeGreaterThan(before);
    });
    await waitFor(() => {
      expect(listCalls(calls.receipt).at(-1)?.searchParams.has('inboundLotId')).toBe(false);
    });
    expect(screen.queryByText(t.filters.inboundLotChip(IL_NO))).toBeNull();
  });
});
