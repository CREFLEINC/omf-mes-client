import { describe, expect, it } from 'vitest';

import { canConfirm, cancelLockOf, flowOf, warehouseDisplay } from './rules';
import type { ShipmentRow } from './types';

const row = (overrides: Partial<ShipmentRow> = {}): ShipmentRow => ({
  shipmentId: 1,
  shipmentNo: 'SYN-SH-1',
  shipmentRequestId: 30,
  shippedAt: null,
  statusCode: 'CONFIRMED',
  expedited: false,
  erpDeliveryNo: null,
  shipmentRequestNo: null,
  customerName: null,
  shipToName: null,
  salesOrderNo: null,
  erpSendStatus: 'PENDING',
  cancelRequestPending: false,
  completedTerminalCode: 'SYN-POP',
  completedWorker: null,
  warehouses: [],
  totalQty: null,
  ...overrides,
});

describe('flowOf', () => {
  it('Q9 POP 완료 출하는 「출하 완료」, 옛 흐름 확정분은 「확정」이다', () => {
    expect(flowOf(row())).toBe('completed');
    expect(flowOf(row({ completedTerminalCode: null }))).toBe('confirmed');
  });

  it('Q18 미확정은 옛 흐름과 긴급 직행으로 가른다', () => {
    expect(flowOf(row({ statusCode: 'UNCONFIRMED', completedTerminalCode: null }))).toBe(
      'legacyUnconfirmed',
    );
    expect(
      flowOf(row({ statusCode: 'UNCONFIRMED', completedTerminalCode: null, expedited: true })),
    ).toBe('expeditedUnconfirmed');
  });
});

describe('canConfirm', () => {
  it('Q22 [확정]은 미확정 출하에만 선다', () => {
    expect(canConfirm(row({ statusCode: 'UNCONFIRMED' }))).toBe(true);
    expect(canConfirm(row())).toBe(false);
  });
});

describe('cancelLockOf', () => {
  it('US6-1 ERP 로 보내기 전(대기)이면 취소를 요청할 수 있다', () => {
    expect(cancelLockOf(row())).toBeNull();
  });

  it('US7-4 수주 없는 출하(송신 안 함)도 취소를 요청할 수 있다', () => {
    expect(cancelLockOf(row({ erpSendStatus: 'NOT_SENT_NO_SALES_ORDER' }))).toBeNull();
  });

  it('US6-2 보낸 뒤에는 잠근다', () => {
    expect(cancelLockOf(row({ erpSendStatus: 'SENT' }))).toBe('sent');
  });

  it('Q14 취소 상신 중이면 다시 올리지 않는다', () => {
    expect(cancelLockOf(row({ cancelRequestPending: true }))).toBe('cancelPending');
  });

  it('FR-023·Q14 송신 오류는 잠그지 않는다 — ERP 에 반영된 행이 있으면 서버가 409 로 막는다', () => {
    /* 송신 오류는 아직 ERP 에 반영되지 않은 출하다 — 취소를 요청할 수 있다(2026-11-19 사용자 결정 · FR-023). */
    expect(cancelLockOf(row({ erpSendStatus: 'SEND_ERROR' }))).toBeNull();
  });

  it('옛 흐름 확정분은 지금처럼 취소할 수 없고, 미확정은 요청할 수 있다', () => {
    expect(cancelLockOf(row({ completedTerminalCode: null }))).toBe('confirmedLegacy');
    expect(
      cancelLockOf(row({ statusCode: 'UNCONFIRMED', completedTerminalCode: null })),
    ).toBeNull();
  });

  it('취소된 출하는 잠근다', () => {
    expect(cancelLockOf(row({ statusCode: 'CANCELLED', erpSendStatus: 'CANCELLED' }))).toBe(
      'cancelled',
    );
  });
});

const warehouse = (warehouseId: number, warehouseName: string) => ({
  warehouseId,
  warehouseName,
  warehouseCode: warehouseName,
  goodsIssueNos: [],
  qty: null,
  locations: [],
});

describe('warehouseDisplay', () => {
  it('Q18 하나면 이름, 여럿이면 「n곳」과 이름 목록', () => {
    expect(warehouseDisplay(row({ warehouses: [warehouse(1, 'A')] }))).toEqual({
      kind: 'one',
      name: 'A',
    });
    expect(
      warehouseDisplay(
        row({
          warehouses: [warehouse(1, 'A'), warehouse(2, 'B')],
        }),
      ),
    ).toEqual({ kind: 'many', count: 2, names: 'A, B' });
    expect(warehouseDisplay(row())).toEqual({ kind: 'none' });
  });
});
