import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useLocation, useNavigationType } from 'react-router';
import { describe, expect, it } from 'vitest';

import { plantToday } from '../../patterns/plant-time';
import { SessionProvider } from '../../patterns/session';
import { createStubFetch, jsonResponse, renderWithProviders } from '../../test/api-harness';
import { SYNTHETIC_SESSION } from '../../test/session-harness';
import { pickRange } from '../../test/date-picker';
import { defaultPeriod } from './period';
import { LotTraceScreen } from './screen';
import { traceRoutes } from './trace-fixtures';
import type { InputLine, PackingLine, ReceiptLine, ShipmentLine } from './types';

/* 합성값이다 — 실제 기준 정보 값을 쓰지 않는다(공개 저장소). */
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
  ...overrides,
});

const shipmentLine = (id: number, lotCount: number): ShipmentLine => ({
  shipmentLineId: id,
  shipmentId: 700 + id,
  shipmentNo: `SH-SYN-${String(id).padStart(4, '0')}`,
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
  lots: Array.from({ length: Math.min(5, lotCount) }, (_, index) => ({
    lotId: 500 + index,
    lotNo: `P-SYN-${String(index + 1).padStart(4, '0')}`,
    qty: 10,
  })),
  lotCount,
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
  ...overrides,
});

const packingLine = (id: number, overrides: Partial<PackingLine> = {}): PackingLine => ({
  handlingUnitContentId: id,
  handlingUnitId: 600 + id,
  handlingUnitNo: `HU-SYN-${String(id).padStart(4, '0')}`,
  handlingUnitTypeCode: 'BOX',
  handlingUnitStatusCode: 'PACKED',
  packedAt: '2026-10-24T01:00:00Z',
  plantId: 1,
  item: { id: 6, code: 'FG-A', name: '제품 A' },
  lotId: 500,
  lotNo: 'P-SYN-0001',
  qty: 100,
  uomId: 1,
  uomCode: 'EA',
  workOrder: { workOrderId: 70, workOrderNo: 'WO-SYN-0070' },
  shippingUnit: null,
  ...overrides,
});

const CODES: Record<string, { code: string; codeName: string }[]> = {
  LOGISTICS_DOCUMENT_STATUS: [
    { code: 'POSTED', codeName: '전기완료' },
    { code: 'CANCELLED', codeName: '취소완료' },
  ],
  SHIPMENT_STATUS: [{ code: 'CONFIRMED', codeName: '확정' }],
};

const ROUTE = '/production/lot-trace?from=2026-10-20&to=2026-10-26';

/** 지금 주소와 마지막 이동 방식(PUSH, REPLACE). 바로 반영은 주소를 바꿔 써야 한다. */
const NavProbe = () => {
  const location = useLocation();
  const type = useNavigationType();
  return <output data-testid="nav">{`${type} ${location.pathname}${location.search}`}</output>;
};
const navState = () => screen.getByTestId('nav').textContent ?? '';

interface SetupOptions {
  route?: string;
  receipts?: ReceiptLine[];
  shipments?: ShipmentLine[];
  inputs?: InputLine[];
  packings?: PackingLine[];
  permissions?: string[];
  failList?: boolean;
  failStatus?: number;
}

