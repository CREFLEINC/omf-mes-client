import { describe, expect, it } from 'vitest';

import {
  completionMarkOf,
  localToday,
  remainingBlockers,
  tallyBlockers,
  toLineQtyTotals,
  toShipmentRequestView,
  type BlockerCode,
} from './types';

const LINE = {
  shipmentRequestLineId: 1,
  lineNo: 1,
  itemId: 9301,
  itemCode: 'SAMPLE-ITEM-01',
  itemName: '합성 품목',
  requestedQty: 100,
  allocatedQty: 80,
  pickedQty: 40,
  shippedQty: 20,
  uomId: 9501,
  uomCode: 'SAMPLE-EA',
  salesOrderLine: null,
  shippingInspectionRequired: false,
  /* client#601 1-5 — 집은 LOT 신설. 이 시험은 아직 이 값을 읽지 않는다. */
  picks: [],
  /* 피처 010 — 초과·피킹 LOT 행. 이 시험은 아직 이 값을 읽지 않는다. */
  overQty: 0,
  lots: [],
  warehouse: null,
};

const RESPONSE = {
  shipmentRequestId: 1001,
  shipmentRequestNo: 'SR-2026-0001',
  salesOrderNo: null,
  customerId: 9101,
  shipToPartnerId: 9201,
  customer: null,
  shipTo: null,
  requestedShipDate: '2026-08-13',
  statusCode: 'SAMPLE_STATUS_A',
  shipmentProgressCode: 'PARTIALLY_SHIPPED' as const,
  shippingInspectionStatusCode: 'NOT_REQUIRED' as const,
  lines: [LINE],
  /* 피처 010 — 지시서 코드·피킹 창고·교체·막힘·판정 요약·완료 출하. 이 시험은 아직 읽지 않는다. */
  code: 'SHPREQ:SYN',
  pickingWarehouses: [],
  replacementCount: 0,
  completionBlockers: [],
  blockerSummary: {},
  lotJudgmentSummary: { notInspected: 0, accepted: 0, rejected: 0, held: 0 },
  completedShipment: null,
  /* 피처 012 — 사업부·줄 창고 요약·ERP 송신·출하. */
  businessUnitId: null,
  businessUnit: null,
  warehouses: [],
  erpSendStatus: null,
  shipments: [],
};

describe('toLineQtyTotals', () => {
  it('여러 라인의 세 수량을 각각 더한다', () => {
    expect(
      toLineQtyTotals([
        LINE,
        { ...LINE, shipmentRequestLineId: 2, requestedQty: 50, allocatedQty: 50, shippedQty: 0 },
      ]),
    ).toEqual({ requestedQty: 150, allocatedQty: 130, pickedQty: 80, shippedQty: 20 });
  });

  /*
   * ⛔ **받지 못한 축을 0 으로 지어내지 않는다.** 계약은 이 칸을 필수로 적지만 서버가 비워
   * 보낸 적이 있고, 그대로 더하면 합계가 `NaN` 이 되어 화면에 나갔다(client#1042 · 88단계 66번).
   */
  it('한 줄이라도 수량 칸이 비면 그 축만 「모른다」가 된다', () => {
    const missing = { ...LINE, shipmentRequestLineId: 2, requestedQty: undefined } as never;

    expect(toLineQtyTotals([LINE, missing])).toEqual({
      requestedQty: null,
      allocatedQty: 160,
      pickedQty: 80,
      shippedQty: 40,
    });
  });

  it('숫자가 아닌 값이 와도 합계를 NaN 으로 내지 않는다', () => {
    const broken = { ...LINE, shipmentRequestLineId: 2, shippedQty: null } as never;

    expect(toLineQtyTotals([broken])?.shippedQty).toBeNull();
  });

  /* 0/0/0을 내지 않는다 — 「수량이 0」과 「받지 못했다」가 같은 모양이 되면 안 된다. */
  it('lines가 없으면 null이다', () => {
    expect(toLineQtyTotals(undefined)).toBeNull();
  });

  it('lines가 빈 배열이어도 null이다', () => {
    expect(toLineQtyTotals([])).toBeNull();
  });

  it('수량 0인 라인은 합계에 그대로 반영된다', () => {
    expect(toLineQtyTotals([{ ...LINE, requestedQty: 0, allocatedQty: 0, shippedQty: 0 }])).toEqual(
      {
        requestedQty: 0,
        allocatedQty: 0,
        pickedQty: 40,
        shippedQty: 0,
      },
    );
  });
});

