import { describe, expect, it } from 'vitest';

import { dayRange, periodStart, splitByPeriod } from './period';
import type { TargetRow } from './types';

/** 합성값이다 — 실 운영 값을 쓰지 않는다(공개 저장소 경계). */
const row = (inboundReceiptLineId: number, receiptDatetime: string): TargetRow => ({
  inboundReceiptLineId,
  lineNo: 1,
  inboundReceiptId: inboundReceiptLineId,
  inboundReceiptNo: `SYN-IB-${String(inboundReceiptLineId).padStart(4, '0')}`,
  supplierId: 8201,
  plantId: 8301,
  receiptDatetime,
  itemId: 8601,
  receivedQty: 1,
  uomId: 8401,
  lotId: null,
  inspectionRequired: false,
  lotNo: null,
  lotStatusCode: null,
  lastIssue: null,
});

const ids = (rows: readonly TargetRow[]): number[] => rows.map((each) => each.inboundReceiptLineId);

describe('periodStart', () => {
  it('오늘은 그날, 이번 달은 1일, 전체는 첫날이 없다', () => {
    expect(periodStart('today', '2026-10-27')).toBe('2026-10-27');
    expect(periodStart('month', '2026-10-27')).toBe('2026-10-01');
    expect(periodStart('all', '2026-10-27')).toBeNull();
  });

  it('주는 월요일부터다 — 월요일은 그날, 일요일은 엿새 전 월요일', () => {
    expect(periodStart('week', '2026-10-26')).toBe('2026-10-26');
    expect(periodStart('week', '2026-10-27')).toBe('2026-10-26');
    expect(periodStart('week', '2026-11-01')).toBe('2026-10-26');
  });

  it('주가 달을 넘으면 지난달 월요일부터다', () => {
    expect(periodStart('week', '2026-10-01')).toBe('2026-09-28');
  });
});

describe('splitByPeriod', () => {
  it('첫날보다 먼저 입하된 줄만 지난 것이다 — 날짜는 공장 시각으로 본다', () => {
    const split = splitByPeriod(
      [
        /* 공장 10-26 01:30 — UTC 로는 전날이지만 이번 주다. */
        row(1, '2026-10-25T18:30:00Z'),
        /* 공장 10-25 23:30 — 지난 주. */
        row(2, '2026-10-25T16:30:00Z'),
        row(3, '2026-10-27T02:00:00Z'),
      ],
      '2026-10-26',
    );

    expect(ids(split.inPeriod)).toEqual([1, 3]);
    expect(ids(split.past)).toEqual([2]);
  });

  it('입하 시각을 읽지 못한 줄은 숨기지 않고 기간 안에 둔다', () => {
    expect(ids(splitByPeriod([row(1, '')], '2026-10-26').inPeriod)).toEqual([1]);
  });

  it('「전체」면 지난 줄이 없다', () => {
    const split = splitByPeriod([row(1, '2026-01-02T02:00:00Z')], null);

    expect(ids(split.inPeriod)).toEqual([1]);
    expect(split.past).toEqual([]);
  });
});

describe('dayRange', () => {
  it('가장 이른 날과 늦은 날(월-일)이다 — 들어온 차례와 상관없다', () => {
    expect(
      dayRange([
        row(1, '2026-10-22T02:00:00Z'),
        row(2, '2026-10-20T02:00:00Z'),
        row(3, '2026-10-24T02:00:00Z'),
      ]),
    ).toEqual({ from: '10-20', to: '10-24' });
  });

  it('줄이 없으면 범위도 없다', () => {
    expect(dayRange([])).toBeNull();
  });
});
