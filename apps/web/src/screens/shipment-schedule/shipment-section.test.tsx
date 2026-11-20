import { messages } from '@omf-mes/i18n';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import {
  createStubFetch,
  jsonResponse,
  renderWithProviders,
  type StubRoute,
} from '../../test/api-harness';
import type { ShipmentRequestDetail } from './request-detail';
import { ShipmentSection } from './shipment-section';

const tc = messages.shipmentConfirm;
const t = messages.shipmentSchedule.bu012;

/*
 * 「출하」 칸(피처 012 FR-019·020·022 · 시안 W0402-After ④) — 출하 내역(W-04-12)에서 옮긴 일.
 * 합성값이다 — 계약 예시값을 쓰지 않는다.
 */

const WH_A = { warehouseId: 2001, warehouseCode: 'SYN-WH-A', warehouseName: '합성 창고 A', plantId: 11, plantName: '합성 1공장' };
const WH_B = { warehouseId: 2002, warehouseCode: 'SYN-WH-B', warehouseName: '합성 창고 B', plantId: 12, plantName: '합성 2공장' };

const requestLine = (lineNo: number, warehouse: typeof WH_A) => ({
  shipmentRequestLineId: 4000 + lineNo,
  lineNo,
  itemId: 5001,
  itemCode: 'SYN-FG-A100',
  itemName: '합성 센서',
  uomCode: 'EA',
  salesOrderLine: null,
  requestedQty: 60,
  allocatedQty: 60,
  pickedQty: 60,
  shippedQty: 60,
  uomId: 7001,
  shippingInspectionRequired: true,
  picks: [],
  overQty: 0,
  lots: [],
  warehouse,
});

const request = (shipments: { shipmentId: number; shipmentNo: string; statusCode: string }[]) =>
  ({
    shipmentRequestId: 3001,
    shipmentRequestNo: 'SYN-SR-3001',
    lines: [requestLine(1, WH_A), requestLine(2, WH_B)],
    shipments: shipments.map((each) => ({
      ...each,
      erpSendStatus: 'PENDING',
      cancelRequestPending: false,
    })),
  }) as unknown as ShipmentRequestDetail;

interface ShipmentStub {
  shipmentId: number;
  shipmentNo: string;
  statusCode: string;
  erpSendStatus: string | null;
  cancelRequestPending?: boolean;
  expedited?: boolean;
  completedByPop?: boolean;
}

const shipmentBody = (stub: ShipmentStub) => ({
  shipmentId: stub.shipmentId,
  shipmentNo: stub.shipmentNo,
  shipmentRequestId: 3001,
  shipmentRequestNo: 'SYN-SR-3001',
  salesOrderNo: 'SYN-SO-01',
  warehouseId: null,
  statusCode: stub.statusCode,
  expedited: stub.expedited ?? false,
  shippedAt: '2026-11-20T07:05:00Z',
  erpSendStatus: stub.erpSendStatus,
  cancelRequestPending: stub.cancelRequestPending ?? false,
  completedTerminal:
    stub.completedByPop === false ? null : { terminalId: 61, terminalCode: 'SYN-POP-02' },
  completedWorker:
    stub.completedByPop === false
      ? null
      : { workerId: 71, workerNo: 'SYN-W-0102', workerName: '합성 작업자' },
  warehouses: [
    { warehouseId: 2001, warehouseCode: 'SYN-WH-A', warehouseName: '합성 창고 A', goodsIssueNos: ['SYN-GI-0011'], qty: 110, locations: [] },
    { warehouseId: 2002, warehouseCode: 'SYN-WH-B', warehouseName: '합성 창고 B', goodsIssueNos: ['SYN-GI-0012'], qty: 40, locations: [] },
  ],
  lines: [
    {
      shipmentLineId: 1,
      lineNo: 1,
      shipmentRequestLineId: 4001,
      itemId: 5001,
      shippedQty: 110,
      uomId: 7001,
      allocations: [
        {
          shipmentLotAllocationId: 1,
          shipmentId: stub.shipmentId,
          shipmentLineId: 1,
          itemId: 5001,
          itemCode: 'SYN-FG-A100',
          lotId: 9001,
          lotNo: 'SYN-LOT-0001',
          warehouseId: 2001,
          allocatedQty: 110,
          uomId: 7001,
          oqcPassed: true,
          packedQty: 0,
          managementCode: 'SYN-PLT-0007',
        },
      ],
    },
  ],
});

