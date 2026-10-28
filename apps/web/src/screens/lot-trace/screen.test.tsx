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
import type { ReceiptLine, ShipmentLine } from './types';

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

const CODES: Record<string, { code: string; codeName: string }[]> = {
  LOGISTICS_DOCUMENT_STATUS: [
    { code: 'POSTED', codeName: '전기완료' },
    { code: 'CANCELLED', codeName: '취소완료' },
  ],
  SHIPMENT_STATUS: [{ code: 'CONFIRMED', codeName: '확정' }],
};

const ROUTE = '/production/lot-trace?tab=movements&from=2026-10-20&to=2026-10-26';

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
  permissions?: string[];
  failList?: boolean;
  failStatus?: number;
}

const setup = (options: SetupOptions = {}) => {
  const traceCalls: URL[] = [];
  const receiptQueries: URL[] = [];
  const shipmentQueries: URL[] = [];
  const receipts = options.receipts ?? [receiptLine(1), receiptLine(2)];
  const shipments = options.shipments ?? [shipmentLine(11, 7)];
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
          match: (request) => new URL(request.url).pathname === '/logistics/goods-receipt-lines',
          respond: (request) => {
            const url = new URL(request.url);
            receiptQueries.push(url);
            if (!url.searchParams.has('receiptDateFrom')) {
              return jsonResponse({ errors: [{ code: 'REQUIRED' }] }, { status: 400 });
            }
            const size = Number(url.searchParams.get('size'));
            if (size === 1) {
              return jsonResponse({
                items: receipts.slice(0, 1),
                page: { page: 1, size: 1, total: 5 },
                totals: {
                  lineCount: 5,
                  qtyByUom: [],
                  lineCountByType: [
                    { receiptTypeCode: 'MATERIAL', lineCount: 4 },
                    { receiptTypeCode: 'PRODUCT', lineCount: 1 },
                  ],
                },
              });
            }
            if (options.failList === true) {
              return jsonResponse({ errors: [] }, { status: options.failStatus ?? 500 });
            }
            return jsonResponse({
              items: receipts,
              page: { page: 1, size, total: receipts.length },
              totals: {
                lineCount: receipts.length,
                qtyByUom: receipts.length === 0 ? [] : [{ uomId: 2, uomCode: 'KG', qty: 1000 }],
                lineCountByType: [{ receiptTypeCode: 'MATERIAL', lineCount: receipts.length }],
              },
            });
          },
        },
        {
          match: (request) => new URL(request.url).pathname === '/logistics/shipment-lines',
          respond: (request) => {
            const url = new URL(request.url);
            shipmentQueries.push(url);
            const size = Number(url.searchParams.get('size'));
            return jsonResponse({
              items: size === 1 ? shipments.slice(0, 1) : shipments,
              page: { page: 1, size, total: shipments.length },
              totals: {
                lineCount: shipments.length,
                qtyByUom: [{ uomId: 1, uomCode: 'EA', qty: 120 }],
              },
            });
          },
        },
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
  return { ...result, receiptQueries, shipmentQueries, traceCalls };
};

/** 표의 LOT 번호 칸(앞쪽만 줄이려고 두 조각으로 그린다). */
const listLot =
  (lotNo: string) =>
  (_content: string, element: Element | null): boolean =>
    element?.classList.contains('lot-trace-lot') === true && element.textContent === lotNo;

const listQueries = (queries: URL[]) =>
  queries.filter((url) => url.searchParams.get('size') !== '1');