/** 줄 목록 스텁 한 벌 — 기간이나 고정 번호가 없으면 400, `size=1`은 건수용. LOT 번호(`lotNo`)로 고르면 그 LOT 줄만. */
const lineRoute = <Line,>(
  pathname: string,
  fromKey: string,
  lines: () => Line[],
  lotNos: (line: Line) => string[],
  queries: URL[],
  options: SetupOptions,
) => ({
  match: (request: Request) => new URL(request.url).pathname === pathname,
  respond: (request: Request) => {
    const url = new URL(request.url);
    queries.push(url);
    const pinned = ['lotNo', 'inboundReceiptNo', 'workOrderNo', 'shipmentNo'].some((key) =>
      url.searchParams.has(key),
    );
    if (!url.searchParams.has(fromKey) && !pinned) {
      return jsonResponse({ errors: [{ code: 'REQUIRED' }] }, { status: 400 });
    }
    const size = Number(url.searchParams.get('size'));
    if (options.failList === true && size !== 1) {
      return jsonResponse({ errors: [] }, { status: options.failStatus ?? 500 });
    }
    const lotNo = url.searchParams.get('lotNo');
    const items = lines().filter((line) => lotNo === null || lotNos(line).includes(lotNo));
    return jsonResponse({
      items: size === 1 ? items.slice(0, 1) : items,
      page: { page: 1, size, total: items.length },
      totals: {
        lineCount: items.length,
        qtyByUom: items.length === 0 ? [] : [{ uomId: 2, uomCode: 'KG', qty: 1000 }],
        lineCountByType: [],
      },
    });
  },
});

const setup = (options: SetupOptions = {}) => {
  const traceCalls: URL[] = [];
  const receiptQueries: URL[] = [];
  const shipmentQueries: URL[] = [];
  const inputQueries: URL[] = [];
  const packingQueries: URL[] = [];
  const receipts = options.receipts ?? [
    receiptLine(1),
    receiptLine(2),
    receiptLine(3, {
      receiptTypeCode: 'PRODUCT',
      goodsReceiptNo: 'GR-SYN-0003',
      lotId: 500,
      lotNo: 'P-SYN-0001',
      supplier: null,
      workOrder: { workOrderId: 70, workOrderNo: 'WO-SYN-0070' },
    } as Partial<ReceiptLine>),
  ];
  const shipments = options.shipments ?? [shipmentLine(11, 7)];
  const inputs = options.inputs ?? [inputLine(21)];
  const packings = options.packings ?? [packingLine(31)];
  const result = renderWithProviders(
    <SessionProvider>
      <LotTraceScreen permissionMenuPath="합성 묶음 › 합성 메뉴" />
      <NavProbe />
    </SessionProvider>,
    {
      session: {
        ...SYNTHETIC_SESSION,
        ...(options.permissions === undefined ? {} : { permissions: options.permissions }),
      },
      route: options.route ?? ROUTE,
      fetch: createStubFetch([
        {
          ...lineRoute(
            '/logistics/goods-receipt-lines',
            'receiptDateFrom',
            () => receipts,
            (line) => [line.lotNo],
            receiptQueries,
            options,
          ),
          respond: (request: Request) => {
            const url = new URL(request.url);
            const type = url.searchParams.get('receiptTypeCode');
            return lineRoute(
              '/logistics/goods-receipt-lines',
              'receiptDateFrom',
              () => receipts.filter((line) => type === null || line.receiptTypeCode === type),
              (line) => [line.lotNo],
              receiptQueries,
              options,
            ).respond(request);
          },
        },
        lineRoute(
          '/logistics/shipment-lines',
          'shipDateFrom',
          () => shipments,
          (line) => line.lots.map((lot) => lot.lotNo),
          shipmentQueries,
          options,
        ),
        lineRoute(
          '/trace/material-input-lines',
          'inputDateFrom',
          () => inputs,
          (line) => [line.lotNo],
          inputQueries,
          options,
        ),
        lineRoute(
          '/trace/packing-lines',
          'packedDateFrom',
          () => packings,
          (line) => [line.lotNo],
          packingQueries,
          options,
        ),
        ...traceRoutes({}, traceCalls),
        {
          match: (request) => new URL(request.url).pathname === '/mdm/code-values',
          respond: (request) => {
            const group = new URL(request.url).searchParams.get('codeGroupCode') ?? '';
            const items = (CODES[group] ?? []).map((value, index) => ({
              codeValueId: index + 1,
              codeGroupId: 1,
              sortOrder: index,
              isActive: true,
              ...value,
            }));
            return jsonResponse({ items, page: { page: 1, size: 100, total: items.length } });
          },
        },
      ]),
    },
  );
  return {
    ...result,
    receiptQueries,
    shipmentQueries,
    inputQueries,
    packingQueries,
    traceCalls,
  };
};

