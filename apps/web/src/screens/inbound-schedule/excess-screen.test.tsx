import { messages } from '@omf-mes/i18n';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import {
  createStubFetch,
  jsonResponse,
  renderWithProviders,
  type StubRoute,
} from '../../test/api-harness';
import { InboundExcessScreen } from './excess-screen';
import type { UnallocatedLine } from './excess-types';
import { candidateFixture, excessFixture } from './fixtures';

const te = messages.inboundSchedule.excess;

const ROUTE = '/logistics/inbound-excess';
/** 초과분 발주 연결(서버 장부 P-115 입하 ↔ P/O 배정) — 계약 밖 경로 셋. */
const EXCESS_PATH = '/logistics/inbound-unallocated';
const CANDIDATES_PATH = /^\/logistics\/inbound-receipt-lines\/\d+\/allocation-candidates$/;
const ALLOCATIONS_PATH = /^\/logistics\/inbound-receipt-lines\/(\d+)\/allocations$/;

const QTY = '30 SAMPLE-EA';
const ORDER_LINE = te.orderLine('SAMPLE-PO-0001', 1);

const listBody = (items: unknown[]) => ({
  items,
  page: { page: 1, size: 50, total: items.length },
});

/** 초과분이 남은 입하 줄 목록(서버 「미배정」). */
const excessListRoute = (unlinked: UnallocatedLine[]): StubRoute => ({
  match: (request) => request.method === 'GET' && new URL(request.url).pathname === EXCESS_PATH,
  respond: () => jsonResponse(listBody(unlinked)),
});

const candidatesRoute = (items: unknown[]): StubRoute => ({
  match: (request) =>
    request.method === 'GET' && CANDIDATES_PATH.test(new URL(request.url).pathname),
  respond: () => jsonResponse({ items }),
});

/** 연결(서버 「배정」) — 본문과 경로를 모은다. 응답은 주어진 것(기본 201 배정 한 몫). */
const allocationWriteRoute = (
  bodies: unknown[],
  paths: string[] = [],
  respond: () => Response = () =>
    jsonResponse(
      {
        inboundReceiptPoAllocationId: 9702,
        inboundReceiptLineId: 9411,
        allocatedQty: 30,
        allocatedAt: '2026-10-21T03:00:00.000Z',
        orderLine: {
          purchaseOrderLineId: 7301,
          purchaseOrderId: 7101,
          purchaseOrderNo: 'SAMPLE-PO-0001',
          erpPurchaseOrderNo: 'SAMPLE-ERP-0001',
          lineNo: 1,
        },
      },
      { status: 201 },
    ),
): StubRoute => ({
  match: (request) =>
    request.method === 'POST' && ALLOCATIONS_PATH.test(new URL(request.url).pathname),
  respond: async (request) => {
    paths.push(new URL(request.url).pathname);
    const text = await request.clone().text();
    bodies.push(text === '' ? null : JSON.parse(text));

    return respond();
  },
});

const renderTab = (routes: StubRoute[], search = '') => {
  renderWithProviders(<InboundExcessScreen />, {
    fetch: createStubFetch(routes),
    route: `${ROUTE}${search}`,
  });

  return userEvent.setup();
};

const listPane = (): HTMLElement => screen.getByRole('region', { name: te.listTitle });
const detailPane = (): HTMLElement => screen.getByRole('region', { name: te.candidates.title });