describe('W-02-09 LOT 생산 이력 조회: 기간별 이력 탭', () => {
  it('주소에 기간이 없으면 공장 날짜 오늘을 끝으로 7일을 채워 자재 입고를 조회한다', async () => {
    const { receiptQueries } = setup({ route: '/production/lot-trace?tab=movements' });
    const expected = defaultPeriod(plantToday());

    await screen.findByText('GR-SYN-0001');
    const list = listQueries(receiptQueries).at(-1);
    expect(list?.searchParams.get('receiptTypeCode')).toBe('MATERIAL');
    expect(list?.searchParams.get('receiptDateFrom')).toBe(expected.from);
    expect(list?.searchParams.get('receiptDateTo')).toBe(expected.to);
  });

  it('구분 칩: 고른 칩은 목록 합계, 다른 칩은 공통 조건 건수', async () => {
    setup();

    const group = await screen.findByRole('group', { name: '구분' });
    await waitFor(() => {
      expect(within(group).getByRole('button', { name: '자재 입고 2' })).toHaveAttribute(
        'aria-pressed',
        'true',
      );
    });
    expect(within(group).getByRole('button', { name: '제품입고 1' })).toBeInTheDocument();
    expect(within(group).getByRole('button', { name: '제품 출하 1' })).toBeInTheDocument();
  });

  it('처음 여는 탭은 기간별 이력이다(주소에 탭이 없을 때)', async () => {
    setup({ route: '/production/lot-trace' });

    expect(
      await screen.findByRole('tab', { name: '기간별 이력', selected: true }),
    ).toBeInTheDocument();
    expect(await screen.findByText('GR-SYN-0001')).toBeInTheDocument();
  });

  it('목록 위 합계와 줄의 일자, 문서번호, LOT 번호, 수량을 한 줄로 보인다', async () => {
    setup();

    expect(await screen.findByText('전체 2줄')).toBeInTheDocument();
    expect(screen.getByText('1,000 KG')).toBeInTheDocument();
    const row = screen.getByRole('row', { name: /GR-SYN-0001/ });
    expect(within(row).getByText(listLot('ITEM-A|500|261023|SUP-A|0001'))).toBeInTheDocument();
    expect(within(row).getByText('500 KG')).toBeInTheDocument();
  });

  it('제품 출고 칩을 누르면 출하 줄을 부르고 첫 LOT과 「외 N」을 보인다', async () => {
    const user = userEvent.setup();
    const { shipmentQueries } = setup({
      route: `${ROUTE}&partner=3&status=POSTED`,
    });

    await user.click(await screen.findByRole('button', { name: /제품 출하/ }));

    expect(await screen.findByText('SH-SYN-0011')).toBeInTheDocument();
    expect(screen.getByText(listLot('P-SYN-0001'))).toBeInTheDocument();
    expect(screen.getByText('외 6')).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /출하 번호/ })).toBeInTheDocument();
    const list = listQueries(shipmentQueries).at(-1);
    /* 공급사와 상태는 구분마다 뜻이 달라 바꿀 때 비운다. */
    expect(list?.searchParams.has('customerId')).toBe(false);
    expect(list?.searchParams.has('statusCode')).toBe(false);
  });

  it('자재 입고 줄을 누르면 탭을 바꾸지 않고 옆 상세 창에 그 자재 LOT을 세운다', async () => {
    const user = userEvent.setup();
    const { traceCalls } = setup();

    await user.click(
      await screen.findByRole('row', {
        name: 'GR-SYN-0001 ITEM-A|500|261023|SUP-A|0001 상세 보기',
      }),
    );

    expect(screen.getByRole('tab', { name: '기간별 이력', selected: true })).toBeInTheDocument();
    await waitFor(() =>
      expect(traceCalls.some((url) => url.pathname === '/trace/lots/101/forward-flow')).toBe(true),
    );
    expect(
      screen.getByRole('row', { name: 'GR-SYN-0001 ITEM-A|500|261023|SUP-A|0001 상세 보기' }),
    ).toHaveAttribute('aria-selected', 'true');
    expect(traceCalls.some((url) => url.pathname === '/trace/material-lot-flows')).toBe(false);
  });

  it('LOT이 여럿인 출하 줄을 누르면 상세 머리에 그 줄의 LOT 고르기가 서고, 고르면 그 LOT으로 바뀐다', async () => {
    const user = userEvent.setup();
    const { traceCalls } = setup({ route: `${ROUTE}&kind=SHIPMENT` });

    await user.click(await screen.findByRole('row', { name: /SH-SYN-0011/ }));

    const picker = await screen.findByRole('group', { name: '이 줄의 LOT' });
    const buttons = within(picker).getAllByRole('button');
    expect(buttons[0]).toHaveAttribute('aria-pressed', 'true');
    expect(
      within(picker).getByText(/외 2개 LOT은 출하번호로 제품 LOT별 이력에서 찾으세요/),
    ).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: '기간별 이력', selected: true })).toBeInTheDocument();

    await user.click(buttons[1] as HTMLElement);
    await waitFor(() =>
      expect(within(picker).getAllByRole('button')[1]).toHaveAttribute('aria-pressed', 'true'),
    );
    expect(traceCalls.some((url) => /\/trace\/lots\/\d+\/backward-flow/.test(url.pathname))).toBe(
      true,
    );
  });

  it('0건이면 좁힌 조건과 함께 안내하고 내보내기를 사유와 함께 잠근다', async () => {
    setup({ receipts: [] });

    expect(await screen.findByText('조건에 맞는 자재 입고 줄이 없습니다')).toBeInTheDocument();
    expect(screen.getByText(/좁힌 조건: 기간 2026-10-20 ~ 2026-10-26/)).toBeInTheDocument();
    const exportButton = screen.getByRole('button', { name: '엑셀 내보내기' });
    expect(exportButton).toBeDisabled();
    expect(exportButton).toHaveAccessibleDescription('조회 결과가 없어 내보낼 수 없습니다');
  });

  it('조회에 실패하면 [다시 조회]를 보인다', async () => {
    setup({ failList: true });

    expect(await screen.findByText('기간별 이력을 불러오지 못했습니다')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '다시 조회' })).toBeInTheDocument();
  });

  it('권한이 없으면(403) 권한 안내를 보이고 [다시 조회]를 두지 않는다', async () => {
    setup({ failList: true, failStatus: 403 });

    expect(await screen.findByText('LOT 생산 이력 조회 권한이 없습니다')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '다시 조회' })).toBeNull();
  });

  it('주소의 기간이 366일을 넘으면 부르지 않고 사유를 보인다', async () => {
    const { receiptQueries } = setup({
      route: '/production/lot-trace?tab=movements&from=2025-01-01&to=2026-10-26',
    });

    expect(await screen.findByText('기간은 366일까지 조회할 수 있습니다')).toBeInTheDocument();
    expect(receiptQueries).toHaveLength(0);
  });

  it('상세 조건을 펴면 창고, 공급사, 상태가 보인다. 제품입고에는 공급사가 없다', async () => {
    const user = userEvent.setup();
    setup();

    await user.click(await screen.findByRole('button', { name: '상세 조건 펼치기' }));
    expect(screen.getByLabelText('창고')).toBeInTheDocument();
    expect(screen.getByLabelText('공급사')).toBeInTheDocument();
    expect(screen.getByLabelText('상태')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /제품입고/ }));
    await waitFor(() => expect(screen.queryByLabelText('공급사')).toBeNull());
    expect(screen.queryByLabelText('고객')).toBeNull();
  });
});