const listQueries = (queries: URL[]) =>
  queries.filter((url) => url.searchParams.get('size') !== '1');

/** 표의 LOT 번호 칸(앞쪽만 줄이려고 두 조각으로 그린다). */
const listLot =
  (lotNo: string) =>
  (_content: string, element: Element | null): boolean =>
    element?.classList.contains('lot-trace-lot') === true && element.textContent === lotNo;

const kindChips = () => screen.getByRole('group', { name: '구분' });

describe('W-02-09 LOT 생산 이력 조회: 이력 목록', () => {
  it('메뉴로 열면 탭 없이 기본 기간(오늘까지 7일)으로 다섯 구분의 줄을 시각순으로 모아 보인다', async () => {
    const { receiptQueries, inputQueries, packingQueries, shipmentQueries } = setup({
      route: '/production/lot-trace',
    });
    const expected = defaultPeriod(plantToday());

    expect(await screen.findByText('GR-SYN-0001')).toBeInTheDocument();
    expect(screen.queryByRole('tab')).toBeNull();
    for (const [queries, key] of [
      [receiptQueries, 'receiptDateFrom'],
      [inputQueries, 'inputDateFrom'],
      [packingQueries, 'packedDateFrom'],
      [shipmentQueries, 'shipDateFrom'],
    ] as const) {
      expect(listQueries(queries).at(-1)?.searchParams.get(key)).toBe(expected.from);
    }
    expect(screen.getByText('MC-SYN-0021')).toBeInTheDocument();
    expect(screen.getByText('HU-SYN-0031')).toBeInTheDocument();
    expect(screen.getByText('SH-SYN-0011')).toBeInTheDocument();
    /* 전체일 때만 구분 열이 있다. */
    expect(screen.getByRole('columnheader', { name: /구분/ })).toBeInTheDocument();
  });

  it('구분 칩: 전체, 자재 입고, 자재 투입, 제품입고, 포장, 제품 출하와 건수', async () => {
    setup();

    const group = await screen.findByRole('group', { name: '구분' });
    await waitFor(() =>
      expect(within(group).getByRole('button', { name: '전체 6' })).toHaveAttribute(
        'aria-pressed',
        'true',
      ),
    );
    for (const name of ['자재 입고 2', '자재 투입 1', '제품입고 1', '포장 1', '제품 출하 1']) {
      expect(within(group).getByRole('button', { name })).toBeInTheDocument();
    }
  });

  it('제품입고 칩을 고르면 제품입고 줄만 보인다 — 출하 줄이나 출하번호가 섞이지 않는다', async () => {
    const user = userEvent.setup();
    const { shipmentQueries } = setup();
    await screen.findByText('GR-SYN-0001');
    const before = listQueries(shipmentQueries).length;

    await user.click(within(kindChips()).getByRole('button', { name: /^제품입고/ }));

    await waitFor(() => expect(screen.queryByText('GR-SYN-0001')).toBeNull());
    const rows = screen.getAllByRole('row').slice(1);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toHaveTextContent('GR-SYN-0003');
    expect(screen.queryByText(/SH-SYN/)).toBeNull();
    expect(listQueries(shipmentQueries)).toHaveLength(before);
    /* 구분 칩 하나를 고르면 구분 열은 없다. */
    expect(screen.queryByRole('columnheader', { name: /구분/ })).toBeNull();
  });

  it('제품 출하 칩을 누르면 출하 줄을 부르고 첫 LOT과 「외 N」을 보인다', async () => {
    const user = userEvent.setup();
    setup();

    await user.click(await screen.findByRole('button', { name: /^제품 출하/ }));

    expect(await screen.findByText('SH-SYN-0011')).toBeInTheDocument();
    expect(screen.getByText(listLot('P-SYN-0001'))).toBeInTheDocument();
    expect(screen.getByText('외 6')).toBeInTheDocument();
    expect(navState()).toContain('kind=SHIPMENT');
    expect(navState()).toMatch(/^REPLACE /);
  });

  it('줄을 누르면 옆 상세 창에 그 LOT을 세우고 고른 줄을 표시한다', async () => {
    const user = userEvent.setup();
    const { traceCalls } = setup({ route: `${ROUTE}&kind=MATERIAL` });

    await user.click(
      await screen.findByRole('row', {
        name: 'GR-SYN-0001 ITEM-A|500|261023|SUP-A|0001 상세 보기',
      }),
    );

    await waitFor(() =>
      expect(traceCalls.some((url) => url.pathname === '/trace/lots/101/forward-flow')).toBe(true),
    );
    expect(
      screen.getByRole('row', { name: 'GR-SYN-0001 ITEM-A|500|261023|SUP-A|0001 상세 보기' }),
    ).toHaveAttribute('aria-selected', 'true');
    expect(navState()).toContain('line=MATERIAL-1');
  });

  it('LOT이 여럿인 출하 줄을 누르면 상세 머리에 그 줄의 LOT 고르기가 서고, 고르면 그 LOT으로 바뀐다', async () => {
    const user = userEvent.setup();
    const { traceCalls } = setup({ route: `${ROUTE}&kind=SHIPMENT` });

    await user.click(await screen.findByRole('row', { name: /SH-SYN-0011/ }));

    const picker = await screen.findByRole('group', { name: '이 줄의 LOT' });
    const buttons = within(picker).getAllByRole('button');
    expect(buttons[0]).toHaveAttribute('aria-pressed', 'true');
    expect(
      within(picker).getByText(/외 2개 LOT은 상세 조건의 출하번호로 찾으세요/),
    ).toBeInTheDocument();

    await user.click(buttons[1] as HTMLElement);
    await waitFor(() =>
      expect(within(picker).getAllByRole('button')[1]).toHaveAttribute('aria-pressed', 'true'),
    );
    expect(traceCalls.some((url) => /\/trace\/lots\/\d+\/backward-flow/.test(url.pathname))).toBe(
      true,
    );
  });

  it('자재 LOT 번호로 찾으면 기간 없이 그 LOT의 자재 입고와 자재 투입을 부르고, 한 LOT이면 상세를 바로 연다', async () => {
    const { receiptQueries, shipmentQueries, inputQueries } = setup({
      route: `/production/lot-trace?mlot=${encodeURIComponent('ITEM-A|500|261023|SUP-A|0001')}`,
    });

    expect(await screen.findByText('GR-SYN-0001')).toBeInTheDocument();
    const receipt = listQueries(receiptQueries).at(-1);
    expect(receipt?.searchParams.get('lotNo')).toBe('ITEM-A|500|261023|SUP-A|0001');
    expect(receipt?.searchParams.has('receiptDateFrom')).toBe(false);
    expect(listQueries(inputQueries).at(-1)?.searchParams.get('lotNo')).toBe(
      'ITEM-A|500|261023|SUP-A|0001',
    );
    /* 제품 쪽 줄은 자재 LOT 번호를 걸 수 없어 부르지 않는다. */
    expect(listQueries(shipmentQueries)).toHaveLength(0);
    await waitFor(() => expect(navState()).toContain('selected=101'));
    expect(
      screen.getByText('상세 조건: 자재 LOT 번호 ITEM-A|500|261023|SUP-A|0001'),
    ).toBeInTheDocument();
  });

  it('탭이 있던 때의 주소(LOT 상태 상세의 [추적 보기])도 같은 LOT을 연다', async () => {
    setup({
      route:
        '/production/lot-trace?tab=forward&lot=ITEM-A%7C500%7C261023%7CSUP-A%7C0001&selected=101',
    });

    await waitFor(() => expect(navState()).toContain('mlot=ITEM-A'));
    expect(navState()).toContain('selected=101');
    expect(navState()).not.toContain('tab=');
  });

  it('0건이면 그 기간에 없다고 하고 내보내기를 사유와 함께 잠근다', async () => {
    setup({ receipts: [], shipments: [], inputs: [], packings: [] });

    expect(
      await screen.findByText('2026-10-20 ~ 2026-10-26에 조건에 맞는 이력이 없습니다'),
    ).toBeInTheDocument();
    expect(screen.getByText(/좁힌 조건: 기간 2026-10-20 ~ 2026-10-26/)).toBeInTheDocument();
    const exportButton = screen.getByRole('button', { name: '엑셀 내보내기' });
    expect(exportButton).toBeDisabled();
    expect(exportButton).toHaveAccessibleDescription('조회 결과가 없어 내보낼 수 없습니다');
  });

  it('조회에 실패하면 [다시 조회]를 보인다', async () => {
    setup({ route: `${ROUTE}&kind=MATERIAL`, failList: true });

    expect(await screen.findByText('이력을 불러오지 못했습니다')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '다시 조회' })).toBeInTheDocument();
  });

  it('권한이 없으면(403) 권한 안내를 보이고 [다시 조회]를 두지 않는다', async () => {
    setup({ route: `${ROUTE}&kind=MATERIAL`, failList: true, failStatus: 403 });

    expect(await screen.findByText('LOT 생산 이력 조회 권한이 없습니다')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '다시 조회' })).toBeNull();
  });

  it('주소의 기간이 366일을 넘으면 부르지 않고 사유를 보인다', async () => {
    const { receiptQueries } = setup({
      route: '/production/lot-trace?from=2025-01-01&to=2026-10-26',
    });

    expect(await screen.findAllByText('기간은 366일까지 조회할 수 있습니다')).not.toHaveLength(0);
    expect(receiptQueries).toHaveLength(0);
  });

  it('상세 조건은 접힌 채 시작하고, 펴면 번호와 공급사, 고객 칸이 보인다', async () => {
    const user = userEvent.setup();
    setup();

    const toggle = await screen.findByRole('button', { name: '상세 조건 펼치기' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByLabelText('자재 LOT 번호')).toBeNull();
    await user.click(toggle);
    for (const label of [
      '자재 LOT 번호',
      '제품 LOT 번호',
      '입하번호',
      'W/O 번호',
      '출하번호',
      '공급사',
      '고객',
    ]) {
      expect(screen.getByLabelText(label)).toBeInTheDocument();
    }
  });
});

