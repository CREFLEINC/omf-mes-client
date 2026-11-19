import { describe, expect, it } from 'vitest';

import {
  defaultMatchOf,
  isJudgedOpen,
  isShipmentOqc,
  lotOverviewOf,
  overviewOfViews,
  pickedLotViewsOf,
  toShipmentResultBody,
  toShipmentResultUpdateBody,
} from './shipment-oqc';
import { shipmentOqcRequest, shipmentLot, shipmentResult } from './shipment-oqc-fixtures';

/**
 * 출하 OQC 새 흐름(피처 010 · W-04-03 · P-04-06) — 화면이 미리 셈하는 몫. 정본은 서버다.
 */
describe('출하 OQC 새 흐름 판별', () => {
  it('Q4 대상이 출하 지시서이고 LOT 이 없는 의뢰만 새 흐름이다', () => {
    expect(isShipmentOqc({ targetTypeCode: 'SHIPMENT_REQUEST', lotId: undefined })).toBe(true);
    expect(isShipmentOqc({ targetTypeCode: 'SHIPMENT_REQUEST', lotId: null })).toBe(true);
    expect(isShipmentOqc({ targetTypeCode: 'SHIPMENT_REQUEST', lotId: 5101 })).toBe(false);
    expect(isShipmentOqc({ targetTypeCode: 'LOT', lotId: undefined })).toBe(false);
  });
});

describe('피킹 LOT 판정 — LOT 마다 그 LOT 을 매칭한 마지막 결과', () => {
  it('US3-2 LOT1·2 합격, LOT3 불합격, LOT4 미검사', () => {
    const { active } = pickedLotViewsOf(shipmentOqcRequest());

    expect(active.map((view) => [view.lot.lotNo, view.judgmentCode, view.appliedSeqNo])).toEqual([
      ['P2611-0001', 'ACCEPTED', 1],
      ['P2611-0002', 'ACCEPTED', 1],
      ['P2611-0003', 'REJECTED', 2],
      ['P2611-0004', 'NOT_INSPECTED', null],
    ]);
  });

  it('US3-5 교체된 LOT 은 판정 대상에서 빠지고 이력으로만 남는다', () => {
    const request = shipmentOqcRequest({
      lots: [
        shipmentLot(7001, 'P2611-0001', 40),
        shipmentLot(7003, 'P2611-0003', 30, 'REPLACED'),
        shipmentLot(7004, 'P2611-0004', 30),
      ],
    });
    const { active, replaced } = pickedLotViewsOf(request);

    expect(active.map((view) => view.lot.lotNo)).toEqual(['P2611-0001', 'P2611-0004']);
    expect(replaced.map((lot) => lot.lotNo)).toEqual(['P2611-0003']);
  });

  it('Q16 생략으로 닫힌 의뢰의 LOT 은 생략(통과)이다', () => {
    const request = shipmentOqcRequest({
      statusCode: 'SKIPPED',
      results: [],
      lotJudgments: [],
    });

    expect(pickedLotViewsOf(request).active.every((view) => view.judgmentCode === 'SKIPPED')).toBe(
      true,
    );
    expect(overviewOfViews(request.statusCode, pickedLotViewsOf(request).active)).toEqual({
      kind: 'skipped',
    });
  });

  it('새 결과를 열면 미검사 LOT 만 미리 고른다', () => {
    expect(defaultMatchOf(pickedLotViewsOf(shipmentOqcRequest()).active)).toEqual([7004]);
  });
});

describe('LOT 판정 요약 — 목록 칩', () => {
  it('Q4 불합격이 있으면 「불합격 n」이 먼저다', () => {
    expect(
      lotOverviewOf({
        statusCode: 'IN_PROGRESS',
        pickedLotCount: 3,
        lotJudgmentSummary: { notInspected: 1, accepted: 1, rejected: 1, held: 0 },
      }),
    ).toEqual({ kind: 'rejected', count: 1 });
  });

  it('미검사 · 모두 합격 · 피킹 LOT 없음 · 생략', () => {
    expect(
      lotOverviewOf({
        statusCode: 'IN_PROGRESS',
        pickedLotCount: 3,
        lotJudgmentSummary: { notInspected: 1, accepted: 2, rejected: 0, held: 0 },
      }),
    ).toEqual({ kind: 'notInspected', count: 1 });
    expect(
      lotOverviewOf({
        statusCode: 'IN_PROGRESS',
        pickedLotCount: 2,
        lotJudgmentSummary: { notInspected: 0, accepted: 2, rejected: 0, held: 0 },
      }),
    ).toEqual({ kind: 'allAccepted' });
    expect(
      lotOverviewOf({
        statusCode: 'REQUESTED',
        pickedLotCount: 0,
        lotJudgmentSummary: { notInspected: 0, accepted: 0, rejected: 0, held: 0 },
      }),
    ).toEqual({ kind: 'none' });
    expect(lotOverviewOf({ statusCode: 'SKIPPED', pickedLotCount: 1 })).toEqual({
      kind: 'skipped',
    });
  });

  it('옛 흐름 줄(요약 없음)은 칩이 없다', () => {
    expect(lotOverviewOf({ statusCode: 'REQUESTED' })).toBeNull();
  });

  it('POP 판정 완료 탭 — 열린 의뢰의 피킹 LOT 이 모두 판정을 가지면 판정 완료다', () => {
    const summary = { notInspected: 0, accepted: 2, rejected: 1, held: 0 };
    expect(
      isJudgedOpen({ statusCode: 'IN_PROGRESS', pickedLotCount: 3, lotJudgmentSummary: summary }),
    ).toBe(true);
    expect(
      isJudgedOpen({
        statusCode: 'IN_PROGRESS',
        pickedLotCount: 3,
        lotJudgmentSummary: { ...summary, notInspected: 1 },
      }),
    ).toBe(false);
    expect(
      isJudgedOpen({
        statusCode: 'REQUESTED',
        pickedLotCount: 0,
        lotJudgmentSummary: { notInspected: 0, accepted: 0, rejected: 0, held: 0 },
      }),
    ).toBe(false);
  });
});