describe('InboundExcessScreen — 초과분 발주 연결 탭', () => {
  it('주소가 실은 초과분 · 라인을 고른 채로 서고, 「연결」만 누르면 된다', async () => {
    const bodies: unknown[] = [];
    const paths: string[] = [];
    const user = renderTab(
      [
        excessListRoute([excessFixture()]),
        candidatesRoute([
          /* 수량 일치 후보가 따로 있어도 사람이 라인에서 고른 줄이 남는다. */
          candidateFixture({
            purchaseOrderLineId: 7388,
            purchaseOrderId: 7188,
            purchaseOrderNo: 'SAMPLE-PO-0088',
            roomQty: 30,
            exactMatch: true,
          }),
          candidateFixture(),
        ]),
        allocationWriteRoute(bodies, paths),
      ],
      '?receiptLine=9411&line=7301&po=7101',
    );

    expect(
      await within(detailPane()).findByText(te.confirmLink(QTY, ORDER_LINE)),
    ).toBeInTheDocument();
    /* 후보 표식 — 수량 일치 · 입고 관리에서 보던 발주. */
    expect(within(detailPane()).getByText(te.candidates.exact)).toBeInTheDocument();
    expect(within(detailPane()).getByText(te.candidates.current)).toBeInTheDocument();

    await user.click(within(detailPane()).getByRole('button', { name: te.actions.link }));

    expect(
      await within(detailPane()).findByText(te.done.linked(QTY, ORDER_LINE)),
    ).toBeInTheDocument();
    /* 그 입하 줄의 초과분 전부를 싣는다. */
    expect(bodies).toEqual([{ purchaseOrderLineId: 7301, qty: 30 }]);
    expect(paths).toEqual(['/logistics/inbound-receipt-lines/9411/allocations']);
  });

  it('고르기 전에는 무엇을 고를지 말하고, 왼쪽 줄 · 후보 줄을 고르면 「연결」이 풀린다', async () => {
    const user = renderTab([
      excessListRoute([excessFixture(), excessFixture({ inboundReceiptLineId: 9412, lineNo: 2 })]),
      candidatesRoute([
        candidateFixture(),
        candidateFixture({ purchaseOrderLineId: 7302, lineNo: 2 }),
      ]),
    ]);

    expect(await within(detailPane()).findByText(te.blocked.noExcess)).toBeInTheDocument();

    await user.click(
      await within(listPane()).findByRole('button', { name: te.pickExcess('SAMPLE-IR-0001', 2) }),
    );

    expect(await within(detailPane()).findByText(te.blocked.noLine)).toBeInTheDocument();
    expect(within(detailPane()).getByRole('button', { name: te.actions.link })).toBeDisabled();

    await user.click(
      await within(detailPane()).findByRole('button', {
        name: te.pickLine('SAMPLE-PO-0001', 2),
      }),
    );

    expect(
      within(detailPane()).getByText(te.confirmLink(QTY, te.orderLine('SAMPLE-PO-0001', 2))),
    ).toBeInTheDocument();
    expect(within(detailPane()).getByRole('button', { name: te.actions.link })).toBeEnabled();
  });

  it('후보가 없으면 연결할 발주 라인이 없다고 말한다', async () => {
    renderTab([excessListRoute([excessFixture()]), candidatesRoute([])]);

    expect(await within(detailPane()).findByText(te.candidates.emptyTitle)).toBeInTheDocument();
  });

  it('「입하 등록」에서 건너온 전표의 초과분은 앞에 서고 「방금 등록」이 붙는다', async () => {
    renderTab(
      [
        excessListRoute([
          excessFixture({ inboundReceiptLineId: 9410, inboundReceiptNo: 'SAMPLE-IR-0000' }),
          excessFixture(),
        ]),
        candidatesRoute([candidateFixture()]),
      ],
      '?receipt=SAMPLE-IR-0001',
    );

    const rows = await within(listPane()).findAllByRole('row');
    const firstRow = rows[1] as HTMLElement;

    expect(within(firstRow).getByText('SAMPLE-IR-0001')).toBeInTheDocument();
    expect(within(firstRow).getByText(te.justRegistered)).toBeInTheDocument();
    /* 그 전표의 초과분이 하나뿐이라 골라 두고, 후보도 하나뿐이라 골라 둔다. */
    expect(
      await within(detailPane()).findByText(te.confirmLink(QTY, ORDER_LINE)),
    ).toBeInTheDocument();
  });

  it('고른 초과분의 원 발주는 이미 들어간 발주 라인이다', async () => {
    renderTab([excessListRoute([excessFixture()]), candidatesRoute([])]);

    expect(
      await within(detailPane()).findByText(te.orderLine('SAMPLE-PO-0099', 1)),
    ).toBeInTheDocument();
  });

  it('연결이 막히면(남은 초과분을 넘음) 서버 사유를 배너로 낸다', async () => {
    const user = renderTab([
      excessListRoute([excessFixture()]),
      candidatesRoute([candidateFixture()]),
      allocationWriteRoute([], [], () =>
        jsonResponse(
          {
            errors: [
              {
                scope: 'field',
                field: 'qty',
                code: 'RANGE',
                message: '받은 수량 중 배정하지 않은 몫을 넘습니다.',
              },
            ],
          },
          { status: 400 },
        ),
      ),
    ]);

    await within(detailPane()).findByText(te.confirmLink(QTY, ORDER_LINE));
    await user.click(within(detailPane()).getByRole('button', { name: te.actions.link }));

    expect(
      await within(detailPane()).findByText('받은 수량 중 배정하지 않은 몫을 넘습니다.'),
    ).toBeInTheDocument();
  });
});