describe('W-02-09 LOT 생산 이력 조회: 조건 바로 반영', () => {
  it('기간을 고르면 [조회] 없이 반영하고, 쪽을 1로 돌리고, 주소를 바꿔 쓴다', async () => {
    const user = userEvent.setup();
    const { receiptQueries } = setup({ route: `${ROUTE}&kind=MATERIAL&page=2` });
    await screen.findByText('GR-SYN-0001');

    await pickRange(user, screen.getByLabelText(/^기간/), '2026-10-21', '2026-10-24');

    await waitFor(() =>
      expect(listQueries(receiptQueries).at(-1)?.searchParams.get('receiptDateFrom')).toBe(
        '2026-10-21',
      ),
    );
    expect(navState()).toMatch(/^REPLACE /);
    expect(navState()).not.toContain('page=');
  });

  it('같은 조건의 [조회]는 다시 조회한다', async () => {
    const user = userEvent.setup();
    const { receiptQueries } = setup({ route: `${ROUTE}&kind=MATERIAL` });
    await screen.findByText('GR-SYN-0001');
    const before = listQueries(receiptQueries).length;

    await user.click(screen.getByRole('button', { name: '조회' }));

    await waitFor(() => expect(listQueries(receiptQueries).length).toBe(before + 1));
  });
});