const routes = (
  stubs: ShipmentStub[],
  options: { approval?: string; seen?: Request[] } = {},
): StubRoute[] => [
  {
    match: (req) => req.method === 'GET' && /^\/logistics\/shipments\/\d+$/u.test(new URL(req.url).pathname),
    respond: (req) => {
      const id = Number(new URL(req.url).pathname.split('/').at(-1));
      const stub = stubs.find((each) => each.shipmentId === id);
      return stub === undefined
        ? jsonResponse({ message: '없음' }, { status: 404 })
        : jsonResponse(shipmentBody(stub), { headers: { ETag: `"v${String(id)}"` } });
    },
  },
  {
    match: (req) => req.method === 'GET' && new URL(req.url).pathname === '/logistics/shipment-requests/3001',
    respond: () => jsonResponse(request([])),
  },
  {
    match: (req) => req.method === 'GET' && new URL(req.url).pathname === '/app/approval-requests',
    respond: () =>
      jsonResponse({
        items:
          options.approval === undefined
            ? []
            : [{ approvalRequestId: 9001, statusCode: options.approval }],
        page: { page: 1, size: 20, total: options.approval === undefined ? 0 : 1 },
      }),
  },
  {
    match: (req) => req.method === 'POST',
    respond: (req) => {
      options.seen?.push(req.clone());
      return jsonResponse({ approvalRequestId: 9001 });
    },
  },
];

const mount = (
  stubs: ShipmentStub[],
  options: { approval?: string; seen?: Request[]; canAct?: boolean } = {},
) =>
  renderWithProviders(
    <ShipmentSection
      request={request(stubs.map(({ shipmentId, shipmentNo, statusCode }) => ({ shipmentId, shipmentNo, statusCode })))}
      canAct={options.canAct ?? true}
    />,
    { fetch: createStubFetch(routes(stubs, options)) },
  );

const card = (shipmentNo: string) => screen.findByRole('article', { name: shipmentNo });