describe('toShipmentRequestView', () => {
  it('필수 필드를 그대로 옮기고 라인 합계를 계산한다', () => {
    expect(toShipmentRequestView(RESPONSE)).toEqual({
      shipmentRequestId: 1001,
      shipmentRequestNo: 'SR-2026-0001',
      customerId: 9101,
      shipToPartnerId: 9201,
      requestedShipDate: '2026-08-13',
      shipmentProgressCode: 'PARTIALLY_SHIPPED',
      inspectionStatus: 'NOT_REQUIRED',
      lineTotals: { requestedQty: 100, allocatedQty: 80, pickedQty: 40, shippedQty: 20 },
      overQty: 0,
      lotJudgmentSummary: { notInspected: 0, accepted: 0, rejected: 0, held: 0 },
      blockers: { issueCount: 0, inProgressCount: 0, pickingShort: false, completed: false },
      pickingWarehouseNames: [],
      replacementCount: 0,
      businessUnitName: null,
      lineWarehouses: [],
      erpSendStatus: null,
    });
  });

  it('검사 상태 값을 서버가 낸 그대로 옮긴다 — 화면이 라인을 다시 순회해 판정하지 않는다', () => {
    expect(
      toShipmentRequestView({ ...RESPONSE, shippingInspectionStatusCode: 'REJECTED' })
        .inspectionStatus,
    ).toBe('REJECTED');
  });

  it('출하 진행 상태를 서버가 낸 그대로 옮긴다 — 화면이 라인 수량으로 재계산하지 않는다', () => {
    expect(
      toShipmentRequestView({ ...RESPONSE, shipmentProgressCode: 'NOT_ALLOCATED' })
        .shipmentProgressCode,
    ).toBe('NOT_ALLOCATED');
  });

  it('lines가 없어도 검사 상태는 응답 값 그대로다 — 합계만 null이 된다', () => {
    expect(toShipmentRequestView({ ...RESPONSE, lines: [] })).toMatchObject({
      inspectionStatus: 'NOT_REQUIRED',
      lineTotals: null,
    });
  });
});

const codes = (...list: BlockerCode[]) => list.map((code) => ({ code }));

describe('#342 막는 이유 갈래', () => {
  it('#342 불합격 · 보류 · 수주 라인 취소만 이슈로 세고, 피킹 부족 · 미검사는 정상 진행, 출하 완료는 상태다', () => {
    expect(
      tallyBlockers(
        codes('REJECTED', 'HELD', 'SALES_ORDER_LINE_CANCELLED', 'PICKING_SHORT', 'NOT_INSPECTED'),
      ),
    ).toEqual({ issueCount: 3, inProgressCount: 2, pickingShort: true, completed: false });
    expect(tallyBlockers(codes('ALREADY_COMPLETED'))).toEqual({
      issueCount: 0,
      inProgressCount: 0,
      pickingShort: false,
      completed: true,
    });
  });

  it('#342 상세 띠는 이슈를 먼저 두고 「이미 출하 완료」는 뺀다', () => {
    expect(
      remainingBlockers(
        codes('PICKING_SHORT', 'HELD', 'NOT_INSPECTED', 'ALREADY_COMPLETED', 'REJECTED'),
      ).map((blocker) => blocker.code),
    ).toEqual(['HELD', 'REJECTED', 'PICKING_SHORT', 'NOT_INSPECTED']);
  });

  it('#342 오늘은 기기 로컬 날짜의 YYYY-MM-DD 다', () => {
    expect(localToday(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05');
  });
});

describe('#342 completionMarkOf', () => {
  const TODAY = '2026-11-20';
  const row = (
    blockerCodes: BlockerCode[] | null,
    requestedShipDate = '2026-11-20',
    shipmentProgressCode: Parameters<typeof completionMarkOf>[0]['shipmentProgressCode'] = 'PICKED',
  ) => ({
    blockers: blockerCodes === null ? null : tallyBlockers(codes(...blockerCodes)),
    requestedShipDate,
    shipmentProgressCode,
  });

  it('#342 확인 1 — 피킹 부족 · 미검사만이고 출하일이 오늘 이후면 칩이 없다', () => {
    expect(completionMarkOf(row(['PICKING_SHORT', 'NOT_INSPECTED']), TODAY)).toBeNull();
    expect(completionMarkOf(row(['NOT_INSPECTED'], '2026-11-01'), TODAY)).toBeNull();
  });

  it('#342 확인 2 — 출하일이 지난 피킹 부족은 「지연」(오늘 출하일은 아직 지연 아님)', () => {
    expect(completionMarkOf(row(['PICKING_SHORT'], '2026-11-19'), TODAY)).toEqual({
      kind: 'delayed',
    });
    expect(completionMarkOf(row(['PICKING_SHORT'], '2026-11-20'), TODAY)).toBeNull();
  });

  it('#342 확인 3 — 진짜 이슈가 있으면 이슈 수만 센 「막힘 n」이 「지연」보다 앞선다', () => {
    expect(
      completionMarkOf(
        row(['REJECTED', 'HELD', 'PICKING_SHORT', 'NOT_INSPECTED'], '2026-11-01'),
        TODAY,
      ),
    ).toEqual({ kind: 'blocked', count: 2 });
  });

  it('#342 확인 4 — 막는 이유가 없으면 「완료 대기」, 출하 완료 · 미편성 · 옛 서버는 칩 없음', () => {
    expect(completionMarkOf(row([]), TODAY)).toEqual({ kind: 'ready' });
    expect(completionMarkOf(row(['ALREADY_COMPLETED']), TODAY)).toBeNull();
    expect(completionMarkOf(row([], TODAY, 'SHIPPED'), TODAY)).toBeNull();
    expect(
      completionMarkOf(row(['PICKING_SHORT'], '2026-11-01', 'NOT_ALLOCATED'), TODAY),
    ).toBeNull();
    expect(completionMarkOf(row(null), TODAY)).toBeNull();
  });
});