describe('W-02-09 LOT 생산 이력 조회: 기간별 이력 조건 바로 반영', () => {
  it('기간을 고르면 [조회] 없이 반영하고, 쪽을 1로 돌리고, 주소를 바꿔 쓴다', async () => {
    const user = userEvent.setup();
    const { receiptQueries } = setup({ route: `${ROUTE}&page=2` });
    await screen.findByText('GR-SYN-0001');

    await pickRange(user, screen.getByLabelText(/^기간(?!별)/), '2026-10-21', '2026-10-24');

    await waitFor(() =>
      expect(listQueries(receiptQueries).at(-1)?.searchParams.get('receiptDateFrom')).toBe(
        '2026-10-21',
      ),
    );
    expect(listQueries(receiptQueries).at(-1)?.searchParams.get('receiptDateTo')).toBe(
      '2026-10-24',
    );
    expect(navState()).toMatch(/^REPLACE /);
    expect(navState()).not.toContain('page=');
  });

  it('구분 칩도 주소를 바꿔 쓴다', async () => {
    const user = userEvent.setup();
    setup();
    await screen.findByText('GR-SYN-0001');

    await user.click(screen.getByRole('button', { name: /제품 출하/ }));

    await waitFor(() => expect(navState()).toContain('kind=SHIPMENT'));
    expect(navState()).toMatch(/^REPLACE /);
  });

  it('같은 조건의 [조회]는 다시 조회한다', async () => {
    const user = userEvent.setup();
    const { receiptQueries } = setup();
    await screen.findByText('GR-SYN-0001');
    const before = listQueries(receiptQueries).length;

    await user.click(screen.getByRole('button', { name: '조회' }));

    await waitFor(() => expect(listQueries(receiptQueries).length).toBe(before + 1));
  });
});
