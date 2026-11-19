import { describe, expect, it } from 'vitest';

import { toShipmentDetail, toShipmentRow } from './types';

const shipment = {
  shipmentId: 1,
  shipmentNo: 'SYN-SH-1',
  shipmentRequestId: 30,
  warehouseId: null,
  statusCode: 'CONFIRMED',
  expedited: false,
  erpSendStatus: 'PENDING' as const,
  cancelRequestPending: false,
  completedTerminal: { terminalId: 1, terminalCode: 'SYN-POP' },
  completedWorker: { workerId: 2, workerNo: 'SYN-W', workerName: '합성 작업자' },
  warehouses: [
    { warehouseId: 11, warehouseCode: 'A', warehouseName: '창고 A' },
    { warehouseId: 12, warehouseCode: 'B', warehouseName: '창고 B' },
  ],
  lines: [
    {
      shipmentLineId: 5,
      lineNo: 1,
      shipmentRequestLineId: 40,
      itemId: 9,
      shippedQty: 70,
      uomId: 1,
      allocations: [
        {
          shipmentLotAllocationId: 1,
          shipmentId: 1,
          shipmentLineId: 5,
          itemId: 9,
          itemCode: 'SYN-ITEM',
          lotId: 100,
          lotNo: 'SYN-LOT',
          warehouseId: 11,
          allocatedQty: 20,
          uomId: 1,
          oqcPassed: true,
          packedQty: 0,
          managementCode: null,
        },
        {
          shipmentLotAllocationId: 2,
          shipmentId: 1,
          shipmentLineId: 5,
          itemId: 9,
          itemCode: 'SYN-ITEM',
          lotId: 100,
          lotNo: 'SYN-LOT',
          warehouseId: 12,
          allocatedQty: 50,
          uomId: 1,
          oqcPassed: true,
          packedQty: 0,
          managementCode: 'SYN-CODE',
        },
      ],
    },
  ],
};

describe('toShipmentRow', () => {
  it('Q9 완료 단말·작업자와 재고가 빠진 창고들을 옮긴다', () => {
    const row = toShipmentRow(shipment);

    expect(row.completedTerminalCode).toBe('SYN-POP');
    expect(row.completedWorker).toEqual({ workerNo: 'SYN-W', workerName: '합성 작업자' });
    expect(row.warehouses.map((w) => w.warehouseName)).toEqual(['창고 A', '창고 B']);
    expect(row.totalQty).toBe(70);
  });

  /* ⛔ 못 받은 것을 0 으로 지어내지 않는다 — 라인이 없으면 수량도 모른다. */
  it('라인이 없으면 수량 합은 null 이다', () => {
    const { lines: _lines, ...rest } = shipment;
    expect(toShipmentRow(rest).totalQty).toBeNull();
  });
});

describe('toShipmentDetail', () => {
  /* D-15 — 배분은 잔액 행마다다. 화면은 LOT 하나로 모으고 창고별 몫을 적는다. */
  it('Q18 잔액 행마다 나뉜 배분을 LOT 한 줄로 모으고 창고별 몫을 남긴다', () => {
    const [line] = toShipmentDetail(shipment, null).lines;

    expect(line?.lots).toHaveLength(1);
    expect(line?.lots[0]).toMatchObject({
      lotNo: 'SYN-LOT',
      qty: 70,
      managementCode: 'SYN-CODE',
      places: [
        { label: '창고 A', qty: 20 },
        { label: '창고 B', qty: 50 },
      ],
    });
    /* 지시서를 못 받으면 목표는 모른다. */
    expect(line?.targetQty).toBeNull();
  });
});
