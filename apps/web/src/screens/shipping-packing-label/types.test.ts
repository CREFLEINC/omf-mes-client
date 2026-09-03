import { describe, expect, it } from 'vitest';

import {
  formatIssuedAt,
  needsReissueReason,
  toDefaultPrinterName,
  toDeliveryRow,
  toPackingRow,
  type AllocationView,
  type IssueSummaryView,
  type PrinterView,
} from './types';

const view = (
  shipmentLotAllocationId: number,
  lotNo: string | null,
  oqcPassed: boolean,
): AllocationView => ({
  shipmentLotAllocationId,
  lotId: 9501,
  lotNo,
  handlingUnitId: null,
  oqcPassed,
});

const PASSED = '합격';
const WAITING = '검사 대기';
const UNNAMED = 'LOT 번호 없음';

describe('toDeliveryRow', () => {
  it('출하검사 합격 여부가 그대로 발행 가능 여부다', () => {
    expect(toDeliveryRow(view(9401, 'SYN-LOT-0001', true), PASSED, WAITING, UNNAMED)).toMatchObject(
      {
        targetId: 9401,
        displayName: 'SYN-LOT-0001',
        isIssuable: true,
        statusLabel: PASSED,
      },
    );

    expect(
      toDeliveryRow(view(9402, 'SYN-LOT-0002', false), PASSED, WAITING, UNNAMED),
    ).toMatchObject({ isIssuable: false, statusLabel: WAITING });
  });

  it('LOT 번호가 없으면 지어내지 않고 없다고 그린다', () => {
    expect(toDeliveryRow(view(9403, null, true), PASSED, WAITING, UNNAMED).displayName).toBe(
      UNNAMED,
    );
  });
});

describe('toPackingRow', () => {
  it('LOT 을 비운다 — 한 포장에 여러 LOT 이 섞여 하나로 정하면 계보가 거짓이 된다', () => {
    expect(
      toPackingRow({ handlingUnitId: 9601, handlingUnitNo: 'SYN-CTN-0001', statusCode: 'SYN_HU' }),
    ).toEqual({
      targetId: 9601,
      issueTargetId: 9601,
      displayName: 'SYN-CTN-0001',
      lotId: null,
      isIssuable: true,
      statusLabel: 'SYN_HU',
    });
  });
});

describe('needsReissueReason', () => {
  const summaries: IssueSummaryView[] = [
    { targetId: 9401, issueCount: 0, lastIssuedAt: null, lastPrintOutcome: null },
    { targetId: 9402, issueCount: 2, lastIssuedAt: null, lastPrintOutcome: null },
  ];

  it('고른 것이 전부 처음이면 사유가 필요 없다', () => {
    expect(needsReissueReason([9401], summaries)).toBe(false);
  });

  it('하나라도 발행된 적이 있으면 사유가 필요하다', () => {
    expect(needsReissueReason([9401, 9402], summaries)).toBe(true);
  });

  it('현황이 없는 대상을 발행된 것으로 치지 않는다', () => {
    expect(needsReissueReason([9999], summaries)).toBe(false);
  });
});

describe('formatIssuedAt', () => {
  it('월-일 시:분으로 줄인다', () => {
    expect(formatIssuedAt('2026-09-02T04:20:00Z')).toBe('09-02 04:20');
  });

  it('형식이 아니면 원문을 그대로 낸다 — 삼키면 서버가 무엇을 보냈는지 알 수 없다', () => {
    expect(formatIssuedAt('알 수 없는 값')).toBe('알 수 없는 값');
  });
});

describe('toDefaultPrinterName', () => {
  const of = (printerName: string, isDefault: boolean): PrinterView => ({
    printerName,
    displayName: printerName,
    status: 'READY',
    statusMessage: null,
    isDefault,
  });

  it('기본 프린터가 있으면 그것을 고른다', () => {
    expect(toDefaultPrinterName([of('SYN-PRN-01', false), of('SYN-PRN-02', true)])).toBe(
      'SYN-PRN-02',
    );
  });

  it('기본이 없으면 첫 번째를 고른다', () => {
    expect(toDefaultPrinterName([of('SYN-PRN-01', false)])).toBe('SYN-PRN-01');
  });

  it('목록이 비면 고르지 않는다', () => {
    expect(toDefaultPrinterName([])).toBeNull();
  });
});
