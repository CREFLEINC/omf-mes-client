import type { components } from '@omf-mes/api-client';

import type { InspectionRequestResponse } from './types';

type Lot = components['schemas']['InspectionRequestLot'];
type ResultSummary = components['schemas']['InspectionRequestResultSummary'];
type LotJudgment = components['schemas']['InspectionRequestLotJudgment'];
type ShipmentRequest = components['schemas']['ShipmentRequest'];

/**
 * 출하 OQC 새 흐름(피처 010) 시험 자료 — ⛔ 전부 지어낸 값이다(공개 저장소). 시안 W0403 · P0406 의 가상 자료와 같은 모양:
 * 지시서 SR-261118-001 × 품목, 목표 100, 피킹 0001 40 · 0002 40 · 0003 30 · 0004 30.
 */
export const shipmentLot = (
  lotId: number,
  lotNo: string,
  lotQty: number,
  pickStatusCode: 'PICKED' | 'REPLACED' | 'SHIPPED' = 'PICKED',
): Lot => ({
  lotId,
  lotNo,
  lotQty,
  package: null,
  statusCode: pickStatusCode === 'REPLACED' ? 'DEFECTIVE' : 'NORMAL',
  goodsReceived: false,
  shipmentRequestLotId: lotId + 1000,
  pickStatusCode,
  managementCode: null,
});

export const shipmentResult = (
  seqNo: number,
  judgment: string,
  matchedLotIds: number[],
  extra: Partial<ResultSummary> = {},
): ResultSummary => ({
  inspectionResultId: 9200 + seqNo,
  inspectionResultNo: `IRS-OQC-02${String(seqNo).padStart(2, '0')}`,
  seqNo,
  confirmCycle: null,
  statusCode: 'DRAFT',
  overallJudgmentCode: judgment,
  inspectedQty: 0,
  acceptedQty: 0,
  rejectedQty: 0,
  heldQty: 0,
  defectNames: [],
  inspectedAt: '2026-11-18T01:12:00.000Z',
  inspectorName: '검사자A',
  matchedLotIds,
  matchedLotNos: matchedLotIds.map((id) => `LOT-${String(id)}`),
  reinspectionReasonCode: null,
  reinspectionReasonName: null,
  versionNo: 1,
  ...extra,
});

const judgmentOf = (lot: Lot, result: ResultSummary | null): LotJudgment => ({
  lotId: lot.lotId,
  lotNo: lot.lotNo,
  judgmentCode: result?.overallJudgmentCode ?? null,
  resultId: result?.inspectionResultId ?? null,
  resultSeqNo: result?.seqNo ?? null,
  superseded: [],
  reinspectionReasonCode: null,
  reinspectionReasonName: null,
});

const defaultLots = (): Lot[] => [
  shipmentLot(7001, 'P2611-0001', 40),
  shipmentLot(7002, 'P2611-0002', 40),
  shipmentLot(7003, 'P2611-0003', 30),
  shipmentLot(7004, 'P2611-0004', 30),
];

const defaultResults = (): ResultSummary[] => [
  shipmentResult(1, 'ACCEPTED', [7001, 7002]),
  shipmentResult(2, 'REJECTED', [7003]),
];

/** 서버처럼 LOT 마다 그 LOT 을 매칭한 마지막(순번 최대) 결과로 판정을 채운다. */
export const lotJudgmentsFor = (lots: Lot[], results: ResultSummary[]): LotJudgment[] =>
  lots
    .filter((lot) => lot.pickStatusCode !== 'REPLACED')
    .map((lot) =>
      judgmentOf(
        lot,
        results
          .filter((result) => result.matchedLotIds.includes(lot.lotId))
          .reduce<ResultSummary | null>(
            (last, result) => (last === null || result.seqNo > last.seqNo ? result : last),
            null,
          ),
      ),
    );

export const shipmentOqcRequest = (
  overrides: Partial<InspectionRequestResponse> = {},
): InspectionRequestResponse => {
  const lots = overrides.lots ?? defaultLots();
  const results = overrides.results ?? defaultResults();

  return {
    inspectionRequestId: 4201,
    inspectionRequestNo: 'IR-OQC-0201',
    inspectionTypeCode: 'OQC',
    inspectionPlanVersionId: 3101,
    targetTypeCode: 'SHIPMENT_REQUEST',
    targetId: 6201,
    itemId: 2101,
    targetQty: 100,
    uomId: 10,
    statusCode: 'IN_PROGRESS',
    requestedAt: '2026-11-18T00:05:00.000Z',
    versionNo: 2,
    shipmentRequestNo: 'SR-261118-001',
    pickedLotCount: lots.filter((lot) => lot.pickStatusCode !== 'REPLACED').length,
    lotJudgmentSummary: { notInspected: 1, accepted: 2, rejected: 1, held: 0 },
    lots,
    results,
    lotJudgments: lotJudgmentsFor(lots, results),
    nextResultSeqNo: results.reduce((max, result) => Math.max(max, result.seqNo), 0) + 1,
    ...overrides,
  };
};

/** 거래처 이름 — 고객 501 · 납품처 502. */
export const partnerNames: Readonly<Record<number, string>> = { 501: '고객사A', 502: '납품처A' };

/** 지시서 상세 — 고객 · 납품처 · 라인 목표 · 피킹 LOT 의 창고 몫 · 교체 근거(필요한 칸만). */
export const shipmentRequestForOqc = (): ShipmentRequest =>
  ({
    shipmentRequestId: 6201,
    shipmentRequestNo: 'SR-261118-001',
    customerId: 501,
    shipToPartnerId: 502,
    lines: [
      {
        shipmentRequestLineId: 6301,
        lineNo: 1,
        itemId: 2101,
        requestedQty: 100,
        allocatedQty: 100,
        pickedQty: 140,
        shippedQty: 0,
        picks: [],
        lots: [
          {
            shipmentRequestLotId: 8001,
            lotId: 7001,
            lotNo: 'P2611-0001',
            itemId: 2101,
            pickedQty: 40,
            uomId: 10,
            statusCode: 'PICKED',
            managementCode: null,
            pickedAt: '2026-11-18T00:30:00.000Z',
            pickedWorker: { workerId: 1, workerNo: '100001', workerName: '작업자A' },
            shipmentId: null,
            portions: [
              {
                warehouseId: 11,
                warehouseCode: 'WH-A',
                warehouseName: '창고A',
                locationId: 21,
                locationCode: 'A-01-01',
                qty: 40,
              },
            ],
            oqcLotStatus: 'ACCEPTED',
            replacement: null,
          },
          {
            shipmentRequestLotId: 8003,
            lotId: 7003,
            lotNo: 'P2611-0003',
            itemId: 2101,
            pickedQty: 30,
            uomId: 10,
            statusCode: 'REPLACED',
            managementCode: null,
            pickedAt: '2026-11-18T00:35:00.000Z',
            pickedWorker: { workerId: 1, workerNo: '100001', workerName: '작업자A' },
            shipmentId: null,
            portions: [],
            oqcLotStatus: 'REJECTED',
            replacement: {
              inspectionResultId: 9202,
              resultNo: 'IRS-OQC-0202',
              resultAt: '2026-11-18T01:40:00.000Z',
              judgment: 'REJECTED',
              nonconformanceId: 31,
              nonconformanceNo: 'NC-261118-0003',
              replacedAt: '2026-11-18T02:02:00.000Z',
              worker: { workerId: 1, workerNo: '100001', workerName: '작업자A' },
            },
          },
        ],
      },
    ],
  }) as unknown as ShipmentRequest;
