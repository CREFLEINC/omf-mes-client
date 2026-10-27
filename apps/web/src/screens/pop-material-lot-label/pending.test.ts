import { describe, expect, it } from 'vitest';

import {
  compareArrival,
  formatQty,
  groupBySupplier,
  matchesQuery,
  normalizeQuery,
  pageOf,
  receiptWhen,
} from './pending';
import type { TargetRow } from './types';

/** 합성값이다 — 실 운영 값을 쓰지 않는다(공개 저장소 경계). */
const row = (over: Partial<TargetRow>): TargetRow => ({
  inboundReceiptLineId: 1,
  lineNo: 1,
  inboundReceiptId: 1,
  inboundReceiptNo: 'SYN-IB-0001',
  supplierId: 8201,
  plantId: 8301,
  receiptDatetime: '2026-08-27T02:00:00Z',
  itemId: 8601,
  receivedQty: 1,
  uomId: 8401,
  lotId: null,
  inspectionRequired: false,
  lotNo: null,
  lotStatusCode: null,
  lastIssue: null,
  ...over,
});

describe('groupBySupplier', () => {
  it('공급사로 묶고, 먼저 입하된 공급사를 위에, 줄은 입하 순서로 둔다', () => {
    const groups = groupBySupplier([
      row({ inboundReceiptLineId: 1, supplierId: 8202, receiptDatetime: '2026-08-27T03:00:00Z' }),
      row({
        inboundReceiptLineId: 2,
        supplierId: 8201,
        receiptDatetime: '2026-08-27T04:00:00Z',
        inboundReceiptId: 2,
      }),
      row({
        inboundReceiptLineId: 3,
        supplierId: 8201,
        receiptDatetime: '2026-08-27T02:00:00Z',
        inboundReceiptId: 3,
      }),
    ]);

    expect(groups.map((group) => group.supplierId)).toEqual([8201, 8202]);
    expect(groups[0]?.rows.map((each) => each.inboundReceiptLineId)).toEqual([3, 2]);
    expect(groups[0]?.firstReceiptDatetime).toBe('2026-08-27T02:00:00Z');
    expect(groups[0]?.receiptCount).toBe(2);
    expect(groups[1]?.receiptCount).toBe(1);
  });

  it('⚠ 시각은 글자가 아니라 순간으로 견준다 — 오프셋이 섞여도 차례가 맞다', () => {
    const early = row({ inboundReceiptLineId: 1, receiptDatetime: '2026-08-27T08:00:00+07:00' });
    const late = row({ inboundReceiptLineId: 2, receiptDatetime: '2026-08-27T02:00:00Z' });

    expect(compareArrival(early, late)).toBeLessThan(0);
  });

  it('같은 시각이면 입하번호 → 줄 번호 순으로 늘 같은 차례다', () => {
    const a = row({ inboundReceiptLineId: 1, inboundReceiptNo: 'SYN-IB-0002', lineNo: 1 });
    const b = row({ inboundReceiptLineId: 2, inboundReceiptNo: 'SYN-IB-0001', lineNo: 2 });
    const c = row({ inboundReceiptLineId: 3, inboundReceiptNo: 'SYN-IB-0001', lineNo: 1 });

    expect([a, b, c].sort(compareArrival).map((each) => each.inboundReceiptLineId)).toEqual([
      3, 2, 1,
    ]);
  });
});

describe('matchesQuery', () => {
  it('빈 칸이면 모두 맞고, 품목코드나 입하번호의 일부와 대소문자 없이 맞는다', () => {
    const target = row({ inboundReceiptNo: 'SYN-IB-0042' });

    expect(matchesQuery(target, normalizeQuery('  '), 'SYN-ITEM-01')).toBe(true);
    expect(matchesQuery(target, normalizeQuery('item-01'), 'SYN-ITEM-01')).toBe(true);
    expect(matchesQuery(target, normalizeQuery('ib-0042'), null)).toBe(true);
    expect(matchesQuery(target, normalizeQuery('item-02'), 'SYN-ITEM-01')).toBe(false);
  });

  it('품목코드를 아직 못 풀었으면 입하번호로만 견준다', () => {
    expect(matchesQuery(row({}), normalizeQuery('item'), null)).toBe(false);
  });
});

describe('pageOf', () => {
  const items = Array.from({ length: 9 }, (_, index) => index + 1);

  it('쪽 크기만큼 자르고 첫 · 끝 줄 번호와 쪽 수를 낸다', () => {
    expect(pageOf(items, 1, 4)).toMatchObject({
      items: [1, 2, 3, 4],
      from: 1,
      to: 4,
      totalPages: 3,
      total: 9,
    });
    expect(pageOf(items, 3, 4)).toMatchObject({ items: [9], from: 9, to: 9, page: 3 });
  });

  it('범위를 넘긴 쪽은 마지막 쪽으로 잡는다 — 줄이 빠져 쪽이 줄어도 빈 쪽에 남지 않는다', () => {
    expect(pageOf(items, 9, 4).page).toBe(3);
    expect(pageOf([], 2, 4)).toMatchObject({ items: [], page: 1, from: 0, to: 0, totalPages: 1 });
  });
});

describe('receiptWhen', () => {
  it('UTC 를 공장 시각(UTC+7)으로 — 앞 글자를 자르면 7시간 이르게 찍힌다', () => {
    expect(receiptWhen('2026-08-27T20:30:00Z')).toEqual({
      day: '08-28',
      time: '03:30',
      date: '2026-08-28',
    });
  });

  it('읽지 못하면 null — 부르는 쪽이 칸을 비운다', () => {
    expect(receiptWhen('알 수 없는 값')).toBeNull();
  });
});

describe('formatQty', () => {
  it('천 단위 쉼표를 넣고 소수는 받은 만큼 둔다', () => {
    expect(formatQty(51000)).toBe('51,000');
    expect(formatQty(12.5)).toBe('12.5');
  });
});