describe('결과 저장 몸통', () => {
  it('US3-4 판정 · 매칭만 싣고 작성중으로 보낸다(수량은 서버가 채운다)', () => {
    const body = toShipmentResultBody({
      inspectionRequestId: 4201,
      uomId: 10,
      judgmentCode: 'ACCEPTED',
      matchedLotIds: [7004],
      reinspectionReasonCode: null,
      inspectedAt: '2026-11-18T03:00:00.000Z',
      serials: [],
    });

    expect(body).toEqual({
      inspectionRequestId: 4201,
      inspectedQty: 0,
      acceptedQty: 0,
      rejectedQty: 0,
      heldQty: 0,
      uomId: 10,
      overallJudgmentCode: 'ACCEPTED',
      inspectedAt: '2026-11-18T03:00:00.000Z',
      statusCode: 'DRAFT',
      matchedLotIds: [7004],
    });
  });

  it('US3-3 재검 사유 · 시리얼은 있을 때만 싣는다', () => {
    const body = toShipmentResultBody({
      inspectionRequestId: 4201,
      uomId: 10,
      judgmentCode: 'ACCEPTED',
      matchedLotIds: [7003],
      reinspectionReasonCode: 'RECHECK',
      inspectedAt: '2026-11-18T03:00:00.000Z',
      serials: [{ serialNumberId: 1, judgmentCode: 'OK' }],
    });

    expect(body.reinspectionReasonCode).toBe('RECHECK');
    expect(body.serials).toEqual([{ serialNumberId: 1, judgmentCode: 'OK' }]);
  });

  it('FR-009·T052 검사 항목 측정치를 싣는다 — 더할 때는 있을 때만, 고칠 때는 실으면 통째로 바꾼다(빈 배열 포함)', () => {
    const measured = [
      {
        inspectionItemSpecId: 31,
        sampleNo: 1,
        judgmentCode: 'ACCEPTED',
        measuredAt: '2026-11-18T03:00:00.000Z',
        numericValue: 1.5,
      },
    ];
    const created = toShipmentResultBody({
      inspectionRequestId: 4201,
      uomId: 10,
      judgmentCode: 'ACCEPTED',
      matchedLotIds: [7004],
      reinspectionReasonCode: null,
      inspectedAt: '2026-11-18T03:00:00.000Z',
      serials: [],
      measurements: measured,
    });
    expect(created.measurements).toEqual(measured);
    expect(
      toShipmentResultBody({
        inspectionRequestId: 4201,
        uomId: 10,
        judgmentCode: 'ACCEPTED',
        matchedLotIds: [7004],
        reinspectionReasonCode: null,
        inspectedAt: '2026-11-18T03:00:00.000Z',
        serials: [],
        measurements: [],
      }),
    ).not.toHaveProperty('measurements');
    expect(
      toShipmentResultUpdateBody({
        judgmentCode: 'ACCEPTED',
        matchedLotIds: [7004],
        reinspectionReasonCode: null,
        measurements: [],
      }),
    ).toEqual({ overallJudgmentCode: 'ACCEPTED', matchedLotIds: [7004], measurements: [] });
  });

  it('고침은 매칭 · 판정 · 사유만 보낸다', () => {
    expect(
      toShipmentResultUpdateBody({
        judgmentCode: 'REJECTED',
        matchedLotIds: [7001, 7002],
        reinspectionReasonCode: null,
      }),
    ).toEqual({ overallJudgmentCode: 'REJECTED', matchedLotIds: [7001, 7002] });
    expect(shipmentResult(1, 'ACCEPTED', [7001]).statusCode).toBe('DRAFT');
  });
});