describe('ShipmentSection — 「출하」 칸(피처 012)', () => {
  it('US4-2·Q13 출하 번호 · 완료 시각 · POP · 작업자 · 창고별 차감(출고 전표 · 공장) · LOT 배분(출하 관리 코드) · ERP 송신 상태', async () => {
    mount([{ shipmentId: 7701, shipmentNo: 'SYN-SH-0001', statusCode: 'COMPLETED', erpSendStatus: 'PENDING' }]);

    const shipment = await card('SYN-SH-0001');

    expect(within(shipment).getByText('SYN-POP-02')).toBeInTheDocument();
    expect(within(shipment).getByText('합성 작업자 (SYN-W-0102)')).toBeInTheDocument();
    expect(within(shipment).getByText(`${t.erpSend} ${tc.erp.PENDING}`)).toBeInTheDocument();

    const issues = within(shipment).getByRole('region', { name: t.goodsIssues });
    const rowA = within(issues).getByText('SYN-GI-0011').closest('tr') as HTMLElement;
    expect(rowA).toHaveTextContent('합성 창고 A');
    expect(rowA).toHaveTextContent('합성 1공장');
    expect(rowA).toHaveTextContent('110');
    expect(within(issues).getByText('SYN-GI-0012').closest('tr')).toHaveTextContent('합성 2공장');

    const lots = within(shipment).getByRole('region', { name: t.lots });
    expect(within(lots).getByText('SYN-LOT-0001').closest('tr')).toHaveTextContent('SYN-PLT-0007');
  });

  it('US4-3·Q13 송신 전 출하는 [취소 요청] → 사유 → 상신, 보낸 출하에는 [취소 요청]이 없다', async () => {
    const user = userEvent.setup();
    const seen: Request[] = [];
    mount(
      [
        { shipmentId: 7701, shipmentNo: 'SYN-SH-0001', statusCode: 'COMPLETED', erpSendStatus: 'PENDING' },
        { shipmentId: 7600, shipmentNo: 'SYN-SH-0000', statusCode: 'COMPLETED', erpSendStatus: 'SENT' },
      ],
      { seen },
    );

    const pending = await card('SYN-SH-0001');
    const sent = await card('SYN-SH-0000');

    await waitFor(() => {
      expect(within(sent).getByText(tc.lock.sent)).toBeInTheDocument();
    });
    expect(within(sent).queryByRole('button', { name: tc.actions.requestCancel })).toBeNull();

    await user.click(within(pending).getByRole('button', { name: tc.actions.requestCancel }));
    const dialog = await screen.findByRole('dialog', { name: tc.cancelDialog.title });
    await user.type(within(dialog).getByLabelText(new RegExp(tc.cancelDialog.reasonLabel, 'u')), '납품처 변경');
    await user.click(within(dialog).getByRole('button', { name: tc.cancelDialog.submit }));

    await waitFor(() => {
      expect(seen.some((req) => new URL(req.url).pathname.endsWith('/7701:request-cancel'))).toBe(true);
    });
  });

  it('US4-5·Q13 승인된 취소면 [취소 실행]이 선다', async () => {
    mount(
      [{ shipmentId: 7701, shipmentNo: 'SYN-SH-0001', statusCode: 'COMPLETED', erpSendStatus: 'PENDING' }],
      { approval: 'APPROVED' },
    );

    const shipment = await card('SYN-SH-0001');

    expect(await within(shipment).findByRole('button', { name: tc.actions.executeCancel })).toBeInTheDocument();
    expect(within(shipment).getByText(tc.lock.cancelApproved)).toBeInTheDocument();
  });

  it('US4-5 취소된 출하는 기록으로 남고 최신 출하가 위에 쌓인다', async () => {
    mount([
      { shipmentId: 7600, shipmentNo: 'SYN-SH-0000', statusCode: 'CANCELLED', erpSendStatus: 'CANCELLED' },
      { shipmentId: 7701, shipmentNo: 'SYN-SH-0001', statusCode: 'COMPLETED', erpSendStatus: 'PENDING' },
    ]);

    await card('SYN-SH-0000');
    const cards = screen.getAllByRole('article');
    expect(cards.map((each) => each.getAttribute('aria-label'))).toEqual(['SYN-SH-0001', 'SYN-SH-0000']);
    expect(within(cards[1] as HTMLElement).getByText(tc.flow.cancelled)).toBeInTheDocument();
  });

  it('US5-1·Q14 미확정 출하(옛 흐름)에 [확정] · [취소 요청], 확인 창 문구는 W-04-12 와 같다', async () => {
    const user = userEvent.setup();
    const seen: Request[] = [];
    mount(
      [{ shipmentId: 7702, shipmentNo: 'SYN-SH-0002', statusCode: 'UNCONFIRMED', erpSendStatus: 'NOT_QUEUED', completedByPop: false }],
      { seen },
    );

    const shipment = await card('SYN-SH-0002');

    expect(within(shipment).getByText(tc.detail.legacyBanner)).toBeInTheDocument();
    expect(within(shipment).getByRole('button', { name: tc.actions.requestCancel })).toBeEnabled();

    await user.click(within(shipment).getByRole('button', { name: tc.actions.confirm }));
    const dialog = await screen.findByRole('dialog', { name: tc.confirmDialog.title });
    expect(within(dialog).getByText(tc.confirmDialog.irreversible)).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: tc.confirmDialog.confirm }));

    await waitFor(() => {
      expect(seen.some((req) => new URL(req.url).pathname.endsWith('/7702:confirm'))).toBe(true);
    });
  });

  it('US5-1 취소 결재 중이면 [확정]이 잠긴다', async () => {
    mount([
      {
        shipmentId: 7702,
        shipmentNo: 'SYN-SH-0002',
        statusCode: 'UNCONFIRMED',
        erpSendStatus: 'NOT_QUEUED',
        completedByPop: false,
        cancelRequestPending: true,
      },
    ]);

    const shipment = await card('SYN-SH-0002');

    expect(within(shipment).getByRole('button', { name: tc.actions.confirm })).toBeDisabled();
    expect(within(shipment).getByText(tc.detail.cancelPendingBanner)).toBeInTheDocument();
  });

  it('R-6 「출하 취소(송신 전)」(W-04-12) 권한이 없으면 [취소 요청] · [취소 실행] · [확정]이 보이지 않는다', async () => {
    mount(
      [{ shipmentId: 7701, shipmentNo: 'SYN-SH-0001', statusCode: 'COMPLETED', erpSendStatus: 'PENDING' }],
      { canAct: false, approval: 'APPROVED' },
    );

    const shipment = await card('SYN-SH-0001');

    expect(within(shipment).getByText(t.noPermission)).toBeInTheDocument();
    expect(within(shipment).queryByRole('button')).toBeNull();
  });
});
