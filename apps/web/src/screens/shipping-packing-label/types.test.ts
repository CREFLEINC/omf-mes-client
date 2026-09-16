import { describe, expect, it } from 'vitest';

import type { ShippingUnitDetail } from '../shipping-unit/types';

import {
  formatIssuedAt,
  needsReissueReason,
  toDefaultPrinterName,
  toDeliveryRow,
  toPackingRow,
  type IssueSummaryView,
  type PrinterView,
} from './types';

const unit = (shippingUnitId: number, shippingUnitNo: string, statusCode: 'OPEN' | 'CLOSED') =>
  ({
    shippingUnitId,
    shippingUnitNo,
    shippingUnitTypeCode: 'PALLET',
    statusCode,
    shipmentId: 501,
    shipmentNo: 'SYN-SH-0001',
    customer: { partnerId: 1, partnerCode: '100003', partnerName: 'Synthetic' },
    shipTo: { partnerId: 2, partnerCode: '901463', partnerName: 'Synthetic To' },
    boxCount: 2,
    versionNo: 1,
    createdAt: '2026-09-17T09:00:00+09:00',
    boxes: [],
    itemTotals: [],
  }) satisfies ShippingUnitDetail;

const CLOSED = '마감';
const COMPOSING = '구성 중';

describe('toDeliveryRow', () => {
  /*
   * ⛔ **자격이 「OQC 합격」에서 「마감」으로 바뀌었다**(SHIP-UNIT-01). 서버가 안 닫힌 단위에
   *    422 STATE_LOCKED 를 낸다 — 옛 판정으로 두면 구성 중인 단위를 고를 수 있고, 발행은 서버에
   *    가서야 막힌다.
   */
  it('마감 여부가 그대로 발행 가능 여부다', () => {
    expect(toDeliveryRow(unit(7001, 'SU-20260917-0001', 'CLOSED'), CLOSED, COMPOSING)).toMatchObject(
      {
        targetId: 7001,
        issueTargetId: 7001,
        displayName: 'SU-20260917-0001',
        isIssuable: true,
        statusLabel: CLOSED,
      },
    );

    expect(toDeliveryRow(unit(7002, 'SU-20260917-0002', 'OPEN'), CLOSED, COMPOSING)).toMatchObject({
      isIssuable: false,
      statusLabel: COMPOSING,
    });
  });

  /*
   * ⛔ **`lotId` 를 비운다.** 한 출하 단위에 여러 LOT 이 섞여 하나로 정하면 계보가 거짓이 된다 —
   *    서버도 이 대상 유형에 `lotId` 를 `null` 로 둔다(전달본 v4 ④).
   */
  it('LOT 을 비운다', () => {
    expect(toDeliveryRow(unit(7003, 'SU-20260917-0003', 'CLOSED'), CLOSED, COMPOSING).lotId).toBeNull();
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
