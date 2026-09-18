import { messages } from '@omf-mes/i18n';
import { describe, expect, it } from 'vitest';

import { dateTimeText, hasNoAssignment, itemText, qtyText } from './row-view';
import type { WorkOrder } from './types';

const t = messages.emergencyWorkOrderField.detail;

const base: WorkOrder = {
  workOrderId: 1,
  workOrderNo: 'SYN-WO-E-0001',
  productionPlanId: 2,
  routingOperationId: 3,
  itemId: 4,
  orderQty: 10,
  uomId: 11,
  workOrderTypeCode: 'EMERGENCY',
  statusCode: 'SYN',
  priorityNo: 1,
};

describe('발행 시각 표시', () => {
  /* 표시는 공장 시각(베트남, UTC+7) 기준이다 — 브라우저 시간대와 상관없이 같다(omf-all-around#20). */
  it('계약이 준 오프셋의 순간을 공장 시각(UTC+7)으로 옮겨 읽는다', () => {
    expect(dateTimeText('2026-08-31T14:20:00+09:00')).toBe('2026-08-31 12:20');
  });

  it('같은 순간이면 오프셋이 달라도 같은 공장 시각을 보인다', () => {
    expect(dateTimeText('2026-08-31T05:20:00Z')).toBe('2026-08-31 12:20');
    expect(dateTimeText('2026-08-31T12:20:00+07:00')).toBe('2026-08-31 12:20');
  });

  it('다른 순간은 다른 공장 시각으로 보인다', () => {
    expect(dateTimeText('2026-08-31T14:20:00Z')).toBe('2026-08-31 21:20');
  });

  it('공장 시각으로 자정을 넘으면 날짜도 바뀐다', () => {
    expect(dateTimeText('2026-08-31T18:30:00Z')).toBe('2026-09-01 01:30');
  });

  it('안 온 값을 빈칸으로 두지 않는다', () => {
    expect(dateTimeText(undefined)).toBe(t.unknown);
  });

  it('서버가 null 로 준 값을 「null」이라는 글자로 보이지 않는다', () => {
    /* 계약 타입은 undefined 만 적지만 실제 응답은 null 이다(#1147). */
    expect(dateTimeText(null)).toBe(t.unknown);
  });

  it('읽을 수 없는 모양이면 받은 대로 보인다', () => {
    expect(dateTimeText('언제인지 모를 값')).toBe('언제인지 모를 값');
  });
});

describe('수량·품목 표시', () => {
  it('안 온 수량을 0으로 떨어뜨리지 않는다', () => {
    expect(qtyText(undefined)).toBe(t.unknown);
    expect(qtyText(null)).toBe(t.unknown);
  });

  it('품목 코드가 비면 빈칸이 아니라 모른다고 적는다', () => {
    expect(itemText({ ...base, itemCode: '   ' })).toBe(t.unknown);
  });
});

describe('배정 없음 판정', () => {
  it('설비·금형·교대가 전부 비었을 때만 배정 없음이다', () => {
    expect(hasNoAssignment(base)).toBe(true);
  });

  it('null 로 온 배정도 없는 것으로 본다', () => {
    const nulls = { plannedEquipmentId: null, plannedMoldId: null, plannedShiftId: null };
    expect(hasNoAssignment({ ...base, ...(nulls as unknown as Partial<WorkOrder>) })).toBe(true);
  });

  it.each([
    ['설비', { plannedEquipmentId: 1 }],
    ['금형', { plannedMoldId: 1 }],
    ['교대', { plannedShiftId: 1 }],
  ])('%s 하나만 배정돼 있어도 배정 없음이 아니다', (_label, assigned) => {
    expect(hasNoAssignment({ ...base, ...assigned })).toBe(false);
  });
});
